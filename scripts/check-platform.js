// Exercise Windows/POSIX paths and checkout line endings without modifying any
// project files. Builtin mocks stay in this process and are always restored.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";
import { collectDesignTokens, designTokenReference } from "../build/design-tokens.js";
import { templateCustomizer } from "../build/customizer.js";
import { pages } from "../build/pages.js";
import { tokenContract } from "../build/token-contract.js";
import { publishCommand } from "./publish-github.js";

const root = path.resolve(import.meta.dirname, "..");
const baseline = collectDesignTokens(root);
const contracts = tokenContract(baseline);
const native = {
    existsSync: fs.existsSync,
    mkdirSync: fs.mkdirSync,
    readFileSync: fs.readFileSync,
    readdirSync: fs.readdirSync,
    renameSync: fs.renameSync,
    writeFileSync: fs.writeFileSync,
    resolve: path.resolve,
    relative: path.relative,
};

for (const platform of ["posix", "win32"]) {
    for (const crlf of [false, true]) {
        const virtualRoot = platform === "win32" ? "C:\\fixture\\marpich-sanat" : "/fixture/marpich-sanat";
        const localPath = (file) =>
            typeof file === "string" && file.startsWith(virtualRoot)
                ? root + file.slice(virtualRoot.length).replaceAll("\\", "/")
                : file;
        let ignoredReads = 0;
        try {
            path.resolve = path[platform].resolve;
            path.relative = path[platform].relative;
            fs.readdirSync = (file, ...args) => native.readdirSync(localPath(file), ...args).reverse();
            fs.readFileSync = (file, ...args) => {
                const physical = localPath(file);
                let value = native.readFileSync(physical, ...args);
                if (typeof value !== "string") return value;
                const relative =
                    typeof physical === "string" ? native.relative(root, physical).replaceAll("\\", "/") : "";
                // This saved header override reproduced the user's assertion.
                // UI-only declarations also must stay out of the website catalog.
                if (relative === "src/css/template-overrides.css") {
                    ignoredReads++;
                    value += "\nbody[data-page] .site-header { --header-fixed-scroll-threshold: 128px; }\n";
                } else if (["src/css/customizer.css", "src/css/token-reference.css"].includes(relative)) {
                    ignoredReads++;
                    value += "\n.editor-fixture { --fixture-ui-only: #abcdef; }\n";
                }
                return crlf ? value.replace(/\r?\n/g, "\r\n") : value;
            };
            syncBuiltinESMExports();
            const tokens = collectDesignTokens(virtualRoot);
            assert.equal(ignoredReads, 0, "Generated/editor CSS must be excluded before parsing");
            assert.deepEqual(tokenContract(tokens), contracts, `${platform}/${crlf ? "CRLF" : "LF"} contracts`);
            assert.deepEqual(tokens, baseline, "Portable paths, page owners, lines and directory ordering");

            const plugin = designTokenReference(virtualRoot);
            const module = { id: "fixture" };
            let invalidations = 0;
            const context = (file) => ({
                file: path.resolve(virtualRoot, file),
                modules: [],
                server: {
                    moduleGraph: {
                        getModuleById: () => module,
                        invalidateModule: () => {
                            invalidations++;
                        },
                    },
                },
            });
            assert.deepEqual(plugin.handleHotUpdate(context("src/css/type-settings.css")), [module]);
            assert.equal(invalidations, 1);
            assert.equal(plugin.handleHotUpdate(context("src/css/template-overrides.css")), undefined);
            assert.equal(invalidations, 1, "Saved override CSS must not invalidate the source catalog");
        } finally {
            Object.assign(fs, { readFileSync: native.readFileSync, readdirSync: native.readdirSync });
            Object.assign(path, { resolve: native.resolve, relative: native.relative });
            syncBuiltinESMExports();
        }
    }
}

