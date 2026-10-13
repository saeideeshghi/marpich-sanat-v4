import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { collectDesignTokens } from "../build/design-tokens.js";
import { TOKEN_CONTRACTS } from "../src/js/customizer/token-values.js";
import { tokenContract } from "../build/token-contract.js";
import { normalizeZoom, previewGeometry } from "../src/js/customizer/zoom.js";

const tokens = collectDesignTokens(resolve(import.meta.dirname, ".."));
assert.equal(new Set(tokens.map((token) => token.name)).size, tokens.length);
assert(tokens.every((token) => token.description && token.label && token.group));
assert(tokens.every((token) => token.definitions.length || token.usages.length));
assert(tokens.every((token) => !token.name.startsWith("--tw-") && token.name !== "--primary"));
assert.deepEqual(
    tokens
        .filter((token) => token.editable)
        .map((token) => token.name)
        .sort(),
    Object.keys(TOKEN_CONTRACTS)
        .filter((name) => TOKEN_CONTRACTS[name].editable)
        .sort(),
);
const currentContracts = tokenContract(tokens);
const changedContracts = [...new Set([...Object.keys(TOKEN_CONTRACTS), ...Object.keys(currentContracts)])].filter(
    (name) => !isDeepStrictEqual(TOKEN_CONTRACTS[name], currentContracts[name]),
);
assert.equal(
    changedContracts.length,
    0,
    `Token contracts changed: ${changedContracts.slice(0, 10).join(", ")}. Run npm run tokens:refresh after source variable/owner edits, then retry npm run check.`,
);
assert(tokens.find((token) => token.name === "--contact-intro-background").runtime);
assert(
    tokens
        .find((token) => token.name === "--mobile-order")
        .definitions.some((source) => source.file === "projects.html" && source.line > 1),
);
assert.equal(normalizeZoom(900), 200);
assert.equal(normalizeZoom(5), 25);
for (const value of [undefined, null, "", "invalid", Infinity, {}, true]) assert.equal(normalizeZoom(value), "fit");
for (const width of [320, 390, 820, 1440, 7680]) {
    const view = { width, availableWidth: 1100, availableHeight: 700 };
    const fitted = previewGeometry(view);
    for (const zoom of [25, 50, 100, 125, 200, "invalid"]) {
        const preview = previewGeometry({ ...view, zoom });
        assert.equal(preview.width, fitted.width, "Zoom must preserve the responsive viewport width");
        assert.equal(preview.height, fitted.height, "Zoom must preserve viewport height queries");
        assert(Number.isFinite(preview.scale));
        assert.equal(preview.shellWidth, preview.width * preview.scale);
        assert.equal(preview.shellHeight, preview.height * preview.scale);
    }
}
console.log(
    `PASS: ${tokens.length} explained source variables; inline/runtime locations; zoom preserves both viewport dimensions.`,
);
