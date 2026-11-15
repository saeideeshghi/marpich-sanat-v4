// The pattern JSON files are canonical. settings.json stores style rules and responsive image sources.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { emptyConfig, normalizeConfig, persistedSettings } from "../src/js/customizer/model.js";

export const CUSTOMIZER_LOCALES = ["fa", "en", "ar"];

export function settingsPathFor(root, locale = "fa") {
    if (!CUSTOMIZER_LOCALES.includes(locale)) throw new Error("زبان Customizer معتبر نیست.");
    return resolve(root, `src/data/customizer/settings${locale === "fa" ? "" : `.${locale}`}.json`);
}

export function patternPathFor(root, locale, kind) {
    if (!CUSTOMIZER_LOCALES.includes(locale)) throw new Error("زبان Customizer معتبر نیست.");
    const name = { header: "site-pattern", footer: "footer-pattern" }[kind];
    if (!name) throw new Error("نوع پترن معتبر نیست.");
    return resolve(root, `src/data/patterns/${locale === "fa" ? "" : `${locale}/`}${name}.json`);
}

function readWithPersianFallback(path, fallback) {
    const selected = existsSync(path) ? path : fallback;
    return existsSync(selected) ? JSON.parse(readFileSync(selected, "utf8")) : null;
}

export function loadDesignConfig(root, locale = "fa") {
    const path = settingsPathFor(root, locale);
    const settings = readWithPersianFallback(path, settingsPathFor(root, "fa")) || emptyConfig();
    const patterns = Object.fromEntries(
        ["header", "footer"].map((kind) => [
            kind,
            readWithPersianFallback(patternPathFor(root, locale, kind), patternPathFor(root, "fa", kind)),
        ]),
    );
    return normalizeConfig({ ...settings, patterns });
}

export const settingsText = (config) => `${JSON.stringify(persistedSettings(config), null, 2)}\n`;
