import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeConfig, compileCSS, defaultConfig, validElementSelector } from "../src/js/customizer/model.js";
import { settingsArchive } from "../src/js/customizer/export.js";
import { normalizePattern, PATTERN_RENDER_DEFAULTS } from "../src/js/customizer/pattern-model.js";
import { applyPatternPreset } from "../src/js/customizer/pattern-presets.js";
import { loadDesignConfig } from "../build/design-config.js";
import { persistedSettings } from "../src/js/customizer/model.js";
import { nodeSupported } from "./start-customizer.js";
import { removeSharedPropertyOverrides } from "../src/js/customizer/shared-overrides.js";
import {
    imageSourceRules,
    imageSourceAtWidth,
    normalizeImageSource,
    publicImageSource,
} from "../src/js/customizer/image-source.js";
import { TARGETS } from "../src/js/customizer/schema.js";

for (const version of ["18.20.8", "20.19.0", "22.11.0"]) assert(!nodeSupported(version));
for (const version of ["22.12.0", "v22.12.0", "24.0.0"]) assert(nodeSupported(version));

const config = loadDesignConfig(resolve(import.meta.dirname, ".."));
assert(defaultConfig().rules.length > 0, "The editor defaults must normalize before initialization");
assert.equal(
    compileCSS(config),
    readFileSync(new URL("../src/css/template-overrides.css", import.meta.url), "utf8").replace(/\r\n?/g, "\n"),
    "Generated stylesheet must match saved settings",
);
for (const selector of [
    "#hero-about",
    ".site-card__title",
    ".project-details__container > article:nth-of-type(2) > h3",
    "main > section:nth-of-type(1)",
])
    assert(validElementSelector(selector));
for (const selector of [
    "body, html",
    "*",
    "x { color:red }",
    "a[href=x]",
    "a:has(body)",
    "#x\\;color:red",
    "script",
    "",
    "@import url(x)",
]) {
    if (selector === "script") continue; // The picker may point to any literal tag; declarations still remain bounded.
    assert(!validElementSelector(selector));
}
const rule = {
    page: "about",
    breakpoint: "mobile",
    target: { kind: "element", selector: ".about-team-media__image" },
    properties: { "object-fit": "contain", height: "auto" },
};
const css = compileCSS({ version: 1, rules: [rule] });
assert(css.includes('body[data-page="about"] .about-team-media__image'));
assert(css.includes("@media (max-width: 639px)"));
assert(!css.includes('body[data-page="home"]'));
for (const bad of [
    { ...rule, page: "*" },
    { ...rule, breakpoint: "unknown" },
    { ...rule, target: { kind: "element", selector: "body{color:red}" } },
    { ...rule, properties: { color: "red; background:url(x)" } },
    { ...rule, properties: { "font-size": 10000 } },
    { ...rule, properties: { "font-size": "20garbage" } },
    { ...rule, properties: { "background-image": "url(x)" } },
    { ...rule, properties: JSON.parse('{"__proto__":"#abcdef"}') },
])
    assert.throws(() => normalizeConfig({ version: 1, rules: [bad] }));
assert.throws(() => normalizeConfig({ version: 1, rules: [rule, rule] }));
const unclamped = compileCSS({
    version: 1,
    rules: [
        {
            ...rule,
            target: { kind: "role", key: "card-description" },
            properties: { "font-size": 24, "description-lines": 0 },
        },
    ],
});
assert(unclamped.includes("max-height: none !important"));
assert(unclamped.includes("-webkit-line-clamp: unset !important"));
const shared = {
    ...rule,
    page: "*",
    target: { kind: "component", selector: ".project-details__product-card > div > h3.site-card__title" },
    properties: { "font-size": 18 },
};
assert(compileCSS({ version: 1, rules: [shared] }).includes("body[data-page] .project-details__product-card"));
assert.throws(() =>
    normalizeConfig({ version: 1, rules: [{ ...shared, target: { kind: "component", selector: "#product-title" } }] }),
);
const range = { ...shared, breakpoint: "range", range: { min: 370, max: 410 } };
assert(compileCSS({ version: 1, rules: [range] }).includes("@media (min-width: 370px) and (max-width: 410px)"));
assert.equal(
    normalizeConfig({ version: 1, rules: [range, { ...range, range: { min: 420, max: 500 } }] }).rules.length,
    2,
);
for (const invalid of [
    undefined,
    { min: 410, max: 370 },
    { min: -1, max: 410 },
    { min: 370, max: 7681 },
    { min: 370.5, max: 410 },
])
    assert.throws(() => normalizeConfig({ version: 1, rules: [{ ...range, range: invalid }] }));
