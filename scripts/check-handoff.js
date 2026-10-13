// Regression checks for the integration bugs corrected in this handoff.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderComponent, validateContentUrl } from "../build/components.js";
import { publicAssetBase } from "../build/public-asset-base.js";
import { normalizeSearchText } from "../src/js/utils/search-text.js";
const root = resolve(import.meta.dirname, "..");
for (const url of ["javascript:alert(1)", "data:text/html,x", "java\nscript:x", "//external.test/x", "\\evil.test/x"])
    assert.throws(() => validateContentUrl(url));
for (const url of ["#", "/products/fan", "product-details.html", "https://example.com/file", "mailto:a@example.com"])
    assert.equal(validateContentUrl(url), url);
assert.throws(() => validateContentUrl("mailto:a@example.com", true));
const data = JSON.parse(readFileSync(resolve(root, "src/data/pages/products.json")));
const search = renderComponent("search-panel", { ...data.search, id: "second-search" }, root);
assert(search.includes('id="second-search"'), "Search must use its supplied unique ID");
assert.throws(() => renderComponent("product-cards", [{ ...data.products[0], href: "javascript:alert(1)" }], root));
const faq = JSON.parse(readFileSync(resolve(root, "src/data/pages/industry-textile.json"))).faq;
const output = renderComponent("faq", { ...faq, href: "/faq", linkText: "FAQ destination" }, root);
assert(output.includes('href="/faq"') && output.includes("FAQ destination"), "FAQ must use its data link");

// The Pages base also applies to runtime fallbacks, not only visible src/href.
const assetPlugin = publicAssetBase("/marpich-sanat/");
const markup =
    '<img src="/assets/main.svg" data-fallback="/assets/backup.svg" data-image-candidates="/assets/first.svg|/assets/second.svg" srcset="/assets/small.svg 1x, /assets/large.svg 2x" />';
const transformed = assetPlugin.transformIndexHtml.handler(markup);
assert(transformed.includes('data-fallback="/marpich-sanat/assets/backup.svg"'));
assert(
    transformed.includes('data-image-candidates="/marpich-sanat/assets/first.svg|/marpich-sanat/assets/second.svg"'),
);
assert(transformed.includes('srcset="/marpich-sanat/assets/small.svg 1x, /marpich-sanat/assets/large.svg 2x"'));
assert.equal(assetPlugin.transformIndexHtml.handler(transformed), transformed, "Asset prefix must not duplicate");

// Match the user's spelling, without changing native identifiers or display text.
assert.equal(normalizeSearchText("تهویه صنعتی"), normalizeSearchText("تَهْوِيه صِنْعَتي"));
assert.equal(normalizeSearchText("کانال‌کشی"), normalizeSearchText("كانال كشي"));
assert.equal(normalizeSearchText("مدل ۱۲۳"), normalizeSearchText("مدل ١٢٣"));
assert.equal(normalizeSearchText("Air Handling"), normalizeSearchText("AIR HANDLING"));
assert.equal(normalizeSearchText(null), "");
console.log("PASS: URL validation, search/FAQ rendering, Pages image fallbacks and Persian/Arabic search matching.");
