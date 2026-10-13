// Image sources are settings, never CSS declarations or arbitrary DOM selectors.
export function normalizeImageSource(value) {
    if (typeof value !== "string") throw new Error("آدرس تصویر معتبر نیست.");
    const source = value.trim();
    if (!source || source.length > 2048 || /[\s<>"'`\\]|%(?:2e|2f|5c)/i.test(source))
        throw new Error("آدرس تصویر معتبر نیست.");
    if (/^https?:\/\//i.test(source)) {
        const url = new URL(source);
        if (url.username || url.password) throw new Error("آدرس تصویر نباید اطلاعات ورود داشته باشد.");
        return url.href;
    }
    const path = source.startsWith("assets/") ? `/${source}` : source;
    if (
        !path.startsWith("/assets/") ||
        path.split(/[/?#]/).some((part) => part === "." || part === "..") ||
        !/\.(?:png|jpe?g|webp|avif|gif|svg)(?:[?#].*)?$/i.test(path)
    )
        throw new Error("مسیر فایل باید از /assets/ شروع شود؛ یا آدرس کامل HTTP/HTTPS وارد کن.");
    return path;
}

export function imageSourceRules(rules) {
    return rules
        .filter(
            (rule) =>
                rule.page === "about" &&
                rule.target.kind === "role" &&
                rule.target.key === "about-image" &&
                rule.enabled !== false &&
                (!rule.state || rule.state === "normal") &&
                typeof rule.properties["image-source"] === "string",
        )
        .map(({ breakpoint, range, properties }) => ({
            breakpoint,
            ...(range ? { range } : {}),
            source: properties["image-source"],
        }));
}

const order = ["all", "desktop", "tablet", "mobile", "compact", "range"];
export function imageSourceAtWidth(sources, width) {
    const applies = ({ breakpoint, range }) => {
        if (breakpoint === "range") return width >= range.min && (range.max === null || width <= range.max);
        if (breakpoint === "desktop") return width >= 1180;
        if (breakpoint === "tablet") return width >= 640 && width <= 1179;
        if (breakpoint === "mobile") return width <= 639;
        if (breakpoint === "compact") return width <= 450;
        return breakpoint === "all";
    };
    return sources
        .filter(applies)
        .sort((a, b) => order.indexOf(a.breakpoint) - order.indexOf(b.breakpoint))
        .at(-1)?.source;
}

export function publicImageSource(source, base) {
    return source.startsWith("/assets/") ? `${base}${source.slice(1)}` : source;
}
