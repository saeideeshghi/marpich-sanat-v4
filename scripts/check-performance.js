import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";
import { compilePatternModule } from "../build/pattern-runtime.js";
import { normalizePattern } from "../src/js/customizer/pattern-model.js";
import { optimizePublicAssets, optimizedImages } from "../build/optimized-assets.js";
import { compositorFrames } from "../src/js/components/product-category-motion.js";
import { selectIconRules, prepareIconFonts } from "../build/icon-fonts.js";
import { isSvgPhoto, responsiveSvgPhoto } from "../build/svg-photos.js";

const root = resolve(import.meta.dirname, "..");
const selected = selectIconRules(
    '.fa-user { --fa: "\\f007"; } .fa-user-alt, .fa-person { --fa: "\\f008"; } .fa-star { --fa: "\\f005"; }',
    ['<i class="fa-solid fa-user"></i>', 'icon.className = "fa-person"'],
);
assert.deepEqual(selected.icons, ["fa-person", "fa-user"]);
assert(!selected.css.includes("fa-star"));
assert(selected.text.includes(String.fromCodePoint(0xf007)) && selected.text.includes(String.fromCodePoint(0xf008)));
for (const alignment of ["left", "right"]) {
    const initial = {
        left: "30px",
        right: alignment === "right" ? "20px" : "",
        top: "10px",
        width: "100px",
        height: "50px",
    };
    const target = {
        ...(alignment === "right" ? { right: "80px" } : { left: "80px" }),
        top: "45px",
        width: "300px",
        height: "150px",
        borderRadius: "12px",
        offset: 1,
    };
    const frame = compositorFrames([target], initial)[0];
    const [dx, dy, sx, sy] = [...frame.transform.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
    assert.equal(100 * sx, 300);
    assert.equal(50 * sy, 150);
    assert.equal(10 + dy, 45);
    assert.equal(alignment === "right" ? 20 - dx : 30 + dx, 80);
    assert.equal(frame.borderRadius, "4px / 4px");
    assert.equal(frame.offset, 1);
    assert.equal(target.width, "300px", "Input frames remain immutable");
}
for (const name of ["site-pattern", "footer-pattern"]) {
    const source = JSON.parse(readFileSync(resolve(root, `src/data/patterns/${name}.json`)));
    const compiled = compilePatternModule(source);
    const imported = (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)).default;
    assert.deepEqual(imported, normalizePattern(source), "Runtime compaction must preserve every setting and path");
    assert(compiled.length < JSON.stringify(source).length / 2, "Remove duplicate artwork/path data");
    console.log(`${name}: ${JSON.stringify(source).length} -> ${compiled.length} bytes`);
}
const fixture = mkdtempSync(resolve(tmpdir(), "marpich-assets-"));
try {
    const publicRoot = resolve(fixture, "public");
    mkdirSync(resolve(publicRoot, "assets"), { recursive: true });
    const pixels = Buffer.alloc(256 * 256 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = (i / 4) % 256;
        pixels[i + 1] = Math.floor(i / 1024);
        pixels[i + 2] = 37;
        pixels[i + 3] = (i / 4) % 255;
    }
    const png = await sharp(pixels, { raw: { width: 256, height: 256, channels: 4 } })
        .png({ compressionLevel: 0 })
        .toBuffer();
    const original = resolve(publicRoot, "assets/photo.png");
    writeFileSync(original, png);
    const first = await optimizePublicAssets(fixture, publicRoot);
    assert(first.imageMap["/assets/photo.png"]);
    const derived = readFileSync(`${original}.webp`);
    // WebP may discard RGB under alpha=0; those colours cannot be displayed.
    // Every alpha value and every visible pixel must remain byte-identical.
    const visible = async (bytes) => {
        const raw = await sharp(bytes).ensureAlpha().raw().toBuffer();
        for (let i = 0; i < raw.length; i += 4) if (raw[i + 3] === 0) raw.fill(0, i, i + 3);
        return raw;
    };
    assert.deepEqual(
        await visible(derived),
        await visible(png),
        "Lossless visible RGBA pixels, including transparency",
    );
    assert.deepEqual(readFileSync(original), png, "Owner's original is untouched");
    const hero = resolve(publicRoot, "assets/images/hero/hero-engineers.png");
    mkdirSync(resolve(hero, ".."), { recursive: true });
    const heroSource = await sharp(png).resize(2400, 2000).png({ compressionLevel: 0 }).toBuffer();
    writeFileSync(hero, heroSource);
    const responsive = await optimizePublicAssets(fixture, publicRoot);
    const sources = responsive.responsiveMap["/assets/images/hero/hero-engineers.png"];
    assert(sources.includes("960w") && sources.includes("1440w") && sources.includes("1920w"));
    for (const width of [960, 1440, 1920]) {
        const url = sources
            .split(", ")
            .find((candidate) => candidate.endsWith(` ${width}w`))
            .split(/\s+/)[0];
        const variant = readFileSync(resolve(publicRoot, url.slice(1)));
        assert.equal((await sharp(variant).metadata()).width, width);
        const expectedAlpha = await sharp(heroSource).resize({ width }).extractChannel("alpha").raw().toBuffer();
        const actualAlpha = await sharp(variant).extractChannel("alpha").raw().toBuffer();
        assert.deepEqual(actualAlpha, expectedAlpha, "Responsive photos preserve resized alpha exactly");
        assert(variant.length < heroSource.length / 10, "Photographic delivery is substantially smaller");
    }
    assert.deepEqual(readFileSync(hero), heroSource, "Responsive encoding does not change the original");
    const svg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><image href="data:image/png;base64,${png.toString("base64")}" width="256" height="256"/></svg>`,
    );
    const photoUrl = "/assets/images/about/about-team.svg";
    mkdirSync(resolve(publicRoot, "assets/images/about"), { recursive: true });
    assert(isSvgPhoto(photoUrl, svg.toString()));
    assert(!isSvgPhoto("/assets/icons/test.svg", svg.toString()));
    assert(!isSvgPhoto("/assets/images/projects/project-details/system-diagram.svg", svg.toString()));
    const photos = await responsiveSvgPhoto(
        svg,
        photoUrl,
        { width: 256, height: 256 },
        publicRoot,
        resolve(fixture, ".cache"),
    );
    const originalRender = await sharp(svg).png().toBuffer();
    assert.deepEqual(
        await visible(readFileSync(resolve(publicRoot, photos.src.slice(1)))),
        await visible(originalRender),
        "SVG delivery preserves every visible pixel and alpha",
    );
    assert(
        photos.srcset.includes("480w") && photos.srcset.includes(`${photoUrl} 1920w`),
        "Keep large scalable originals available",
    );
    const icons = await prepareIconFonts(root, publicRoot);
    assert(icons.deliveredBytes < icons.originalBytes / 4, "Unused glyphs must not be downloaded");
    const plugin = optimizedImages(responsive.imageMap, responsive.responsiveMap);
    const markup = '<img src="/assets/images/hero/hero-engineers.png" class="hero-image" fetchpriority="high" />';
    assert(plugin.transformIndexHtml.handler(markup).includes('srcset="'));
    assert(
        !plugin.transformIndexHtml
            .handler(markup.replace('class="hero-image"', 'class="cms-summary"'))
            .includes('srcset="'),
    );
    const dimensionPlugin = optimizedImages({}, {}, { "/assets/photo.png": { width: 256, height: 256 } });
    assert(
        dimensionPlugin.transformIndexHtml
            .handler('<img src="/assets/photo.png" />')
            .includes('width="256" height="256"'),
    );
    assert(
        !dimensionPlugin.transformIndexHtml
            .handler('<img src="/assets/photo.png" width="100" height="100" />')
            .includes('width="256"'),
    );
    const second = await optimizePublicAssets(fixture, publicRoot);
    assert.deepEqual(second.imageMap, responsive.imageMap, "Repeat builds produce the same map");
    assert.deepEqual(second.responsiveMap, responsive.responsiveMap);
    assert.deepEqual(readFileSync(`${original}.webp`), derived);
} finally {
    rmSync(fixture, { recursive: true, force: true });
}
console.log(
    "PASS: exact pattern settings, lossless image pixels/transparency, source preservation and repeatable encoding.",
);
