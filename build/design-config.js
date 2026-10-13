// The pattern JSON files are canonical. settings.json stores style rules and responsive image sources.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { emptyConfig, normalizeConfig, persistedSettings } from "../src/js/customizer/model.js";

export function loadDesignConfig(root) {
    const path = resolve(root, "src/data/customizer/settings.json");
    const settings = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : emptyConfig();
    const patterns = Object.fromEntries(
        [
            ["header", "site"],
            ["footer", "footer"],
        ].map(([key, name]) => [
            key,
            JSON.parse(readFileSync(resolve(root, `src/data/patterns/${name}-pattern.json`), "utf8")),
        ]),
    );
    return normalizeConfig({ ...settings, patterns });
}

export const settingsText = (config) => `${JSON.stringify(persistedSettings(config), null, 2)}\n`;