// Vite supplies forward-slash hook filenames on Windows, while node:path
// resolves filesystem paths with backslashes. Exercise that combination with
// the real customizer hooks and saved settings, without writing project files.
for (const platform of ["posix", "win32"]) {
    const virtualRoot =
        platform === "win32"
            ? "C:\\Users\\Saeid_Eshghi\\Desktop\\پروژه صنعت (2)\\marpich-sanat-v3"
            : "/fixture/پروژه صنعت (2)/marpich-sanat-v3";
    const localPath = (file) =>
        typeof file === "string" && file.startsWith(virtualRoot)
            ? root + file.slice(virtualRoot.length).replaceAll("\\", "/")
            : file;
    try {
        path.resolve = path[platform].resolve;
        fs.existsSync = (file) => native.existsSync(localPath(file));
        fs.readFileSync = (file, ...args) => {
            const value = native.readFileSync(localPath(file), ...args);
            return typeof value === "string" ? value.replace(/\r\n?/g, "\n") : value;
        };
        for (const operation of ["mkdirSync", "renameSync", "writeFileSync"])
            fs[operation] = () => assert.fail(`Platform fixture must not write files: ${operation}`);
        syncBuiltinESMExports();

        const html = "<!doctype html><html><head></head><body></body></html>";
        const formats = [
            ["native", (file) => file],
            ["Vite", (file) => file.replaceAll("\\", "/")],
        ];
        for (const base of ["/", "/marpich-sanat-v3/"]) {
            const plugin = templateCustomizer(virtualRoot, base);
            let styleHref;
            for (const [format, filename] of formats) {
                for (const page of pages) {
                    const tags = plugin.transformIndexHtml.handler(html, {
                        filename: filename(path.resolve(virtualRoot, page.file)),
                    });
                    assert(Array.isArray(tags), `${platform}/${format}/${page.file}: missing customizer CSS`);
                    const links = tags.filter((tag) => tag.attrs?.id === "mps-template-overrides");
                    assert.equal(links.length, 1, "Every page must receive exactly one saved stylesheet");
                    const link = links[0];
                    assert.equal(link.tag, "link");
                    assert.equal(link.attrs.rel, "stylesheet");
                    assert.equal(link.injectTo, "head");
                    const prefix = `${base}assets/customizer/template-overrides.css?v=`;
                    assert(link.attrs.href.startsWith(prefix), "Saved CSS must use the configured Pages base");
                    assert.match(link.attrs.href.slice(prefix.length), /^[a-f0-9]{12}$/);
                    styleHref ??= link.attrs.href;
                    assert.equal(link.attrs.href, styleHref, "Path separators must not change the CSS version");

                    const sources = tags.filter((tag) => tag.attrs?.id === "mps-image-sources");
                    assert.equal(sources.length, page.file === "about.html" ? 1 : 0);
                    if (sources.length) {
                        assert.equal(sources[0].attrs.type, "application/json");
                        assert.equal(sources[0].injectTo, "head");
                        assert.doesNotThrow(() => JSON.parse(sources[0].children));
                    }
                }
                for (const file of ["tools/customizer.html", "tools/design-tokens.html", "tools/index.html"])
                    assert.equal(
                        plugin.transformIndexHtml.handler(html, {
                            filename: filename(path.resolve(virtualRoot, file)),
                        }),
                        html,
                        "Website styles must not leak into tools or unregistered pages",
                    );
                for (const file of ["src/data/patterns/site-pattern.json", "src/data/patterns/footer-pattern.json"])
                    assert.deepEqual(
                        plugin.handleHotUpdate({ file: filename(path.resolve(virtualRoot, file)) }),
                        [],
                        `${platform}/${format}: pattern saves must preserve editor state`,
                    );
                assert.equal(
                    plugin.handleHotUpdate({ file: filename(path.resolve(virtualRoot, "src/css/main.css")) }),
                    undefined,
                    "Other files must retain normal Vite HMR",
                );
            }
        }
    } finally {
        for (const operation of ["existsSync", "mkdirSync", "readFileSync", "renameSync", "writeFileSync"])
            fs[operation] = native[operation];
        path.resolve = native.resolve;
        syncBuiltinESMExports();
    }
}

const node = "C:\\Program Files\\nodejs\\node.exe";
const npm = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
assert.deepEqual(
    publishCommand("npm", ["run", "check"], {
        platform: "win32",
        execPath: node,
        npmExecPath: npm,
    }),
    { program: node, args: [npm, "run", "check"] },
);
const fallback = { platform: "win32", npmExecPath: null, comSpec: "cmd.exe" };
assert.deepEqual(publishCommand("npm", ["run", "check"], fallback), {
    program: "cmd.exe",
    args: ["/d", "/s", "/c", "npm run check"],
});
assert.throws(() => publishCommand("npm", ["run", "check; echo bad"], fallback), /Unsupported npm command/);
assert.deepEqual(publishCommand("git", ["status", "--short"], fallback), {
    program: "git",
    args: ["status", "--short"],
});
assert.deepEqual(publishCommand("npm", ["ci"], { platform: "linux" }), { program: "npm", args: ["ci"] });
if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    const command = publishCommand("npm", ["--version"], { platform: "win32" });
    const result = spawnSync(command.program, command.args, { encoding: "utf8", shell: false });
    assert.equal(result.status, 0, result.stderr);
    assert(/^\d+\.\d+\.\d+/.test(result.stdout.trim()));
    assert(!result.stderr.includes("DEP0190"));
}
console.log(
    "PASS: Windows/POSIX catalog parity, LF/CRLF, saved CSS isolation, Vite customizer paths/Pages links, deterministic owners/HMR and npm invocation without shell:true.",
);
