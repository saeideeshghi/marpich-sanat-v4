import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { normalizeConfig, compileCSS } from "../src/js/customizer/model.js";
import { imageSourceRules } from "../src/js/customizer/image-source.js";
import { allPages as pages } from "./pages.js";
import {
    CUSTOMIZER_LOCALES,
    loadDesignConfig,
    patternPathFor,
    settingsPathFor,
    settingsText,
} from "./design-config.js";

// Filesystem paths stay native; Vite hook comparisons use forward slashes.
const normalizePath = (file) => file?.replaceAll("\\", "/");
const cssName = (locale) => `template-overrides${locale === "fa" ? "" : `.${locale}`}.css`;
const settingsAssetName = (locale) => `settings${locale === "fa" ? "" : `.${locale}`}.json`;

export function templateCustomizer(root, base, { publicTools = true } = {}) {
    const cssPaths = Object.fromEntries(
        CUSTOMIZER_LOCALES.map((locale) => [locale, resolve(root, `src/css/${cssName(locale)}`)]),
    );
    const pagePaths = new Map(pages.map((page) => [normalizePath(resolve(root, page.file)), page.locale || "fa"]));
    const aboutPaths = new Set(
        pages
            .filter((page) => (page.sourceFile || page.file) === "about.html")
            .map((page) => normalizePath(resolve(root, page.file))),
    );
    const patternFiles = new Set(
        CUSTOMIZER_LOCALES.flatMap((locale) =>
            ["header", "footer"].map((kind) => normalizePath(patternPathFor(root, locale, kind))),
        ),
    );
    const token = randomBytes(24).toString("hex");
    const load = (locale = "fa") => loadDesignConfig(root, locale);
    const revision = (config) => createHash("sha256").update(JSON.stringify(config)).digest("hex");
    const atomicWrite = (path, content) => {
        mkdirSync(dirname(path), { recursive: true });
        const temp = `${path}.${process.pid}.tmp`;
        writeFileSync(temp, content, "utf8");
        renameSync(temp, path);
    };
    const updateCSS = (locale) => {
        const path = cssPaths[locale];
        const css = compileCSS(load(locale));
        if (!existsSync(path) || readFileSync(path, "utf8").replace(/\r\n/g, "\n").trimEnd() !== css.trimEnd()) atomicWrite(path, css);
    };
    const json = (res, status, value) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(value));
    };
    const validLocale = (locale) => CUSTOMIZER_LOCALES.includes(locale);
    for (const locale of CUSTOMIZER_LOCALES) updateCSS(locale);

    return {
        name: "marpich-template-customizer",
        handleHotUpdate(context) {
            // Saving artwork updates the live player without losing the editor's
            // selection/history to Vite's JSON module reload.
            if (patternFiles.has(normalizePath(context.file))) return [];
        },
        transformIndexHtml: {
            order: "post",
            handler(html, context) {
                const filename = normalizePath(context.filename);
                const locale = pagePaths.get(filename);
                if (!locale) return html;
                const config = load(locale);
                const styleVersion = createHash("sha256").update(compileCSS(config)).digest("hex").slice(0, 12);
                return [
                    ...(aboutPaths.has(filename)
                        ? [
                              {
                                  tag: "script",
                                  attrs: { id: "mps-image-sources", type: "application/json" },
                                  // Script raw text must not contain a closing
                                  // tag even when a CMS URL contains encoded markup.
                                  children: JSON.stringify(imageSourceRules(config.rules)).replaceAll("<", "\\u003c"),
                                  injectTo: "head",
                              },
                          ]
                        : []),
                    {
                        tag: "link",
                        attrs: {
                            id: "mps-template-overrides",
                            rel: "stylesheet",
                            href: `${base}assets/customizer/${cssName(locale)}?v=${styleVersion}`,
                        },
                        injectTo: "head",
                    },
                ];
            },
        },
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url || "/", "http://localhost");
                const localeCss = new Map(
                    CUSTOMIZER_LOCALES.map((locale) => [`${base}assets/customizer/${cssName(locale)}`, locale]),
                );
                if (localeCss.has(url.pathname)) {
                    res.setHeader("Content-Type", "text/css; charset=utf-8");
                    res.setHeader("Cache-Control", "no-store");
                    res.end(compileCSS(load(localeCss.get(url.pathname))));
                    return;
                }
                const settingsAsset = new Map(
                    CUSTOMIZER_LOCALES.map((locale) => [
                        `${base}assets/customizer/${settingsAssetName(locale)}`,
                        locale,
                    ]),
                );
                if (settingsAsset.has(url.pathname)) return json(res, 200, load(settingsAsset.get(url.pathname)));
                if (url.pathname !== `${base}__customizer/settings`) return next();

                const localeFromUrl = url.searchParams.get("locale");
                if (localeFromUrl !== null && !validLocale(localeFromUrl))
                    return json(res, 400, { error: "زبان Customizer معتبر نیست." });
                // This middleware answers before Vite's own Host checks. Protect
                // reads of the write token as well as writes from DNS rebinding.
                try {
                    const address = new URL(`${req.socket?.encrypted ? "https" : "http"}://${req.headers.host}`);
                    const loopback =
                        address.hostname === "localhost" ||
                        address.hostname === "[::1]" ||
                        /^127\.(?:\d+\.){2}\d+$/.test(address.hostname);
                    if (!loopback || address.username || address.password) throw new Error("host");
                    const peer = req.socket?.remoteAddress?.replace(/^::ffff:/i, "");
                    if (peer && peer !== "::1" && !/^127\.(?:\d+\.){2}\d+$/.test(peer)) throw new Error("peer");
                    const requestOrigin = address.origin;
                    if (req.headers.origin && new URL(req.headers.origin).origin !== requestOrigin)
                        throw new Error("origin");
                    if (req.headers["sec-fetch-site"] === "cross-site") throw new Error("origin");
                } catch {
                    return json(res, 403, { error: "ویرایش تنظیمات فقط از همین آدرس محلی مجاز است." });
                }
                if (req.method === "GET") {
                    const locale = localeFromUrl || "fa";
                    const config = load(locale);
                    return json(res, 200, { config, revision: revision(config), token, canSave: true });
                }
                if (req.method !== "POST") return json(res, 405, { error: "روش درخواست معتبر نیست." });
                // File writes are available only to this same-origin editor.
                if (req.headers["x-marpich-customizer"] !== token)
                    return json(res, 403, { error: "ثبت فقط از ویرایشگر همین پروژه مجاز است." });
                if (!req.headers["content-type"]?.startsWith("application/json"))
                    return json(res, 415, { error: "درخواست JSON لازم است." });
                try {
                    const chunks = [];
                    let bytes = 0;
                    for await (const chunk of req) {
                        bytes += chunk.length;
                        if (bytes > 2097152) return json(res, 413, { error: "حجم تنظیمات بیش از حد است." });
                        chunks.push(chunk);
                    }
                    // Network chunks can split a Persian UTF-8 character.
                    const body = Buffer.concat(chunks).toString("utf8");
                    const request = JSON.parse(body);
                    const rawLocale = request.locale ?? localeFromUrl ?? "fa";
                    if (
                        !validLocale(rawLocale) ||
                        (localeFromUrl && request.locale && localeFromUrl !== request.locale)
                    )
                        return json(res, 400, { error: "زبان Customizer معتبر نیست." });
                    const locale = rawLocale;
                    const current = load(locale);
                    if (request.revision !== revision(current))
                        return json(res, 409, {
                            error: "تنظیمات همین زبان در پنجره دیگری تغییر کرده. صفحه را تازه کن و دوباره بررسی کن.",
                        });
                    const config = normalizeConfig({
                        ...request.config,
                        patterns: request.config.patterns || current.patterns,
                    });
                    const css = compileCSS(config);
                    const patternPaths = Object.fromEntries(
                        ["header", "footer"].map((kind) => [kind, patternPathFor(root, locale, kind)]),
                    );
                    const updates = [
                        [cssPaths[locale], css],
                        [settingsPathFor(root, locale), settingsText(config)],
                        ...Object.entries(patternPaths).map(([kind, path]) => [
                            path,
                            `${JSON.stringify(config.patterns[kind], null, 2)}\n`,
                        ]),
                    ];
                    const previous = updates.map(([path]) => [
                        path,
                        existsSync(path) ? readFileSync(path, "utf8") : null,
                    ]);
                    try {
                        for (const [path, text] of updates)
                            if (!existsSync(path) || readFileSync(path, "utf8") !== text) atomicWrite(path, text);
                    } catch (error) {
                        for (const [path, text] of previous) {
                            if (text === null) {
                                if (existsSync(path)) unlinkSync(path);
                            } else atomicWrite(path, text);
                        }
                        throw error;
                    }
                    server.ws.send({
                        type: "custom",
                        event: "marpich:template-saved",
                        data: { locale, revision: revision(config) },
                    });
                    return json(res, 200, { config, revision: revision(config), canSave: true });
                } catch (error) {
                    return json(res, 400, { error: error.message || "ثبت تنظیمات انجام نشد." });
                }
            });
        },
        generateBundle() {
            for (const locale of CUSTOMIZER_LOCALES) {
                const config = load(locale);
                this.emitFile({
                    type: "asset",
                    fileName: `assets/customizer/${cssName(locale)}`,
                    source: compileCSS(config),
                });
                if (publicTools)
                    this.emitFile({
                        type: "asset",
                        fileName: `assets/customizer/${settingsAssetName(locale)}`,
                        source: `${JSON.stringify(config, null, 2)}\n`,
                    });
            }
        },
    };
}

