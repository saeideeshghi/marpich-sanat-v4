import assert from "node:assert/strict";
import { resolve } from "node:path";
import { collectDesignTokens } from "../build/design-tokens.js";
import { normalizeConfig, compileCSS, ruleAppliesAtWidth, persistedSettings } from "../src/js/customizer/model.js";
import { normalizeTokenValue, tokenRule } from "../src/js/customizer/token-values.js";
import { settingsArchive } from "../src/js/customizer/export.js";

const tokens = collectDesignTokens(resolve(import.meta.dirname, ".."));
// Authored formats (including rgb alpha, shadows, ratios and responsive aliases)
// must remain editable; JavaScript measurements and build-time media stay locked.
for (const token of tokens) {
    for (const definition of token.definitions) {
        if (token.editable && !definition.runtime)
            assert.doesNotThrow(() => normalizeTokenValue(token.name, definition.value), token.name);
    }
    if (!token.editable) assert.throws(() => normalizeTokenValue(token.name, "24px"));
}
assert.equal(normalizeTokenValue("--site-gutter", "۲۴"), "24px");
assert.equal(normalizeTokenValue("--expertise-image-left", "-8%"), "-8%");
assert.equal(normalizeTokenValue("--hero-title-line-height", 1.8), "1.8");
for (const invalid of [
    "24px; color: red",
    "url(https://example.test/x)",
    "var(--unknown)",
    "var(--site-gutter)",
    "calc(20px + expression(x))",
    "24px !important",
    null,
    true,
    [24],
])
    assert.throws(() => normalizeTokenValue("--site-gutter", invalid));
assert.throws(() => normalizeTokenValue("--mobile-order", "1.5"));
const rule = tokenRule("--about-blue-color", {
    page: "about",
    scope: "page",
    breakpoint: "range",
    range: { min: 360, max: 480 },
});
rule.properties["--about-blue-color"] = "rgb(51 102 153 / 0.8)";
const config = normalizeConfig({ version: 1, rules: [rule] });
const css = compileCSS(config);
assert(css.includes("(min-width: 360px) and (max-width: 480px)"));
assert(css.includes('body[data-page="about"] .about-page'));
assert(!css.includes('body[data-page="products"]'));
for (const [width, applies] of [
    [359, false],
    [360, true],
    [480, true],
    [481, false],
])
    assert.equal(ruleAppliesAtWidth(rule, width), applies);
assert.deepEqual(normalizeConfig(persistedSettings(config)), config);
for (const invalid of [
    { ...rule, state: "hover" },
    { ...rule, target: { kind: "token", key: "--not-in-source" } },
    { ...rule, properties: { color: "#fff" } },
    { ...rule, properties: { "--about-blue-color": "#fff", "--site-gutter": "20px" } },
])
    assert.throws(() => normalizeConfig({ version: 1, rules: [invalid] }));
const archived = Buffer.from(await settingsArchive(config).arrayBuffer());
assert(archived.includes(Buffer.from('"kind": "token"')));
assert(archived.includes(Buffer.from("--about-blue-color: rgb(51 102 153 / 0.8) !important")));
console.log(
    `PASS: ${tokens.filter((token) => token.editable).length} variable contracts, authored value formats, local owners, responsive bounds, locked outputs and portable export.`,
);