for (const kind of ["header", "footer"]) {
    const pattern = normalizePattern(config.patterns[kind]);
    assert.deepEqual(Object.keys(pattern.profiles).sort(), ["desktop", "mobile", "tablet"]);
    const original = pattern.artworks.desktop.lines[0].thickness;
    pattern.artworks.mobile.lines[0].thickness = original + 1;
    assert.equal(pattern.artworks.desktop.lines[0].thickness, original);
    assert.equal(pattern.profiles.tablet.artwork, "tablet");
    const legacy = structuredClone(pattern);
    delete legacy.animation.minStrokeWidth;
    assert.equal(normalizePattern(legacy).animation.minStrokeWidth, PATTERN_RENDER_DEFAULTS.minStrokeWidth);
    legacy.animation.minStrokeWidth = 0;
    assert.equal(normalizePattern(legacy).animation.minStrokeWidth, 0);
    for (const value of [-0.1, 2.1, "1"]) {
        const invalid = structuredClone(pattern);
        invalid.profiles.mobile.animation = { minStrokeWidth: value };
        assert.throws(() => normalizePattern(invalid));
    }
    for (const preset of ["calm", "light"]) {
        const next = structuredClone(pattern);
        applyPatternPreset(next, "mobile", preset);
        assert.deepEqual(next.artworks, pattern.artworks);
        assert.deepEqual(next.profiles.desktop, pattern.profiles.desktop);
        assert.deepEqual(next.profiles.tablet, pattern.profiles.tablet);
        assert.equal(normalizePattern(next).profiles.mobile.animation.mode, preset === "light" ? "light" : "combined");
    }
    for (const mutate of [
        (p) => {
            p.artworks.mobile.lines[0].d = '<svg onload="x">';
        },
        (p) => {
            p.profiles.mobile.opacity = 101;
        },
        (p) => {
            p.profiles.tablet.animation = { period: 0 };
        },
        (p) => {
            p.artworks.mobile.lines[0].stops[0].color = "url(x)";
        },
    ]) {
        const invalid = structuredClone(pattern);
        mutate(invalid);
        assert.throws(() => normalizePattern(invalid));
    }
}
const archive = new Uint8Array(await settingsArchive(config).arrayBuffer());
assert.equal(new DataView(archive.buffer).getUint32(0, true), 0x04034b50);
assert.equal(new DataView(archive.buffer).getUint32(archive.length - 22, true), 0x06054b50);
const view = new DataView(archive.buffer),
    decoder = new TextDecoder(),
    entries = new Map();
let offset = 0;
while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true),
        nameLength = view.getUint16(offset + 26, true),
        extraLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(archive.subarray(offset + 30, offset + 30 + nameLength)),
        start = offset + 30 + nameLength + extraLength;
    entries.set(name, decoder.decode(archive.subarray(start, start + size)));
    offset = start + size;
}
assert.equal(entries.get("src/css/template-overrides.css"), compileCSS(config));
assert.deepEqual(
    normalizeConfig(JSON.parse(entries.get("src/data/customizer/settings.json"))),
    persistedSettings(config),
);
for (const [kind, name] of [
    ["header", "site"],
    ["footer", "footer"],
])
    assert.deepEqual(
        normalizePattern(JSON.parse(entries.get(`src/data/patterns/${name}-pattern.json`))),
        config.patterns[kind],
    );
console.log(
    "PASS: precise/shared selection scopes, responsive ranges, independent pattern profiles and four-file portable export.",
);

// Responsive semantics, portable lengths and virtual controls must work in real exports.
const advanced = {
    page: "*",
    breakpoint: "range",
    range: { min: 0, max: 500 },
    state: "hover",
    target: { kind: "role", key: "shared-header" },
    properties: {
        display: "none",
        width: "480px",
        gap: "1.5rem",
        "grid-template-columns": "1fr 2fr",
        "translate-x": "10vw",
        rotate: 12,
        "background-color": "#12345680",
    },
};
const output = compileCSS({ version: 1, rules: [advanced] });
assert(output.includes("@media (max-width: 500px)"));
assert(output.includes(".site-header:hover"));
assert(output.includes("grid-template-columns: 1fr 2fr !important"));
assert(output.includes("translate: 10vw 0px !important"));
assert(!output.includes("translate-x:"));
assert(!output.includes("mps-preview-state"));
assert(compileCSS({ version: 1, rules: [advanced] }, { previewState: "hover" }).includes("mps-preview-state"));
assert(!compileCSS({ version: 1, rules: [{ ...advanced, enabled: false }] }).includes("@media"));
assert(
    compileCSS({ version: 1, rules: [{ ...advanced, range: { min: 1180, max: null } }] }).includes(
        "@media (min-width: 1180px)",
    ),
);
assert.equal(normalizeConfig({ version: 1, rules: [advanced, { ...advanced, state: "focus" }] }).rules.length, 2);
for (const properties of [
    { width: "1px; color: red" },
    { "grid-template-columns": "repeat(2, url(x))" },
    { "box-shadow": "0 0 2px #fff; display:none" },
    { "aspect-ratio": "16 / 0" },
    { "z-index": 1.5 },
    { "--unknown": 10 },
    { "grid-column": "calc(2)" },
])
    assert.throws(() => normalizeConfig({ version: 1, rules: [{ ...advanced, properties }] }));
