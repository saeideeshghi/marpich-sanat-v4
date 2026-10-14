import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { preparePublicAssets, cleanupPublicAssets } from "../build/public-assets.js";
import { optimizePublicAssets } from "../build/optimized-assets.js";
import { pages } from "../build/pages.js";
import { renderPage } from "../build/html-partials.js";

const root = resolve(import.meta.dirname, "..");
const publicRoot = preparePublicAssets(root);
await optimizePublicAssets(root, publicRoot);
const references = new Set();

function collectReferences(source) {
    for (const match of source.matchAll(
        /\/(?:assets|fonts)\/[^\s"'`<>;)|]+\.(?:svg|png|webp|jpe?g|gif|avif|ico|ttf|woff2?|otf|pdf|dwg|docx?|zip)/g,
    )) {
        references.add(match[0]);
    }
}

function scan(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, item.name);
        if (item.isDirectory()) scan(path);
        // Component images also live in src/data/pages/*.json; scanning only
        // templates silently misses product cards, testimonials and CTA artwork.
        else if (/\.(html|css|js|json)$/.test(item.name)) {
            collectReferences(readFileSync(path, "utf8"));
        }
    }
}
// Check actual site sources and rendered pages, not fixture URLs in scripts
// or paths recorded by old delivery manifests and documentation.
scan(resolve(root, "src"));
for (const page of pages) {
    collectReferences(renderPage(readFileSync(resolve(root, page.file), "utf8"), page.file, root));
}
if (process.argv.includes("--manifest")) {
    mkdirSync(resolve(root, "docs"), { recursive: true });
    writeFileSync(resolve(root, "docs/assets-manifest.json"), JSON.stringify([...references].sort(), null, 2) + "\n");
}
const missing = [...references].sort().filter((url) => !existsSync(resolve(publicRoot, url.slice(1))));
for (const url of missing) console.log(`MISSING ${relative(root, resolve(root, "public", url.slice(1)))}`);
console.log(`${references.size - missing.length}/${references.size} referenced assets are present.`);
if (missing.length) {
    console.log(
        "Add your original assets to public/assets (legacy root/assets is also supported) and fonts to public/fonts, then run again.",
    );
    process.exitCode = 1;
}
cleanupPublicAssets(root, publicRoot);
