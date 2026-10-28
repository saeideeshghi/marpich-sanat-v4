import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import postcss from "postcss";
import { localizedPages } from "./pages.js";
import { compileCSS } from "../src/js/customizer/model.js";
import { loadDesignConfig } from "./design-config.js";
function flip(css) {
    const ast = postcss.parse(css);
    ast.walkAtRules("font-face", (rule) => {
        if (rule.nodes.some((n) => n.prop === "font-family" && /Peyda/.test(n.value))) rule.remove();
    });
    ast.walkDecls((decl) => {
        if (decl.prop === "--font-peyda") decl.value = decl.value.replace(/Peyda/g, "D-DIN");
        if (decl.prop.startsWith("--")) return;
        decl.prop = decl.prop.replace(/left|right/g, (word) => (word === "left" ? "right" : "left"));
        if (/^(?:text-align|text-align-last|float|clear|background-position|object-position)$/.test(decl.prop))
            decl.value = decl.value.replace(/\bleft\b|\bright\b/g, (word) => (word === "left" ? "right" : "left"));
        if (decl.prop === "direction" && decl.value === "rtl") decl.value = "ltr";
        if (/^background(?:-image)?$/.test(decl.prop))
            decl.value = decl.value.replace(
                /linear-gradient\(\s*(90|270)deg/g,
                (_, angle) => "linear-gradient(" + (angle === "90" ? "270" : "90") + "deg",
            );
        if (decl.prop === "font-family") decl.value = decl.value.replace(/Peyda/g, "D-DIN");
        if (decl.prop === "transform")
            decl.value = decl.value.replace(
                /translateX\((-?[\d.]+(?:%|px|rem)?)\)/g,
                (_, value) => "translateX(" + (value.startsWith("-") ? value.slice(1) : "-" + value) + ")",
            );
        if (/^(?:margin|padding|border-width|border-style|border-color)$/.test(decl.prop)) {
            const values = postcss.list.space(decl.value);
            if (values.length === 4) decl.value = [values[0], values[3], values[2], values[1]].join(" ");
        }
        if (decl.prop === "border-radius") {
            decl.value = decl.value
                .split("/")
                .map((part) => {
                    const v = postcss.list.space(part.trim());
                    if (v.length === 4) return [v[1], v[0], v[3], v[2]].join(" ");
                    if (v.length === 3) return [v[1], v[0], v[1], v[2]].join(" ");
                    if (v.length === 2) return [v[1], v[0]].join(" ");
                    return part;
                })
                .join(" / ");
        }
    });
    return ast.toString();
}
const strip = (url) => url.split(/[?#]/)[0].replace(/^\//, "");
export function localeOutput(root) {
    let directory;
    let building = false;
    return {
        name: "marpich-locale-output",
        enforce: "post",
        configResolved(config) {
            directory = resolve(root, config.build.outDir);
            building = config.command === "build";
        },
        transformIndexHtml: {
            order: "post",
            handler(html, context) {
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
                const saved = path === "/assets/customizer/template-overrides.css";
                if (!saved && (!/^\/src\/css\/[\w/.-]+\.css$/.test(path) || path.includes(".."))) {
                    res.statusCode = 400;
                    return res.end();
                }
                try {
                    const code = saved
                        ? compileCSS(loadDesignConfig(root))
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
                            return start + "/" + mapping.get(original) + end + ' data-locale-source="' + original + '"';
                        },
                    );
                    const fontCss = readFileSync(resolve(root, "src/css/locales/en-fonts.css"), "utf8");
                    const fontHash = createHash("sha256").update(fontCss).digest("hex").slice(0, 12);
                    const path = "assets/locales/en/fonts." + fontHash + ".css";
                    writeFileSync(resolve(directory, path), fontCss);
                    html = html.replace("</head>", '<link rel="stylesheet" href="/' + path + '"></head>');
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
