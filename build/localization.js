import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { escapeHtml } from "./components.js";
import { normalizeMessage, hasPersianText, runtimeMessages } from "./i18n-runtime-tools.js";
export const locales = ["fa", "en", "ar"];
const decode = (value) =>
    value
        .replace(/&#(x[\da-f]+|\d+);/gi, (_, v) =>
            String.fromCodePoint(
                parseInt(v[0].toLowerCase() === "x" ? v.slice(1) : v, v[0].toLowerCase() === "x" ? 16 : 10),
            ),
        )
        .replace(/&nbsp;/g, "\u00a0")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
export function dictionary(root, locale) {
    if (!["en", "ar"].includes(locale)) throw new Error("Unsupported localization");
    return JSON.parse(readFileSync(resolve(root, "src/i18n", locale + ".json"), "utf8"));
}
export function translateText(raw, messages) {
    const key = normalizeMessage(decode(raw));
    if (!hasPersianText(key) && !Object.hasOwn(messages, key)) return raw;
    const translated = messages[key];
    if (typeof translated !== "string" || !translated.trim()) throw new Error("Missing translation: " + key);
    return (raw.match(/^\s*/)?.[0] || "") + escapeHtml(translated) + (raw.match(/\s*$/)?.[0] || "");
}
export function localeUrl(file, locale) {
    if (!locales.includes(locale) || !/^[a-z][\w-]*\.html$/.test(file)) throw new Error("Invalid locale route");
    return "/" + (locale === "fa" ? "" : locale + "/") + file;
}
export function translateHTML(html, locale, root, page) {
    const messages = dictionary(root, locale);
    // Templates are authored native HTML with escaped component values. Work on
    // text tokens and selected human-readable attributes; never translate data hooks.
    let protectedTag = "";
    html = html
        .split(/(<[^>]+>)/g)
        .map((token) => {
            if (token.startsWith("<")) {
                if (/^<(script|style)\b/i.test(token)) protectedTag = token.match(/^<(\w+)/)[1].toLowerCase();
                // Language names remain autonyms, with their correct lang/dir.
                if (!protectedTag && /^<span\b[^>]*\blang="(?:fa|ar|en)"/i.test(token)) protectedTag = "span";
                if (protectedTag && new RegExp("^</" + protectedTag + "\\b", "i").test(token)) protectedTag = "";
                if (/^<!--/.test(token)) return token;
                const directional =
                    locale === "en" && !/\blang="(?:fa|ar)"/.test(token)
                        ? token.replace(/\bdir="rtl"/g, 'dir="ltr"')
                        : token;
                return directional
                    .replace(
                        /\b(alt|aria-label|placeholder|title|content)="([^"]*)"/g,
                        (_, key, value) => key + '="' + translateText(value, messages) + '"',
                    )
                    .replace(/\bhref="([^"]+)"/g, (tag, value) => {
                        if (/^(?:[a-z][\w+.-]*:|\/\/|\/assets\/|\/src\/|#)/i.test(value)) return tag;
                        const parts = value.split(/([?#].*)/);
                        const file = parts[0].replace(/^\//, "");
                        return /^[\w-]+\.html$/.test(file)
                            ? 'href="' + localeUrl(file, locale) + (parts[1] || "") + '"'
                            : tag;
                    });
            }
            return protectedTag ? token : translateText(token, messages);
        })
        .join("");
    html = html
        .replace(/<html\b[^>]*>/, '<html lang="' + locale + '" dir="' + (locale === "ar" ? "rtl" : "ltr") + '">')
        .replace(/<body\b/, '<body data-locale="' + locale + '"');
    // Include only messages used by interactive components, not the page dictionary.
    const keys = JSON.parse(readFileSync(resolve(root, "src/i18n/runtime-source.json"), "utf8"));
    const runtime = Object.fromEntries(
        keys.map((key) => {
            if (typeof messages[key] !== "string") throw new Error("Missing runtime translation: " + key);
            return [key, messages[key]];
        }),
    );
    const json = JSON.stringify(runtime).replaceAll("<", "\\u003c");
    return html.replace(
        "</head>",
        '<script type="application/json" id="site-locale-messages">' + json + "</script></head>",
    );
}
export function localizedRuntime(root) {
    const components = resolve(root, "src/js/components").replaceAll("\\", "/") + "/";
    const pages = resolve(root, "src/js/pages").replaceAll("\\", "/") + "/";
    const services = resolve(root, "src/js/services").replaceAll("\\", "/") + "/";
    return {
        name: "marpich-runtime-messages",
        resolveId(id) {
            const match = id.match(/^\/__locale-entry\/(fa|en|ar)\/([a-z-]+)\.js$/);
            return match ? "\0locale-entry:" + match[1] + "/" + match[2] : null;
        },
        load(id) {
            if (!id.startsWith("\0locale-entry:")) return;
            const [locale, page] = id.slice("\0locale-entry:".length).split("/");
            if (!existsSync(resolve(root, "src/js/pages", page + ".js"))) throw new Error("Unknown page entry");
            return (
                'import "/src/js/pages/' +
                page +
                '.js"; document.documentElement.dataset.localeReady = ' +
                JSON.stringify(locale) +
                ";"
            );
        },
        enforce: "post",
        transform(code, id) {
            const file = id.split("?")[0].replaceAll("\\", "/");
            if (file.endsWith("/i18n.js")) return;
            if (
                ![components, pages, services].some((prefix) => file.startsWith(prefix)) &&
                !file.endsWith("/src/data/product-motion/category-index.json")
            )
                return;
            if (!hasPersianText(code)) return;
            const edits = runtimeMessages(code, file);
            if (!edits.length) return;
            const source = JSON.parse(readFileSync(resolve(root, "src/i18n/source.json"), "utf8"));
            for (const item of edits)
                if (!source.includes(item.key)) throw new Error("Unregistered runtime message: " + item.key);
            for (const item of edits.sort((a, b) => b.start - a.start)) {
                const replacement =
                    item.kind === "template"
                        ? "__mpsTF(" + JSON.stringify(item.value) + ",[" + item.expressions.join(",") + "])"
                        : "__mpsT(" + code.slice(item.start, item.end) + ")";
                code = code.slice(0, item.start) + replacement + code.slice(item.end);
            }
            return { code: 'import {t as __mpsT, tf as __mpsTF} from "/src/js/services/i18n.js";\n' + code, map: null };
        },
    };
}
