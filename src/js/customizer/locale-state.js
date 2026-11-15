import { localizedPages, pages } from "../../../build/pages.js";

export const CUSTOMIZER_LOCALES = ["fa", "en", "ar"];

export function readCustomizerLocale(search) {
    const requested = new URLSearchParams(search).get("locale");
    return CUSTOMIZER_LOCALES.includes(requested) ? requested : "fa";
}

export function localePageFile(page, locale = "fa") {
    if (!CUSTOMIZER_LOCALES.includes(locale)) throw new Error("زبان Customizer معتبر نیست.");
    const name = typeof page === "string" ? page : page.sourceName || page.name;
    const route =
        locale === "fa"
            ? pages.find((item) => item.name === name)
            : localizedPages.find((item) => item.locale === locale && item.sourceName === name);
    if (!route) throw new Error("صفحهٔ پیش‌نمایش پیدا نشد.");
    return route.file;
}

export function localeEditorURL(href, locale, page) {
    if (!CUSTOMIZER_LOCALES.includes(locale)) throw new Error("زبان Customizer معتبر نیست.");
    const url = new URL(href);
    url.searchParams.set("locale", locale);
    url.searchParams.set("page", page);
    return url.href;
}
