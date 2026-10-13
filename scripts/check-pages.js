// Check the actual deployable build, including CSS from shared Vite chunks.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pages } from "../build/pages.js";
import { githubPagesBase, readGithubRepository } from "../build/github-pages.js";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const base = githubPagesBase(process.env.GITHUB_REPOSITORY || readGithubRepository(root));
const manifestPath = resolve(dist, ".vite/manifest.json");
assert(existsSync(manifestPath), "Missing Pages build. Run npm run build:pages first.");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function builtFile(path) {
    const file = resolve(dist, path);
    assert(file.startsWith(`${dist}/`) || file.startsWith(`${dist}\\`), `Invalid build path: ${path}`);
    assert(existsSync(file) && statSync(file).isFile(), `Missing built asset: ${path}`);
    assert(statSync(file).size > 0, `Empty built asset: ${path}`);
    return file;
}

function deployedPath(url) {
    assert(url.startsWith(base), `Wrong Pages base in ${url}; expected ${base}`);
    return decodeURIComponent(url.split(/[?#]/, 1)[0].slice(base.length));
}

function entryStyles(key, seen = new Set()) {
    if (seen.has(key)) return [];
    seen.add(key);
    const entry = manifest[key];
    assert(entry, `Missing manifest entry: ${key}`);
    return [...(entry.css || []), ...(entry.imports || []).flatMap((child) => entryStyles(child, seen))];
}

for (const entry of Object.values(manifest)) {
    for (const file of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) builtFile(file);
    for (const dependency of [...(entry.imports || []), ...(entry.dynamicImports || [])])
        assert(manifest[dependency], `Missing JS dependency: ${dependency}`);
}

const files = [...pages.map(({ file }) => file), "tools/customizer.html", "tools/design-tokens.html"];
let stylesheetLinks = 0;
for (const file of files) {
    const html = readFileSync(builtFile(file), "utf8");
    for (const [, srcset] of html.matchAll(/\bsrcset="([^"]+)"/g))
        for (const candidate of srcset.split(",")) {
            const url = candidate.trim().split(/\s+/)[0];
            if (url.startsWith(base)) builtFile(deployedPath(url));
        }
    assert(!html.includes("@include"), `${file}: unbuilt HTML includes`);
    const styles = [...html.matchAll(/<link\b[^>]*>/g)]
        .map(([tag]) => ({ rel: tag.match(/\brel="([^"]+)"/)?.[1], href: tag.match(/\bhref="([^"]+)"/)?.[1] }))
        .filter(({ rel }) => rel === "stylesheet")
        .map(({ href }) => deployedPath(href || ""));
    assert(styles.length > 0, `${file}: no stylesheet links`);
    for (const style of styles) {
        const css = readFileSync(builtFile(style), "utf8");
        assert(!/<(?:!doctype|html)\b/i.test(css), `${file}: stylesheet resolves to HTML: ${style}`);
    }
    const expected = entryStyles(file);
    assert(expected.length > 0, `${file}: no compiled entry styles`);
    for (const style of expected)
        assert(styles.includes(style), `${file}: missing CSS from entry/shared chunk: ${style}`);
    if (pages.some((page) => page.file === file))
        assert(styles.includes("assets/customizer/template-overrides.css"), `${file}: missing approved customizer CSS`);
    const modules = [...html.matchAll(/<script\b[^>]*>/g)]
        .map(([tag]) => ({ type: tag.match(/\btype="([^"]+)"/)?.[1], src: tag.match(/\bsrc="([^"]+)"/)?.[1] }))
        .filter(({ type, src }) => type === "module" && src)
        .map(({ src }) => deployedPath(src));
    assert(modules.includes(manifest[file].file), `${file}: missing compiled JS entry`);
    for (const module of modules) builtFile(module);
    stylesheetLinks += styles.length;
}

console.log(
    `PASS: ${files.length} built Pages entries, ${stylesheetLinks} CSS links, shared chunks and JS files at ${base}`,
);
