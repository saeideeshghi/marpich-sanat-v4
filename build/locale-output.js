import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { localizedPages } from "./pages.js";
import { compileCSS } from "../src/js/customizer/model.js";
import { flipCSS, mirrorTranslation } from "../src/js/customizer/locale-css.js";
import { loadDesignConfig } from "./design-config.js";
export { mirrorTranslation };
export function flip(css) {
    return flipCSS(css);
}
export function localeOutput(root) {
    let directory;
    let base = "/";
    const strip = (url) => {
        const path = url.split(/[?#]/)[0];
        if (!path.startsWith(base)) throw new Error("Unexpected stylesheet base: " + path);
        return path.slice(base.length);
    };
    let building = false;
    return {
        name: "marpich-locale-output",
        enforce: "post",
        configResolved(config) {
            directory = resolve(root, config.build.outDir);
            base = config.base;
            building = config.command === "build";
        },
        transformIndexHtml: {
            order: "post",
            handler(html, context) {
                const arabic = localizedPages.some(
                    (page) => page.locale === "ar" && resolve(root, page.file) === resolve(context.filename),
                );
                if (!building && arabic)
                    return html.replace("</head>", '<link rel="stylesheet" href="/src/css/locales/ar.css"></head>');
                if (
                    building ||
                    !localizedPages.some(
                        (page) => page.locale === "en" && resolve(root, page.file) === resolve(context.filename),
                    )
                )
                    return html;
                html = html.replace(
                    /(<link\b[^>]*rel="stylesheet"[^>]*href=")([^"]+)(")/g,
                    (_, start, url, end) =>
                        start + "/__locale/en/style?path=" + encodeURIComponent(url.split("?")[0]) + end,
                );
                return html.replace("</head>", '<link rel="stylesheet" href="/src/css/locales/en-fonts.css"></head>');
            },
        },
        configureServer(server) {
            server.watcher.add(resolve(root, "src/i18n"));
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url || "/", "http://localhost");
                if (url.pathname !== "/__locale/en/style") return next();
                if (req.method !== "GET") {
                    res.statusCode = 405;
                    return res.end();
                }
                const path = url.searchParams.get("path") || "";
                const saved = /^\/assets\/customizer\/template-overrides(?:\.en)?\.css$/.test(path);
                if (!saved && (!/^\/src\/css\/[\w/.-]+\.css$/.test(path) || path.includes(".."))) {
                    res.statusCode = 400;
                    return res.end();
                }
                try {
                    const code = saved
                        ? compileCSS(loadDesignConfig(root, path.endsWith(".en.css") ? "en" : "fa"))
                        : (await server.transformRequest(path + "?direct"))?.code;
                    if (typeof code !== "string") {
                        res.statusCode = 404;
                        return res.end();
                    }
                    res.setHeader("Content-Type", "text/css; charset=utf-8");
                    res.setHeader("Cache-Control", "no-store");
                    res.end(flip(code));
                } catch (error) {
                    next(error);
                }
            });
        },
        handleHotUpdate(context) {
            if (/\/src\/(?:i18n|css)\//.test(context.file.replaceAll("\\", "/")))
                context.server.ws.send({ type: "full-reload" });
        },
        async writeBundle() {
            const mapping = new Map();
            const manifestPath = resolve(directory, ".vite/manifest.json");
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
            for (const page of localizedPages) {
                const file = resolve(directory, page.file);
                let html = readFileSync(file, "utf8");
                if (page.locale === "en") {
                    html = html.replace(
                        /(<link\b[^>]*rel="stylesheet"[^>]*href=")([^"]+)(")/g,
                        (all, start, url, end) => {
                            const original = strip(url);
                            if (!mapping.has(original)) {
                                const css = flip(readFileSync(resolve(directory, original), "utf8"));
                                const hash = createHash("sha256").update(css).digest("hex").slice(0, 12);
                                const path = "assets/locales/en/" + hash + ".css";
                                mkdirSync(dirname(resolve(directory, path)), { recursive: true });
                                writeFileSync(resolve(directory, path), css);
                                mapping.set(original, path);
                            }
                            return (
                                start + base + mapping.get(original) + end + ' data-locale-source="' + original + '"'
                            );
                        },
                    );
                    const fontCss = readFileSync(resolve(root, "src/css/locales/en-fonts.css"), "utf8").replace(
                        /url\((['"]?)\/(fonts|assets)\//g,
                        (_, quote, directory) => "url(" + quote + base + directory + "/",
                    );
                    const fontHash = createHash("sha256").update(fontCss).digest("hex").slice(0, 12);
                    const path = "assets/locales/en/fonts." + fontHash + ".css";
                    writeFileSync(resolve(directory, path), fontCss);
                    html = html.replace("</head>", '<link rel="stylesheet" href="' + base + path + '"></head>');
                }
                if (page.locale === "ar") {
                    const css = readFileSync(resolve(root, "src/css/locales/ar.css"), "utf8");
                    const hash = createHash("sha256").update(css).digest("hex").slice(0, 12);
                    const path = "assets/locales/ar/review." + hash + ".css";
                    mkdirSync(dirname(resolve(directory, path)), { recursive: true });
                    writeFileSync(resolve(directory, path), css);
                    html = html.replace("</head>", '<link rel="stylesheet" href="' + base + path + '"></head>');
                }
                writeFileSync(file, html);
                const entry = manifest[page.file];
                if (entry) {
                    const seen = new Map();
                    const clone = (key) => {
                        if (seen.has(key)) return seen.get(key);
                        const original = manifest[key];
                        if (!original) throw new Error("Missing locale dependency: " + key);
                        const alias = "__" + page.locale + "__" + key;
                        seen.set(key, alias);
                        manifest[alias] = {
                            ...original,
                            ...(original.css
                                ? {
                                      css: original.css.map((css) =>
                                          page.locale === "en" ? mapping.get(css) || css : css,
                                      ),
                                  }
                                : {}),
                            ...(original.imports ? { imports: original.imports.map(clone) } : {}),
                            ...(original.dynamicImports ? { dynamicImports: original.dynamicImports.map(clone) } : {}),
                        };
                        return alias;
                    };
                    entry.imports = (entry.imports || []).map(clone);
                    entry.css = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) =>
                        strip(m[1]),
                    );
                }
            }
            writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
        },
    };
}
