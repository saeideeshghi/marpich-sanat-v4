import contracts from "../../data/customizer/token-contract.json" with { type: "json" };

export const TOKEN_CONTRACTS = contracts;

// Only known variable references and a small CSS value grammar reach generated CSS.
// Native CSS.supports provides a second syntax check in the editor; no DOM is needed
// here, so exported files and local writeback enforce this same boundary.
export function normalizeTokenValue(name, value) {
    const spec = contracts[name];
    const fail = () => {
        throw new Error(`مقدار متغیر ${name} معتبر نیست.`);
    };
    if (!spec?.editable) throw new Error(spec?.reason || `متغیر ناشناخته: ${name}`);
    if (!["number", "string"].includes(typeof value)) return fail();
    let text = String(value)
        .trim()
        .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
        .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
    if (!text || text.length > 500 || /[;{}<>\\!]|url\s*\(|expression\s*\(|\/\*|@/i.test(text)) return fail();
    for (const [, reference] of text.matchAll(/var\(\s*(--[\w-]+)/g))
        if (!Object.hasOwn(contracts, reference) || reference === name) return fail();
    let depth = 0;
    for (const char of text) {
        if (char === "(") depth++;
        if (char === ")" && --depth < 0) return fail();
    }
    if (depth) return fail();
    // Remove valid references before checking words; arbitrary CSS identifiers
    // cannot hide inside calc(), color functions, or a shadow declaration.
    const grammar = text.replace(/--[\w-]+/g, "").replace(/#[\da-f]{3,8}\b/gi, "");
    const words = grammar.match(/[a-z][a-z-]*/gi) || [];
    const numeric = /^-?\d+(?:\.\d+)?$/;
    if (spec.kind === "font") {
        if (
            !/^[\w\s,'"-]+$/.test(text) ||
            !text.split(",").every((part) => /^(?:[\w-]+(?:\s+[\w-]+)*|'[\w -]+'|"[\w -]+")$/.test(part.trim()))
        )
            return fail();
        return text;
    }
    if (["integer", "number"].includes(spec.kind) && numeric.test(text)) {
        const number = Number(text);
        if (
            !Number.isFinite(number) ||
            number < spec.min ||
            number > spec.max ||
            (spec.kind === "integer" && !Number.isInteger(number))
        )
            return fail();
        return String(number);
    }
    if (spec.kind === "ratio") {
        if (
            /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/.test(text) &&
            text.split("/").every((part) => Number(part) > 0 && Number(part) <= 10000)
        )
            return text;
    }
    if (spec.kind === "length" && numeric.test(text)) text += "px";
    const allowed =
        spec.kind === "color"
            ? ["var", "rgb", "rgba", "hsl", "hsla", "transparent", "currentColor", "deg"]
            : spec.kind === "shadow"
              ? ["var", "rgb", "rgba", "hsl", "hsla", "none", "inset", "px", "rem", "em", "deg"]
              : [
                    "var",
                    "calc",
                    "min",
                    "max",
                    "clamp",
                    "px",
                    "rem",
                    "em",
                    "vw",
                    "vh",
                    "dvh",
                    "svh",
                    "lvh",
                    "vmin",
                    "vmax",
                ];
    if (!words.every((word) => allowed.includes(word)) || !/^[\w\s.,()%#+'"*/-]+$/.test(text)) return fail();
    if (["integer", "number", "ratio"].includes(spec.kind) && !text.startsWith("var(")) return fail();
    if (
        spec.kind === "length" &&
        !/(?:\d(?:px|rem|em|%|vw|vh|dvh|svh|lvh|vmin|vmax)|^(?:var|calc|min|max|clamp)\()/i.test(text)
    )
        return fail();
    if (spec.kind === "color" && !/^(?:#[\da-f]{3,8}|(?:var|rgba?|hsla?)\(.+\)|transparent|currentColor)$/i.test(text))
        return fail();
    if (spec.kind === "shadow" && !/^(?:var\(.+\)|none|.+(?:#[\da-f]{3,8}|rgba?\(.+\)|hsla?\(.+\)))$/i.test(text))
        return fail();
    for (const [, number] of grammar.matchAll(/(-?\d+(?:\.\d+)?)/g))
        if (!Number.isFinite(Number(number)) || Math.abs(Number(number)) > 10000) return fail();
    return text;
}

export function tokenRule(name, context) {
    return {
        page: context.scope === "global" ? "*" : context.page,
        breakpoint: context.breakpoint,
        ...(context.breakpoint === "range" ? { range: { ...context.range } } : {}),
        target: { kind: "token", key: name },
        properties: {},
    };
}

export function tokenSelectors(name, body = "body[data-page]") {
    const selectors = contracts[name]?.selectors || [];
    const owners = selectors
        .flatMap((selector) => selector.split(/,\s*(?![^()]*\))/))
        .map((selector) => selector.trim());
    return [
        ...new Set([
            body,
            ...owners.flatMap((selector) => {
                if (selector === ":root") return [body];
                if (selector.startsWith("body")) return [selector.replace(/^body/, body)];
                return [`${body}:is(${selector})`, `${body} ${selector}`];
            }),
        ]),
    ].join(",\n");
}
