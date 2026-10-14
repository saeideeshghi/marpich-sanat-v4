import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const escapeHtml = (value) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c],
    );

// Escaping prevents markup injection but does not reject javascript: links.
// Local/CMS content may use relative URLs or these explicit public schemes.
export function validateContentUrl(value, image = false) {
    const url = String(value ?? "");
    const scheme = url.match(/^([a-z][a-z\d+.-]*):/i)?.[1].toLowerCase();
    const allowed = image ? ["http", "https"] : ["http", "https", "mailto", "tel"];
    if (
        url.length > 2048 ||
        /[\u0000-\u0020\u007f\\]/.test(url) ||
        url.startsWith("//") ||
        (scheme && !allowed.includes(scheme))
    ) {
        throw new Error(`Unsafe content URL: ${url}`);
    }
    if (scheme && ["http", "https"].includes(scheme)) {
        const parsed = new URL(url);
        if (parsed.username || parsed.password) throw new Error("Credentials are not allowed in public content URLs");
    }
    return url;
}

// Only internal renderers supply raw fragments. Page JSON always passes through escaping.
// This is a build-time renderer; Razor should own HTML rendering after CMS migration.
export function renderComponent(name, data, root) {
    const e = escapeHtml;
    const render = (template, values, fragments = {}) => {
        const source = readFileSync(resolve(root, "src/components", `${template}.html`), "utf8");
        return source.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (_, raw, key) => {
            const bag = raw ? fragments : values;
            if (!Object.hasOwn(bag, raw || key)) throw new Error(`${template}: missing ${raw || key}`);
            if (!raw && ["href", "image"].includes(key)) validateContentUrl(bag[key], key === "image");
            return raw ? bag[raw] : e(bag[key]);
        });
    };
    const chip = (label) =>
        `<span class="filter-chip" data-filter-chip><span>${e(label)}</span><button type="button" data-remove-filter aria-label="حذف فیلتر ${e(label)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></span>`;
    switch (name) {
        case "partners":
            return render(name, data, {
                logos: data.logos
                    .map(
                        (logo) =>
                            `<li class="home-partners__item"><img src="${e(validateContentUrl(logo.image, true))}" alt="${e(logo.name)}" width="${e(logo.width ?? 180)}" height="${e(logo.height ?? 88)}" loading="lazy" decoding="async" /></li>`,
                    )
                    .join("\n"),
            });
        case "consultation": {
            // Both supported data shapes use the same approved text layout.
            const benefits = Array.isArray(data.benefits)
                ? data.benefits.map((label) => `✓ ${label}`).join(" ")
                : data.benefits;
            return render(name, data, {
                benefits: e(benefits),
            });
        }
        case "catalog-consultation":
            return render(name, data);
        case "product-cards":
            return data
                .map((card) =>
                    render(
                        "product-card",
                        { ...card, loading: card.loading ?? "lazy" },
                        {
                            specs: card.specs
                                .map((spec) => `<span class="product-card__spec site-card__meta-tag">${e(spec)}</span>`)
                                .join(""),
                        },
                    ),
                )
                .join("\n");
        case "search-panel":
            return render(name, data, {
                barLabelClass: data.variant === "products" ? 'class="product-search__label" ' : "",
                clearClass:
                    data.variant === "products"
                        ? "product-search__result border-0 bg-transparent p-0"
                        : "product-search__result",
                filters: data.filters
                    .map(
                        (filter) =>
                            `<select name="${e(filter.name)}" class="product-search__select" aria-label="${e(filter.label)}">${filter.options.map((option) => `<option value="${e(option.value)}">${e(option.label)}</option>`).join("\n")}</select>`,
                    )
                    .join("\n"),
                chips: data.chips.map(chip).join("\n"),
            });
        case "testimonials":
            if (!["projects", "industry-textile"].includes(data.variant)) {
                throw new Error("Unsupported testimonial variant");
            }
            return render(`testimonials-${data.variant}`, data, {
                cards: data.cards.map((card) => render(`testimonial-card-${data.variant}`, card)).join("\n"),
            });
        case "faq":
            return render(name, data, {
                items: data.items
                    .map((item, index) => {
                        const open = data.initialOpen === index;
                        return render(
                            "faq-item",
                            {
                                ...item,
                                id: `${data.id}-${index + 1}`,
                                expanded: String(open),
                                openClass: open ? "is-open" : "",
                            },
                            { hidden: open ? "" : "hidden" },
                        );
                    })
                    .join("\n"),
            });
        default:
            throw new Error(`Unknown component: ${name}`);
    }
}
