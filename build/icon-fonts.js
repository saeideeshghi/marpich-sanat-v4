import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import subsetFont from "subset-font";

const iconRule = /((?:\.fa-[a-z\d-]+\s*,\s*)*\.fa-[a-z\d-]+)\s*\{\s*--fa:\s*"\\([a-f\d]+)";?\s*\}/g;
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);

export function selectIconRules(css, sources) {
    const names = new Set(sources.flatMap((text) => text.match(/\bfa-[a-z\d-]+\b/g) || []));
    const codes = new Set();
    const icons = new Set();
    const selected = css.replace(iconRule, (rule, selectors, code) => {
        const used = selectors.match(/fa-[a-z\d-]+/g).filter((name) => names.has(name));
        if (!used.length) return "";
        used.forEach((name) => icons.add(name));
        codes.add(parseInt(code, 16));
        return rule;
    });
    if (!codes.size) throw new Error("No authored Font Awesome icons were found");
    return {
        css: selected,
        icons: [...icons].sort(),
        text:
            " " +
            [...codes]
                .sort((a, b) => a - b)
                .map((code) => String.fromCodePoint(code))
                .join(""),
    };
}

// Preserve the original glyph outlines and CSS geometry. Only unused glyphs
// and their character mappings are removed from the delivered font/style.
export async function prepareIconFonts(root, publicRoot, { subset = true } = {}) {
    const sources = [];
    const scan = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = resolve(directory, entry.name);
            if (entry.isDirectory()) scan(path);
            else if (/\.(?:html|js|css|json)$/.test(entry.name)) sources.push(readFileSync(path, "utf8"));
        }
    };
    for (const entry of readdirSync(root))
        if (entry.endsWith(".html")) sources.push(readFileSync(resolve(root, entry), "utf8"));
    for (const name of ["src", "tools"]) scan(resolve(root, name));
    const dependency = resolve(root, "node_modules/@fortawesome/fontawesome-free");
    const subsetVersion = JSON.parse(
        readFileSync(resolve(root, "node_modules/subset-font/package.json"), "utf8"),
    ).version;
    const fullCss = readFileSync(resolve(dependency, "css/fontawesome.css"), "utf8");
    const selected = selectIconRules(fullCss, sources);
    const cache = resolve(root, ".cache/icon-fonts-v1");
    mkdirSync(cache, { recursive: true });
    mkdirSync(resolve(publicRoot, "fonts"), { recursive: true });
    writeFileSync(
        resolve(publicRoot, "fonts/fontawesome-license.txt"),
        readFileSync(resolve(dependency, "LICENSE.txt")),
    );
    let css = subset ? selected.css : fullCss;
    let originalBytes = 0;
    let deliveredBytes = 0;
    for (const [style, weight] of [
        ["solid", 900],
        ["regular", 400],
    ]) {
        const original = readFileSync(resolve(dependency, `webfonts/fa-${style}-${weight}.woff2`));
        const version = hash(
            Buffer.concat([
                original,
                Buffer.from(subset ? `subset-font-${subsetVersion}:${selected.text}` : "complete"),
            ]),
        );
        const name = `fa-${style}-${weight}.${version}.woff2`;
        const cached = resolve(cache, name);
        if (!existsSync(cached))
            writeFileSync(
                cached,
                subset ? await subsetFont(original, selected.text, { targetFormat: "woff2" }) : original,
            );
        const bytes = readFileSync(cached);
        writeFileSync(resolve(publicRoot, "fonts", name), bytes);
        originalBytes += original.length;
        deliveredBytes += bytes.length;
        css += readFileSync(resolve(dependency, `css/${style}.css`), "utf8")
            .replace(/font-display:\s*block;/g, "font-display: swap;")
            .replace(/url\("[^"\n]+\.woff2"\)/g, `url("/fonts/${name}")`);
    }
    const cssPath = resolve(cache, `icons.${hash(css)}.css`);
    writeFileSync(cssPath, css);
    console.log(`Icon fonts: ${selected.icons.length} used icons; ${originalBytes} -> ${deliveredBytes} bytes.`);
    return { cssPath, icons: selected.icons, originalBytes, deliveredBytes };
}
