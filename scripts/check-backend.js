import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pages } from "../build/pages.js";
import { backendHeaders } from "../build/security-headers.js";

const root = resolve(import.meta.dirname, "../dist/backend");
const manifest = JSON.parse(readFileSync(resolve(root, ".vite/manifest.json")));
const assets = {};
for (const page of pages) {
    const entry = manifest[page.file];
    assert(entry, `Missing ${page.file} manifest entry`);
    const html = readFileSync(resolve(root, page.file), "utf8");
    for (const [, srcset] of html.matchAll(/\bsrcset="([^"]+)"/g))
        for (const candidate of srcset.split(",")) {
            const url = candidate.trim().split(/\s+/)[0];
            if (url.startsWith("/assets/"))
                assert(existsSync(resolve(root, url.slice(1))), `${page.file}: missing responsive image ${url}`);
        }
    assert(!html.includes("@include") && !html.includes("/src/"), `${page.file}: unresolved source`);
    assert(!html.includes('as="font"'), `${page.file}: unexpected font preload`);
    const css = [...html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/g)]
        .map((m) => m[1])
        .filter((h) => /\.css(?:\?|$)/.test(h));
    const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)].map((m) => m[1]);
    assert(css.length >= 3 && scripts.length === 1, `${page.file}: CSS and JS must be resolvable before rendering`);
    const preloads = [...html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    if (page.name !== "home")
        assert(
            preloads.some((url) => /\/header-/.test(url)),
            `${page.file}: preload the header pattern`,
        );
    else assert(!preloads.some((url) => /\/header-/.test(url)), "Home must not download an unused header pattern");
    for (const url of preloads)
        assert(existsSync(resolve(root, url.replace(/^\//, ""))), `Missing preloaded module ${url}`);
    for (const url of [...css, ...scripts])
        assert(existsSync(resolve(root, url.split("?")[0].replace(/^\//, ""))), `Missing ${url}`);
    const imagePreloads = [...html.matchAll(/<link\b[^>]*rel="preload"[^>]*as="image"[^>]*href="([^"]+)"/g)].map(
        (m) => m[1],
    );
    for (const url of imagePreloads)
        assert(existsSync(resolve(root, url.replace(/^\//, ""))), `Missing preloaded image ${url}`);
    assets[page.name] = { html: page.file, script: scripts[0], css, modulePreloads: preloads, imagePreloads };
}
assert(!existsSync(resolve(root, "tools")), "Internal editor must not be deployed with public backend views");
assert(!existsSync(resolve(root, "assets/customizer/settings.json")), "Do not publish editable studio configuration");
const imageMap = JSON.parse(readFileSync(resolve(root, "assets/image-manifest.json")));
for (const variant of Object.values(imageMap))
    assert(existsSync(resolve(root, variant.slice(1))), `Missing image variant ${variant}`);
writeFileSync(resolve(root, "page-assets.json"), JSON.stringify(assets, null, 2) + "\n");
writeFileSync(resolve(root, "security-headers.json"), JSON.stringify(backendHeaders, null, 2) + "\n");
console.log(
    `PASS: ${pages.length} backend views, ordered CSS/JS manifests, image variants and no public editor/configuration.`,
);
