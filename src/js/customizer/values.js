// No DOM or Node APIs: the browser and save endpoint enforce the same contract.
import { normalizeImageSource } from "./image-source.js";
import { PROPERTIES } from "./schema.js";
import { TOKEN_CONTRACTS, normalizeTokenValue } from "./token-values.js";

export function rangeQuery(range) {
    const queries = [];
    if (range.min > 0) queries.push(`(min-width: ${range.min}px)`);
    if (range.max !== null) queries.push(`(max-width: ${range.max}px)`);
    return queries.join(" and ");
}

export function validTextValue(kind, value) {
    if (typeof value !== "string" || value.length > 300 || /[;{}<>\\]|url\s*\(|expression\s*\(|\/\*/i.test(value))
        return false;
    if (kind === "object-position")
        return (
            [
                "center",
                "center top",
                "center bottom",
                "right center",
                "left center",
                "top",
                "bottom",
                "left",
                "right",
            ].includes(value) || /^(?:-?\d+(?:\.\d+)?(?:%|px))\s+(?:-?\d+(?:\.\d+)?(?:%|px))$/.test(value)
        );
    if (kind === "ratio")
        return (
            value === "auto" ||
            (/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/.test(value) && value.split("/").every((n) => Number(n) > 0))
        );
    if (kind === "grid-line")
        return /^(?:auto|span [1-9]\d?|[1-9]\d?|-[1-9]\d?)(?:\s*\/\s*(?:auto|span [1-9]\d?|[1-9]\d?|-[1-9]\d?))?$/.test(
            value,
        );
    if (kind === "tracks") {
        if (!/^[\w\s.,()%+-]+$/.test(value) || !value || /(?:^|\s)-\d/.test(value)) return false;
        let depth = 0;
        for (const char of value) {
            if (char === "(") depth++;
            if (char === ")" && --depth < 0) return false;
        }
        if (depth) return false;
        const words =
            value.replace(/\d*\.?\d+(?:px|rem|em|fr|%|vw|vh|dvh|svh|lvh|vmin|vmax)?/g, "").match(/[a-zA-Z][\w-]*/g) ||
            [];
        return words.every((word) =>
            [
                "none",
                "auto",
                "min-content",
                "max-content",
                "auto-fit",
                "auto-fill",
                "repeat",
                "minmax",
                "fit-content",
            ].includes(word),
        );
    }
    if (kind === "shadow") {
        if (value === "none") return true;
        return (
            value.split(",").length <= 4 &&
            value
                .split(",")
                .every((part) =>
                    /^(?:inset\s+)?-?\d+(?:\.\d+)?(?:px|rem|em)?\s+-?\d+(?:\.\d+)?(?:px|rem|em)?(?:\s+\d+(?:\.\d+)?(?:px|rem|em)?){0,2}\s+#[\da-f]{3,8}$/i.test(
                        part.trim(),
                    ),
                )
        );
    }
    return false;
}

export function normalizeProperty(name, value) {
    if (!Object.hasOwn(PROPERTIES, name) && Object.hasOwn(TOKEN_CONTRACTS, name))
        return normalizeTokenValue(name, value);
    if (!Object.hasOwn(PROPERTIES, name)) throw new Error(`تنظیم ناشناخته: ${name}`);
    const spec = PROPERTIES[name];
    const fail = () => {
        throw new Error(`مقدار نامعتبر: ${name}`);
    };
    if (spec.type === "image") return normalizeImageSource(value);
    if (spec.type === "number") {
        if (spec.extra?.includes(value)) return value;
        if (typeof value === "string") {
            const text = value.trim();
            if (spec.text && validTextValue(spec.text, text)) return text;
            const length = text.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%|vw|vh|dvh|svh|lvh|vmin|vmax)$/);
            if (!length || !spec.units?.includes(length[2])) return fail();
            const number = Number(length[1]),
                max = length[2] === "px" ? 7680 : ["em", "rem"].includes(length[2]) ? 480 : 1000;
            if (!Number.isFinite(number) || number < (spec.min < 0 ? -max : 0) || number > max) return fail();
            return `${Math.round(number * 100) / 100}${length[2]}`;
        }
        if (typeof value !== "number" || !Number.isFinite(value) || value < spec.min || value > spec.max) return fail();
        if ((spec.integer || ["columns", "lines"].includes(spec.unit)) && !Number.isInteger(value)) return fail();
        return Math.round(value * 100) / 100;
    }
    if (spec.type === "choice") return spec.values.includes(value) ? value : fail();
    if (spec.type === "text") return validTextValue(spec.validate, value) ? value.trim() : fail();
    if (typeof value !== "string" || !/^(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8}|transparent)$/i.test(value))
        return fail();
    return value.toLowerCase();
}
