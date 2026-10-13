// Vite rewrites existing public files. Keep unresolved images/downloads and
// image fallback candidates under the same base, even before artwork is added.
export function publicAssetBase(base) {
    if (base === "/") return [];
    const prefix = (value) => value.replace(/(^|[\s,|])\/(assets|fonts)\//g, `$1${base}$2/`);
    return {
        name: "marpich-public-asset-base",
        transformIndexHtml: {
            order: "post",
            handler(html) {
                return html.replace(
                    /\b(src|href|poster|srcset|data-image-candidates|data-fallback)=(['"])(.*?)\2/gs,
                    (_, attribute, quote, value) => `${attribute}=${quote}${prefix(value)}${quote}`,
                );
            },
        },
        generateBundle(_, bundle) {
            for (const entry of Object.values(bundle)) {
                if (entry.type === "asset" && entry.fileName.endsWith(".css")) {
                    entry.source = String(entry.source).replace(
                        /url\((['"]?)\/(assets|fonts)\//g,
                        (_, quote, directory) => `url(${quote}${base}${directory}/`,
                    );
                }
            }
        },
    };
}
