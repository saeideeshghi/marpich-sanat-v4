import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { preparePublicAssets, cleanupPublicAssets } from "../build/public-assets.js";
import { optimizePublicAssets } from "../build/optimized-assets.js";
import { pages } from "../build/pages.js";
import { renderPage } from "../build/html-partials.js";
import assert from "node:assert/strict";
import sharp from "sharp";
import { expertisePhoto } from "../build/expertise-assets.js";

const root = resolve(import.meta.dirname, "..");
const publicRoot = preparePublicAssets(root);
for (const name of [
    "assessment-consulting",
    "engineering-design",
    "advanced-manufacturing",
    "site-project-management",
    "testing-commissioning",
]) {
    const filename = `${name}.svg`;
    const original = readFileSync(resolve(root, "assets/images/expertise", filename), "utf8");
    const photo = readFileSync(resolve(publicRoot, "assets/images/expertise", filename), "utf8");
    assert.notEqual(photo, original, `${filename}: exported frame must be removed`);
    assert(!/<filter\b|<mask\b|\brx=|shape-rendering=/.test(photo), "No exported shadow or rounded pixel boundary");
    const embeddedImage = (svg) => svg.match(/<image\b[^>]*\/>/)[0];
    const pattern = (svg) => svg.match(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/)[0];
    assert.equal(embeddedImage(photo), embeddedImage(original), "Original photograph bytes are unchanged");
    assert.equal(pattern(photo), pattern(original), "Original photograph transform is unchanged");
    assert.equal(expertisePhoto(photo, filename), photo, "Preparation must be idempotent");
    assert.equal(expertisePhoto(original, "custom.svg"), original, "Unrelated artwork is preserved");
    const custom = '<svg viewBox="0 0 500 300"><image href="owner-photo.png"/></svg>';
    assert.equal(expertisePhoto(custom, filename), custom, "Custom artwork is preserved");
    const pixels = await sharp(Buffer.from(photo)).ensureAlpha().raw().toBuffer();
    for (let index = 3; index < pixels.length; index += 4)
        assert.equal(pixels[index], 255, `${filename}: transparent gutters or rounded edges remain`);
    assert.equal(readFileSync(resolve(root, "assets/images/expertise", filename), "utf8"), original);
}
console.log("PASS: all five expertise photographs have opaque edges, original photo pixels and no baked frame.");
const optimized = await optimizePublicAssets(root, publicRoot);
for (const [url, sources] of Object.entries(optimized.responsiveMap)) {
    if (!url.startsWith("/assets/images/expertise/") || !url.endsWith(".svg")) continue;
    const svg = readFileSync(resolve(publicRoot, url.slice(1)), "utf8");
    if (!svg.includes('data-expertise-photo="true"')) continue;
    for (const source of sources.split(", ")) {
        const variant = source.split(" ")[0];
        if (!variant.endsWith(".webp")) continue;
        const pixels = await sharp(readFileSync(resolve(publicRoot, variant.slice(1))))
            .ensureAlpha()
            .raw()
            .toBuffer();
        let minimum = 255;
        for (let index = 3; index < pixels.length; index += 4) minimum = Math.min(minimum, pixels[index]);
        assert.equal(minimum, 255, `${variant}: responsive encoding must not reintroduce transparent edges`);
    }
}
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
