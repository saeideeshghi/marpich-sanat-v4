import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { runtimePatterns } from "../build/pattern-runtime.js";
import { templateCustomizer } from "../build/customizer.js";
import { loadDesignConfig } from "../build/design-config.js";
import { pages } from "../build/pages.js";
import { localeStorageKey, previewURL, savePreviewSnapshot } from "../src/js/customizer/preview-session.js";
import { compileCSS, persistedSettings } from "../src/js/customizer/model.js";
import { settingsArchive } from "../src/js/customizer/export.js";

const project = resolve(import.meta.dirname, "..");
const read = (root, path) => readFileSync(resolve(root, path), "utf8");
const write = (root, path, text) => {
    const target = resolve(root, path);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, text);
};
const copy = (from, to, path) => write(to, path, read(from, path));

function makeProject(includeLocales = true) {
    const root = mkdtempSync(resolve(tmpdir(), "marpich-customizer-locales-"));
    for (const path of [
        "src/data/customizer/settings.json",
        "src/data/patterns/site-pattern.json",
        "src/data/patterns/footer-pattern.json",
        "src/css/template-overrides.css",
    ])
        copy(project, root, path);
    if (includeLocales) {
        const english = JSON.parse(read(project, "src/data/customizer/settings.json"));
        english.rules[0].properties["font-size"] = 39;
        english.rules.push({
            page: "about",
            breakpoint: "all",
            target: { kind: "role", key: "about-image" },
            properties: { "image-source": "/assets/about-en.svg" },
        });
        write(root, "src/data/customizer/settings.en.json", JSON.stringify(english, null, 2) + "\n");
        const arabic = JSON.parse(read(project, "src/data/customizer/settings.json"));
        arabic.rules[0].properties["font-size"] = 41;
        arabic.rules.push({
            page: "about",
            breakpoint: "all",
            target: { kind: "role", key: "about-image" },
            properties: { "image-source": "/assets/about-ar.svg" },
        });
        write(root, "src/data/customizer/settings.ar.json", JSON.stringify(arabic, null, 2) + "\n");
        for (const [locale, name] of [
            ["en", "site-pattern"],
            ["en", "footer-pattern"],
            ["ar", "site-pattern"],
            ["ar", "footer-pattern"],
        ]) {
            const source = name === "site-pattern" ? "site-pattern" : "footer-pattern";
            const pattern = JSON.parse(read(project, `src/data/patterns/${source}.json`));
            pattern.global.background1 = locale === "en" ? "#123456" : "#654321";
            write(root, `src/data/patterns/${locale}/${name}.json`, JSON.stringify(pattern, null, 2) + "\n");
        }
    }
    return root;
}

async function startCustomizer(root) {
    const plugin = templateCustomizer(root, "/");
    const middleware = [];
    const server = { middlewares: { use: (handler) => middleware.push(handler) }, ws: { send() {} } };
    await plugin.configureServer(server);
    return async function request(url, { method = "GET", body, token } = {}) {
        const req = Readable.from(method === "POST" ? [Buffer.from(JSON.stringify(body))] : []);
        req.url = url;
        req.method = method;
        req.headers = {
            host: "127.0.0.1:3000",
            origin: "http://127.0.0.1:3000",
            ...(method === "POST"
                ? {
                      "content-type": "application/json",
                      "x-marpich-customizer": token,
                  }
                : {}),
        };
        req.socket = { encrypted: false, remoteAddress: "127.0.0.1" };
        const response = {
            headers: {},
            statusCode: 200,
            setHeader(name, value) {
                this.headers[name] = value;
            },
            end(value = "") {
                this.body = String(value);
            },
        };
        await middleware[0](req, response, (error) => {
            if (error) throw error;
            throw new Error(`Unexpected middleware fall-through for ${url}`);
        });
        return { status: response.statusCode, headers: response.headers, data: JSON.parse(response.body) };
    };
}

