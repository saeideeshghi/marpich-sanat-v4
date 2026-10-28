import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pages, localizedPages } from "../build/pages.js";
import { renderPage } from "../build/html-partials.js";
import { dictionary, translateText, localeUrl, localizedRuntime } from "../build/localization.js";
import { normalizeMessage, runtimeMessages } from "../build/i18n-runtime-tools.js";
const root = resolve(import.meta.dirname, "..");
const json = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const source = json("src/i18n/source.json"),
    runtime = json("src/i18n/runtime-source.json");
assert.equal(source.length, new Set(source).size, "Unique message IDs");
assert.equal(runtime.length, new Set(runtime).size, "Unique runtime messages");
for (const locale of ["en", "ar"]) {
    const messages = dictionary(root, locale);
    assert.deepEqual(Object.keys(messages).sort(), [...source].sort(), locale + ": complete dictionary");
    for (const key of source) {
        assert.equal(key, normalizeMessage(key));
        assert(typeof messages[key] === "string" && messages[key].trim(), locale + ": empty translation");
        assert.deepEqual(
            messages[key].match(/\{\d+\}/g) || [],
            key.match(/\{\d+\}/g) || [],
            "Retain message parameters: " + key,
        );
    }
    for (const key of runtime) assert(source.includes(key));
}
const shape = (html) =>
    [
        ...html
            .replace(/<script type="application\/json" id="site-locale-messages">[\s\S]*?<\/script>/g, "")
            .matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi),
    ].map((m) =>
        [m[1], ...m[2].matchAll(/\b(?:class|id|data-[\w-]+)="[^"]*"/g)]
            .map(String)
            .filter((s) => !s.startsWith("data-locale=")),
    );
for (const page of pages) {
    const original = readFileSync(resolve(root, page.file), "utf8");
    const rendered = renderPage(original, resolve(root, page.file), root);
    for (const locale of ["en", "ar"]) {
        const translated = renderPage("", resolve(root, locale, page.file), root);
        assert.deepEqual(shape(translated), shape(rendered), "Same template structure: " + locale + "/" + page.file);
        assert(translated.includes('lang="' + locale + '" dir="' + (locale === "en" ? "ltr" : "rtl") + '"'));
        for (const language of ["fa", "en", "ar", "x-default"])
            assert(translated.includes('hreflang="' + language + '"'));
        assert(/<span\b[^>]*lang="fa"[^>]*>\s*فارسی<\/span/.test(translated), "Keep native language labels");
        if (locale === "en") assert(/<dialog\b[^>]*dir="ltr"/.test(translated), "English dialog direction");
        for (const href of translated.matchAll(/href="(\/(?:en|ar)\/[^"?#]+\.html)/g))
            assert(
                localizedPages.some((p) => "/" + p.file === href[1]),
                "Existing translated route: " + href[1],
            );
    }
}
assert.equal(
    translateText(" نمونه ", { نمونه: '<img src=x onerror="alert(1)">' }),
    " &lt;img src=x onerror=&quot;alert(1)&quot;&gt; ",
);
assert.throws(() => translateText("ترجمه نشده", {}), /Missing translation/);
assert.equal(translateText("۱۴۰۰", { "۱۴۰۰": "1400" }), "1400");
for (const route of [
    ["../index.html", "en"],
    ["index.html", "fr"],
    ["https://bad.test", "ar"],
])
    assert.throws(() => localeUrl(...route));
const plugin = localizedRuntime(root);
function walk(path) {
    return readdirSync(path, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(resolve(path, e.name)) : [resolve(path, e.name)],
    );
}
for (const file of ["src/js/components", "src/js/pages", "src/js/services"]
    .flatMap((p) => walk(resolve(root, p)))
    .filter((f) => f.endsWith(".js") && !f.endsWith("i18n.js"))) {
    const code = readFileSync(file, "utf8");
    for (const message of runtimeMessages(code, file))
        assert(runtime.includes(message.key), "Runtime catalog covers " + message.key);
    const result = plugin.transform(code, file);
    if (result) assert(result.code.startsWith("import {t as __mpsT"));
}
// The native digit maps used by OTP/auth normalization must never be translated.
assert.equal(runtimeMessages('const digits="۰۱۲۳۴۵۶۷۸۹"; const sms="٠١٢٣٤٥٦٧٨٩";', "digits.js").length, 0);
const previous = globalThis.document;
try {
    for (const locale of ["fa", "en", "ar"]) {
        const messages = locale === "fa" ? {} : dictionary(root, locale);
        globalThis.document = {
            documentElement: { lang: locale },
            getElementById: () => ({ textContent: JSON.stringify(messages) }),
        };
        const { t, tf } = await import("../src/js/services/i18n.js?test=" + locale);
        const key = "{0} مقاله نمایش داده می‌شود.";
        const output = tf(key, [12]);
        assert(output.includes(locale === "ar" ? "١٢" : "12"), "Explicit numeral system: " + locale);
        if (locale === "fa") assert.equal(t("  ورود  "), "  ورود  ");
        else {
            assert.throws(() => t("unregistered"));
            assert.equal(t("  ورود  "), "  " + messages["ورود"] + "  ");
        }
    }
} finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
}
console.log(
    "PASS: " +
        source.length +
        " messages × 2 languages, all 36 shared templates, parameter/HTML escaping and runtime number/digit handling.",
);