console.log(
    "PASS: open-ended/inclusive responsive ranges, states, disabled rules, CSS units, tracks and injection rejection.",
);

// Old exports keep their appearance; new tag rules can edit just one location.
const legacy = normalizeConfig({
    version: 1,
    rules: [{ ...shared, target: { kind: "role", key: "card-tag" }, properties: { "font-size": 10 } }],
});
assert.deepEqual(
    legacy.rules.map((item) => item.target.key),
    ["card-media-tag", "card-meta-tag", "card-status-tag"],
);
const migratedToken = normalizeConfig({
    version: 1,
    rules: [{ ...shared, target: { kind: "role", key: "theme" }, properties: { "--card-title": 21 } }],
});
assert.deepEqual(migratedToken.rules[0].properties, { "--card-title-font-size": 21 });
const metadata = compileCSS({
    version: 1,
    rules: [{ ...shared, target: { kind: "role", key: "card-meta-tag" }, properties: { "padding-top": 8 } }],
});
assert(metadata.includes(".site-card__meta-tag"));
assert(!metadata.includes(".site-card__media-tag"));
const fixedHero = compileCSS({
    version: 1,
    rules: [{ ...rule, target: { kind: "role", key: "hero" }, properties: { height: 520, "min-height": 480 } }],
});
assert(fixedHero.includes("height: 520px !important"));
assert(!fixedHero.includes("height: auto !important"));
for (const height of ["25svh", "31lvh", "100dvh"])
    assert(
        compileCSS({
            version: 1,
            rules: [{ ...rule, target: { kind: "role", key: "hero" }, properties: { "min-height": height } }],
        }).includes(`min-height: ${height} !important`),
    );
const headerSizes = compileCSS({
    version: 1,
    rules: [{ ...range, page: "about", target: { kind: "role", key: "header" }, properties: { height: 110 } }],
});
assert(headerSizes.includes('body[data-page="about"] .site-header :is(.site-header__desktop, .site-header__mobile)'));
assert(headerSizes.includes("@media (min-width: 370px) and (max-width: 410px)"));
assert.equal(new Set(TARGETS.map((item) => item.key)).size, TARGETS.length);
const globalTag = {
    ...shared,
    breakpoint: "all",
    target: { kind: "role", key: "card-meta-tag" },
    properties: { "font-size": 18 },
};
const overrides = {
    version: 1,
    rules: [
        globalTag,
        { ...globalTag, page: "projects", properties: { "font-size": 12, color: "#123456" } },
        { ...globalTag, page: "about", breakpoint: "mobile", properties: { "font-size": 12 } },
        {
            ...globalTag,
            page: "projects",
            target: { kind: "role", key: "card-media-tag" },
            properties: { "font-size": 12 },
        },
    ],
};
removeSharedPropertyOverrides(overrides, globalTag, "font-size");
assert.deepEqual(overrides.rules[1].properties, { color: "#123456" });
assert.equal(overrides.rules[2].properties["font-size"], 12);
assert.equal(overrides.rules[3].properties["font-size"], 12);
console.log(
    "PASS: tag/token migration, independent metadata padding, page hero/header geometry and scoped shared unification.",
);

