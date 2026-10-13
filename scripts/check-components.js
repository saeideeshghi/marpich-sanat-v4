import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { renderComponent } from "../build/components.js";
import { renderPage } from "../build/html-partials.js";

const root = resolve(import.meta.dirname, "..");
const hostile = '<script>alert("x")</script>&';
const faq = {
    id: "first",
    sectionClass: "",
    titleClass: "",
    title: hostile,
    href: "#",
    linkText: "more",
    initialOpen: 0,
    items: [
        { question: hostile, answer: hostile },
        { question: "second", answer: "answer" },
    ],
};
const one = renderComponent("faq", faq, root);
const two = renderComponent("faq", { ...faq, id: "second" }, root);
assert(!one.includes("<script>"), "Text content must be HTML escaped");
assert(one.includes("&lt;script&gt;"));
const ids = [...(one + two).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(ids.length, new Set(ids).size, "Independent FAQ IDs must not collide");
assert.equal((one.match(/aria-expanded="true"/g) || []).length, 1);
assert.throws(() => renderComponent("not-a-component", {}, root));
const product = renderComponent(
    "product-cards",
    [
        {
            image: "/assets/sample.svg",
            alt: "sample",
            category: "category",
            title: "title",
            description: "description",
            specs: ["specification"],
            href: "product-details.html",
            linkText: "more",
        },
    ],
    root,
);
assert(product.includes("product-card__category site-card__media-tag"));
assert(product.includes("product-card__spec site-card__meta-tag"));
assert(!product.includes("site-card__tag"));
assert(one.includes("site-faq__answer"));
for (const file of ["index.html", "about.html", "expertise.html"]) {
    const html = renderPage(readFileSync(resolve(root, file), "utf8"), file, root);
    assert.equal(
        (html.match(/data-pending-form/g) || []).length,
        2,
        `${file}: both original consultation layouts in a single component`,
    );
    assert(!html.includes("{{"), `${file}: unresolved template`);
}
console.log(
    "PASS: escaped component content, independent FAQ IDs, known templates and preserved consultation layouts.",
);
