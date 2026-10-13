// Stable BEM hooks are preferred over Tailwind utilities; exact selection stays page-scoped.
export function describeElement(element) {
    const names = {
        h1: "عنوان اصلی",
        h2: "عنوان بخش",
        h3: "عنوان باکس",
        h4: "عنوان",
        p: "متن",
        blockquote: "دیدگاه",
        article: "باکس",
        section: "بخش",
        div: "قاب",
        figure: "قاب تصویر",
        img: "تصویر",
        svg: "تصویر برداری",
        button: "دکمه",
        a: "لینک",
        i: "آیکون",
        span: "متن / آیکون",
        bdi: "قسمت متن",
        strong: "متن ضخیم",
        table: "جدول",
        td: "سلول",
        th: "عنوان جدول",
        li: "آیتم",
        ul: "فهرست",
        input: "فیلد",
        form: "فرم",
    };
    const text =
        element.getAttribute("aria-label") ||
        element.getAttribute("alt") ||
        element.getAttribute("placeholder") ||
        element.textContent?.trim().replace(/\s+/g, " ").slice(0, 32);
    return `${names[element.localName] || "المان"}${text ? ` · ${text}` : ""}`;
}
export const semanticClasses = (element) =>
    [...(element.classList || [])]
        .filter(
            (name) =>
                /^[A-Za-z_][\w-]*$/.test(name) &&
                name.includes("-") &&
                !name.startsWith("mps-") &&
                !/^(?:fa-|fa$|bg-|text-|font-|border-|rounded-|items-|justify-|object-|overflow-|flex-|grid-|col-|row-|gap-|p[xytbrl]?-|m[xytbrl]?-|w-|h-|min-|max-|z-|space-|leading-|tracking-|self-|order-|shrink-|grow-)/.test(
                    name,
                ),
        )
        .sort((a, b) => Number(a.startsWith("site-")) - Number(b.startsWith("site-")));

export function elementSelector(element) {
    const segments = [];
    let node = element;
    while (node && node !== element.ownerDocument.body) {
        if (/^[A-Za-z_][\w-]*$/.test(node.id) && element.ownerDocument.querySelectorAll(`#${node.id}`).length === 1) {
            segments.unshift(`#${node.id}`);
            break;
        }
        const classes = semanticClasses(node);
        const unique = classes.find((name) => element.ownerDocument.querySelectorAll(`.${name}`).length === 1);
        if (unique) {
            segments.unshift(`.${unique}`);
            break;
        }
        let segment = node.localName;
        if (classes[0]) segment += `.${classes[0]}`;
        const siblings = [...(node.parentElement?.children || [])].filter((item) => item.localName === node.localName);
        if (siblings.length > 1) segment += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        segments.unshift(segment);
        node = node.parentElement;
    }
    return segments.join(" > ");
}

export function repeatedSelector(element) {
    let anchor = element.closest(
            ".site-card, .project-details__meta-item, .product-details__quick-spec-item, .details-table tr, .site-faq__item",
        ),
        baseSelector = "";
    if (anchor?.matches("tr")) {
        const tableClass = semanticClasses(anchor.closest("table"))[0];
        if (tableClass) baseSelector = `.${tableClass} > ${anchor.parentElement.localName} > tr`;
    }
    if (!anchor) {
        // Shared navigation, footer lists and other repeated semantic elements
        // are editable even when they are not site-card components.
        for (let node = element; node && node !== element.ownerDocument.body; node = node.parentElement) {
            const shared = semanticClasses(node).find(
                (name) => element.ownerDocument.querySelectorAll(`.${name}`).length > 1,
            );
            if (shared) {
                anchor = node;
                baseSelector = `.${shared}`;
                break;
            }
        }
    }
    if (!anchor) {
        // A header or footer occurs once per page but is shared across all pages.
        anchor = element.closest(
            ".site-header, .mobile-menu, .site-footer, .catalog-consultation, [data-consultation], .site-faq, .site-testimonials, .home-partners, .product-search, .auth-card",
        );
        if (anchor)
            baseSelector = anchor.matches("[data-consultation]")
                ? ".site-consultation"
                : `.${semanticClasses(anchor)[0]}`;
    }
    if (!anchor) return "";
    if (!baseSelector) {
        const className = semanticClasses(anchor).find(
            (name) => element.ownerDocument.querySelectorAll(`.${name}`).length > 1,
        );
        if (!className) return "";
        baseSelector = `.${className}`;
    }
    const segments = [];
    let node = element;
    while (node !== anchor) {
        let part = node.localName;
        const semantic = semanticClasses(node)[0];
        if (semantic) part += `.${semantic}`;
        const siblings = [...node.parentElement.children].filter((child) => child.localName === node.localName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        segments.unshift(part);
        node = node.parentElement;
    }
    const selector = `${baseSelector}${segments.length ? ` > ${segments.join(" > ")}` : ""}`;
    return element.ownerDocument.querySelectorAll(selector).length >= 1 ? selector : "";
}