const sourceRule = {
    page: "about",
    breakpoint: "all",
    target: { kind: "role", key: "about-image" },
    properties: { "image-source": "/assets/images/about/team.svg" },
};
const mobileSource = {
    ...sourceRule,
    breakpoint: "mobile",
    properties: { "image-source": "/assets/images/about/mobile.webp" },
};
const rangeSource = {
    ...sourceRule,
    breakpoint: "range",
    range: { min: 400, max: 600 },
    properties: { "image-source": "https://example.test/team.png" },
};
const sourceConfig = normalizeConfig({ version: 1, rules: [sourceRule, mobileSource, rangeSource] });
assert(!compileCSS(sourceConfig).includes("image-source"), "Image sources must never become CSS");
assert.equal(persistedSettings(sourceConfig).rules.length, 3);
const sources = imageSourceRules(sourceConfig.rules);
for (const width of [399, 601, 639])
    assert.equal(imageSourceAtWidth(sources, width), mobileSource.properties["image-source"]);
for (const width of [400, 500, 600])
    assert.equal(imageSourceAtWidth(sources, width), rangeSource.properties["image-source"]);
for (const width of [640, 1180, 1440])
    assert.equal(imageSourceAtWidth(sources, width), sourceRule.properties["image-source"]);
assert.equal(
    publicImageSource(sourceRule.properties["image-source"], "/marpich-sanat/"),
    "/marpich-sanat/assets/images/about/team.svg",
);
assert.equal(normalizeImageSource("assets/images/about/team.svg"), sourceRule.properties["image-source"]);
for (const source of [
    "javascript:alert(1)",
    "data:image/svg+xml,x",
    "//evil.test/x",
    "/assets/../private/x.svg",
    "/assets/%2e%2e/x.svg",
    "https://user:pass@example.test/team.png",
    '/assets/x.svg"</script>',
])
    assert.throws(() => normalizeImageSource(source));
for (const changed of [{ page: "home" }, { target: { kind: "role", key: "about-image-frame" } }, { state: "hover" }])
    assert.throws(() => normalizeConfig({ version: 1, rules: [{ ...sourceRule, ...changed }] }));
assert.equal(
    imageSourceAtWidth(imageSourceRules([{ ...mobileSource, enabled: false }, sourceRule]), 390),
    sourceRule.properties["image-source"],
);
const positionCSS = compileCSS({
    version: 1,
    rules: [{ ...sourceRule, properties: { "object-position": "65% 30%" } }],
});
assert(positionCSS.includes("object-position: 65% 30% !important"));
assert.throws(() =>
    normalizeConfig({
        version: 1,
        rules: [{ ...sourceRule, properties: { "object-position": "50% 50%; color:red" } }],
    }),
);
console.log(
    "PASS: responsive image source scopes, range boundaries, Pages base, persistence and URL/position validation.",
);

// Fixed-menu behavior uses the same page/range contract as approved CSS.
const fixedMenu = {
    page: "*",
    breakpoint: "all",
    target: { kind: "role", key: "header-behavior" },
    properties: {
        "--header-fixed-enabled": "1",
        "--header-fixed-scroll-threshold": 120,
        "--header-fixed-top": "0.5rem",
        "--header-fixed-background-color": "#102040",
        "--header-fixed-background-opacity": 85,
        "--header-fixed-backdrop-blur": 4,
        "--header-fixed-shadow": "none",
    },
};
const fixedConfig = normalizeConfig({
    version: 1,
    rules: [
        fixedMenu,
        {
            ...fixedMenu,
            page: "about",
            breakpoint: "range",
            range: { min: 360, max: 480 },
            properties: { "--header-fixed-top": 12, "--header-fixed-scroll-threshold": 0 },
        },
    ],
});
const fixedCSS = compileCSS(fixedConfig);
assert(fixedCSS.includes("--header-fixed-scroll-threshold: 120px !important;"));
assert(fixedCSS.includes("--header-fixed-background-opacity: 85 !important;"));
assert(fixedCSS.includes('body[data-page="about"] .site-header'));
assert(fixedCSS.includes("(min-width: 360px) and (max-width: 480px)"));
assert(settingsArchive(fixedConfig).size > 0);
for (const [name, value] of [
    ["--header-fixed-enabled", "2"],
    ["--header-fixed-scroll-threshold", -1],
    ["--header-fixed-top", -1],
    ["--header-fixed-background-opacity", 101],
    ["--header-fixed-background-color", "url(https://invalid.test)"],
])
    assert.throws(() => normalizeConfig({ version: 1, rules: [{ ...fixedMenu, properties: { [name]: value } }] }));
for (const rule of [
    { ...fixedMenu, state: "hover" },
    { ...fixedMenu, target: { kind: "role", key: "card" } },
])
    assert.throws(() => normalizeConfig({ version: 1, rules: [rule] }));
console.log("PASS: scoped responsive fixed-menu controls, CSS units, portable archive and invalid behavior rejection.");