async function verifyLocaleSaveIsolation() {
    const root = makeProject();
    try {
        const request = await startCustomizer(root);
        const fa = await request("/__customizer/settings?locale=fa");
        const en = await request("/__customizer/settings?locale=en");
        const ar = await request("/__customizer/settings?locale=ar");
        assert.equal(fa.status, 200);
        assert.equal(en.status, 200);
        assert.equal(ar.status, 200);
        assert.equal(en.data.config.rules[0].properties["font-size"], 39);
        assert.equal(ar.data.config.rules[0].properties["font-size"], 41);

        const untouched = new Map(
            [
                "src/data/customizer/settings.json",
                "src/data/customizer/settings.ar.json",
                "src/data/patterns/site-pattern.json",
                "src/data/patterns/footer-pattern.json",
                "src/data/patterns/ar/site-pattern.json",
                "src/data/patterns/ar/footer-pattern.json",
            ].map((path) => [path, read(root, path)]),
        );
        const changed = structuredClone(en.data.config);
        changed.rules[0].properties["font-size"] = 53;
        changed.patterns.header.global.background1 = "#abcdef";
        changed.patterns.footer.global.background1 = "#fedcba";
        const saved = await request("/__customizer/settings?locale=en", {
            method: "POST",
            token: en.data.token,
            body: { locale: "en", revision: en.data.revision, config: changed },
        });
        assert.equal(saved.status, 200, saved.data.error);
        assert.equal(
            JSON.parse(read(root, "src/data/customizer/settings.en.json")).rules[0].properties["font-size"],
            53,
        );
        assert.equal(JSON.parse(read(root, "src/data/patterns/en/site-pattern.json")).global.background1, "#abcdef");
        assert.equal(JSON.parse(read(root, "src/data/patterns/en/footer-pattern.json")).global.background1, "#fedcba");
        for (const [path, content] of untouched)
            assert.equal(read(root, path), content, `${path} changed during EN save`);

        const stale = await request("/__customizer/settings?locale=en", {
            method: "POST",
            token: en.data.token,
            body: { locale: "en", revision: en.data.revision, config: changed },
        });
        assert.equal(stale.status, 409, "stale EN revision must reject only the EN write");
        const savedFa = await request("/__customizer/settings?locale=fa", {
            method: "POST",
            token: fa.data.token,
            body: { locale: "fa", revision: fa.data.revision, config: fa.data.config },
        });
        assert.equal(savedFa.status, 200, "an independent FA revision must remain current");
        assert.equal(
            (await request("/__customizer/settings?locale=ar")).data.config.rules[0].properties["font-size"],
            41,
        );
        assert.equal((await request("/__customizer/settings?locale=xx")).status, 400);
        assert.equal((await request("/__customizer/settings?locale=EN")).status, 400);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

async function verifyPersianFallbackCreatesIndependentFiles() {
    const root = makeProject(false);
    try {
        const request = await startCustomizer(root);
        const fa = await request("/__customizer/settings?locale=fa");
        const en = await request("/__customizer/settings?locale=en");
        assert.deepEqual(en.data.config, fa.data.config, "missing EN starts from Persian's current baseline");
        const changed = structuredClone(en.data.config);
        changed.patterns.header.global.background1 = "#aabbcc";
        const saved = await request("/__customizer/settings?locale=en", {
            method: "POST",
            token: en.data.token,
            body: { locale: "en", revision: en.data.revision, config: changed },
        });
        assert.equal(saved.status, 200, saved.data.error);
        assert.equal(JSON.parse(read(root, "src/data/patterns/en/site-pattern.json")).global.background1, "#aabbcc");
        assert.equal(JSON.parse(read(root, "src/data/patterns/site-pattern.json")).global.background1, "#151e2f");
        assert.equal(
            JSON.parse(read(root, "src/data/customizer/settings.json")).rules[0].properties["font-size"],
            fa.data.config.rules[0].properties["font-size"],
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

async function verifyLocalePatternModules() {
    const root = makeProject();
    try {
        const plugin = runtimePatterns(root);
        for (const [locale, expected] of [
            ["fa", "#151e2f"],
            ["en", "#123456"],
            ["ar", "#654321"],
        ]) {
            const id = plugin.resolveId(`virtual:site-pattern/header?locale=${locale}`);
            assert.equal(id, `\0virtual:site-pattern/header?locale=${locale}`);
            const watched = [];
            const code = plugin.load.call({ addWatchFile: (path) => watched.push(path) }, id);
            assert(code.includes(expected), `${locale} runtime must load its own header pattern`);
            assert.equal(watched.length, 1);
            assert(
                watched[0]
                    .replaceAll("\\", "/")
                    .includes(`patterns/${locale === "fa" ? "site-pattern.json" : `${locale}/site-pattern.json`}`),
            );
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

async function verifyLocalePreviewIsolation() {
    const page = pages.find((item) => item.name === "about");
    const origin = "https://example.test";
    assert.equal(localeStorageKey("/", "customizer-draft", "fa"), "marpich-customizer-draft:/:fa");
    assert.notEqual(
        localeStorageKey("/", "customizer-draft", "fa"),
        localeStorageKey("/", "customizer-draft", "en"),
        "locale drafts must use different storage keys",
    );
    assert.equal(previewURL(page, "00000000-0000-4000-8000-000000000000", "/", "fa", origin).pathname, "/about.html");
    assert.equal(
        previewURL(page, "00000000-0000-4000-8000-000000000000", "/", "en", origin).pathname,
        "/en/about.html",
    );
    assert.equal(
        previewURL(page, "00000000-0000-4000-8000-000000000000", "/", "ar", origin).pathname,
        "/ar/about.html",
    );

    const originalStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        get length() {
            return values.size;
        },
        key(index) {
            return [...values.keys()][index] ?? null;
        },
        getItem(key) {
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            values.set(String(key), String(value));
        },
        removeItem(key) {
            values.delete(String(key));
        },
    };
    try {
        const config = { version: 1, rules: [] };
        for (let index = 0; index < 5; index++) savePreviewSnapshot(config, "/", undefined, "fa");
        savePreviewSnapshot(config, "/", undefined, "ar");
        const faKeys = [...values.keys()].filter((key) => key.includes(":fa:"));
        const arKeys = [...values.keys()].filter((key) => key.includes(":ar:"));
        assert.equal(faKeys.length, 5, "creating an AR snapshot must not evict FA snapshots");
        assert.equal(arKeys.length, 1);
    } finally {
        if (originalStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = originalStorage;
    }
}

async function verifyBrowserEnglishCssMirror() {
    const module = await import("../src/js/customizer/locale-css.js").catch(() => ({}));
    assert.equal(
        typeof module.flipCSS,
        "function",
        "browser preview must use the same English CSS mirror as the build",
    );
    const css = module.flipCSS(".probe{left:12px;text-align:right;direction:rtl;transform:translateX(-50%)}");
    assert.match(css, /right:\s*12px/);
    assert.match(css, /text-align:\s*left/);
    assert.match(css, /direction:\s*ltr/);
    assert.match(css, /translateX\(50%\)/);
}

async function verifyEditorLocaleState() {
    const module = await import("../src/js/customizer/locale-state.js").catch(() => ({}));
    assert.equal(typeof module.readCustomizerLocale, "function", "editor locale query must be normalized centrally");
    assert.equal(module.readCustomizerLocale("?locale=en"), "en");
    assert.equal(module.readCustomizerLocale("?locale=ar"), "ar");
    assert.equal(module.readCustomizerLocale("?locale=EN"), "fa", "unsupported editor locale falls back to Persian");
    assert.equal(module.readCustomizerLocale(""), "fa");

    const about = pages.find((item) => item.name === "about");
    assert.equal(module.localePageFile(about, "fa"), "about.html");
    assert.equal(module.localePageFile(about, "en"), "en/about.html");
    assert.equal(module.localePageFile(about, "ar"), "ar/about.html");
    const changed = new URL(
        module.localeEditorURL("https://example.test/tools/customizer.html?token=local", "ar", "about"),
    );
    assert.equal(changed.searchParams.get("locale"), "ar");
    assert.equal(changed.searchParams.get("page"), "about");
    assert.equal(changed.searchParams.get("token"), "local");
}

async function verifyLocalePageAssets() {
    const root = makeProject();
    try {
        const plugin = templateCustomizer(root, "/");
        for (const [locale, file, cssName, source] of [
            ["fa", "about.html", "template-overrides.css", undefined],
            ["en", "en/about.html", "template-overrides.en.css", "/assets/about-en.svg"],
            ["ar", "ar/about.html", "template-overrides.ar.css", "/assets/about-ar.svg"],
        ]) {
            const tags = plugin.transformIndexHtml.handler("", { filename: resolve(root, file) });
            const stylesheet = tags.find((tag) => tag.attrs?.id === "mps-template-overrides");
            assert(stylesheet.attrs.href.startsWith(`/assets/customizer/${cssName}?v=`));
            const imageSettings = tags.find((tag) => tag.attrs?.id === "mps-image-sources");
            const sources = JSON.parse(imageSettings.children);
            assert.equal(sources[0]?.source, source);
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

async function verifyAllLocaleExport() {
    const configs = Object.fromEntries(["fa", "en", "ar"].map((locale) => [locale, loadDesignConfig(project, locale)]));
    for (const [index, locale] of ["fa", "en", "ar"].entries()) {
        configs[locale].rules[0].properties["font-size"] = 30 + index;
        configs[locale].patterns.header.global.background1 = ["#112233", "#223344", "#334455"][index];
    }
    const archive = new Uint8Array(await settingsArchive(configs).arrayBuffer());
    const view = new DataView(archive.buffer);
    const decoder = new TextDecoder();
    const entries = new Map();
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
        const size = view.getUint32(offset + 18, true);
        const nameLength = view.getUint16(offset + 26, true);
        const extraLength = view.getUint16(offset + 28, true);
        const name = decoder.decode(archive.subarray(offset + 30, offset + 30 + nameLength));
        const start = offset + 30 + nameLength + extraLength;
        entries.set(name, decoder.decode(archive.subarray(start, start + size)));
        offset = start + size;
    }
    const files = {
        fa: {
            settings: "src/data/customizer/settings.json",
            css: "src/css/template-overrides.css",
            header: "src/data/patterns/site-pattern.json",
            footer: "src/data/patterns/footer-pattern.json",
        },
        en: {
            settings: "src/data/customizer/settings.en.json",
            css: "src/css/template-overrides.en.css",
            header: "src/data/patterns/en/site-pattern.json",
            footer: "src/data/patterns/en/footer-pattern.json",
        },
        ar: {
            settings: "src/data/customizer/settings.ar.json",
            css: "src/css/template-overrides.ar.css",
            header: "src/data/patterns/ar/site-pattern.json",
            footer: "src/data/patterns/ar/footer-pattern.json",
        },
    };
    for (const locale of ["fa", "en", "ar"]) {
        for (const path of Object.values(files[locale]))
            assert(entries.has(path), `${locale} export is missing ${path}`);
        assert.equal(entries.get(files[locale].css), compileCSS(configs[locale]));
        assert.deepEqual(JSON.parse(entries.get(files[locale].settings)), persistedSettings(configs[locale]));
        assert.equal(
            JSON.parse(entries.get(files[locale].header)).global.background1,
            configs[locale].patterns.header.global.background1,
        );
    }
}

await verifyLocaleSaveIsolation();
await verifyPersianFallbackCreatesIndependentFiles();
await verifyLocalePatternModules();
await verifyLocalePreviewIsolation();
await verifyBrowserEnglishCssMirror();
await verifyEditorLocaleState();
await verifyLocalePageAssets();
await verifyAllLocaleExport();
console.log("PASS: locale saves, editor state, assets, preview snapshots and three-locale export stay isolated");
