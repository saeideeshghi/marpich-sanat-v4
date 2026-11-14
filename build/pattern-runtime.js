import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizePattern } from "../src/js/customizer/pattern-model.js";

// Export identical objects/long strings once. The studio's editable JSON stays
// intact; the public player no longer downloads several copies of each path.
export function compilePatternModule(input) {
    const declarations = [],
        shared = new Map();
    function serialize(value) {
        if (!value || typeof value !== "object") {
            if (typeof value !== "string" || value.length < 80) return JSON.stringify(value);
        }
        const key = JSON.stringify(value);
        if (shared.has(key)) return shared.get(key);
        const expression =
            typeof value === "string"
                ? key
                : Array.isArray(value)
                  ? `[${value.map(serialize).join(",")}]`
                  : `{${Object.entries(value)
                        .map(([k, v]) => `${JSON.stringify(k)}:${serialize(v)}`)
                        .join(",")}}`;
        const name = `p${declarations.length}`;
        declarations.push(`const ${name}=${expression};`);
        shared.set(key, name);
        return name;
    }
    const config = serialize(normalizePattern(input));
    return `${declarations.join("\n")}\nexport default ${config};\n`;
}

export function runtimePatterns(root) {
    const names = { header: "site-pattern", footer: "footer-pattern" };
    let base = "/";
    return {
        name: "marpich-runtime-patterns",
        configResolved(config) {
            base = config.base;
        },
        resolveId(id) {
            return /^virtual:site-pattern\/(header|footer)$/.test(id) ? `\0${id}` : null;
        },
        load(id) {
            const kind = id.match(/^\0virtual:site-pattern\/(header|footer)$/)?.[1];
            if (!kind) return null;
            const path = resolve(root, `src/data/patterns/${names[kind]}.json`);
            this.addWatchFile(path);
            return compilePatternModule(JSON.parse(readFileSync(path, "utf8")));
        },
        // Preload only the visible header's data/player. Images can download
        // concurrently; the offscreen footer remains lazy and independent.
        generateBundle: {
            order: "post",
            handler(_, bundle) {
                const chunks = Object.values(bundle).filter(
                    (item) =>
                        item.type === "chunk" &&
                        (item.facadeModuleId === "\0virtual:site-pattern/header" ||
                            item.facadeModuleId?.replaceAll("\\", "/").endsWith("/src/js/components/site-pattern.js")),
                );
                if (!chunks.length) return;
                const links = chunks
                    .map((chunk) => `<link rel="modulepreload" crossorigin href="${base}${chunk.fileName}" />`)
                    .join("\n");
                for (const asset of Object.values(bundle)) {
                    if (asset.type !== "asset" || !asset.fileName.endsWith(".html")) continue;
                    const html = String(asset.source);
                    if (!/<body\b[^>]*data-page=["'](?!home["'])/.test(html)) continue;
                    asset.source = html.replace("</head>", `${links}\n</head>`);
                }
            },
        },
    };
}
