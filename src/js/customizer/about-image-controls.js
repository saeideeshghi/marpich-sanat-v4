// A focused UI over the existing rule model. No second settings format or CSS
// writer: preview, undo, local save, export and Pages all use the same rules.
import { normalizeConfig, ruleKey, targetSelector } from "./model.js";
import { normalizeProperty } from "./values.js";

const definitions = [
    {
        key: "source",
        role: "about-image",
        property: "image-source",
        label: "فایل تصویر · مسیر یا URL",
        placeholder: "/assets/images/about/about-team.svg",
        wide: true,
    },
    {
        key: "width",
        role: "about-image-container",
        property: "width",
        label: "عرض بخش · % یا px",
        placeholder: "90% یا 1200px",
    },
    {
        key: "max-width",
        role: "about-image-container",
        property: "max-width",
        label: "حداکثر عرض · px",
        placeholder: "1760 یا none",
    },
    {
        key: "height",
        role: "about-image-frame",
        property: "height",
        label: "ارتفاع قاب · px یا auto",
        placeholder: "420 یا auto",
    },
    {
        key: "ratio",
        role: "about-image-frame",
        property: "aspect-ratio",
        label: "نسبت قاب · عرض / ارتفاع",
        placeholder: "16 / 9",
    },
    {
        key: "fit",
        role: "about-image",
        property: "object-fit",
        label: "نمایش تصویر",
        choices: [
            ["contain", "تصویر کامل · contain"],
            ["cover", "پر کردن قاب · cover"],
            ["fill", "کشیدن تصویر · fill"],
            ["scale-down", "کوچک شدن در قاب"],
        ],
    },
    {
        key: "position",
        role: "about-image",
        property: "object-position",
        label: "جای تصویر · افقی عمودی",
        placeholder: "50% 30%",
    },
    {
        key: "scale",
        role: "about-image",
        property: "scale",
        label: "زوم تصویر · درصد",
        placeholder: "100",
        percentage: true,
    },
    { key: "radius", role: "about-image-frame", property: "border-radius", label: "گردی قاب · px", placeholder: "16" },
];
const sizes = [
    ["all", "همه اندازه‌ها", null],
    ["desktop", "دسکتاپ", 1440],
    ["tablet", "تبلت", 820],
    ["mobile", "موبایل", 390],
];

const ruleFor = (definition, breakpoint, range) => ({
    page: "about",
    breakpoint,
    ...(breakpoint === "range" ? { range: structuredClone(range) } : {}),
    target: { kind: "role", key: definition.role },
    properties: {},
});

// Updating one quick control preserves the remaining page/device rules. Empty
// input removes that override and lets the normal responsive cascade apply.
export function updateAboutImage(config, { key, value, breakpoint, range }) {
    const definition = definitions.find((item) => item.key === key);
    if (!definition) throw new Error("تنظیم تصویر شناخته نشد.");
    const next = structuredClone(config);
    const reference = ruleFor(definition, breakpoint, range);
    let rule = next.rules.find((item) => ruleKey(item) === ruleKey(reference));
    const raw = String(value ?? "")
        .trim()
        .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
        .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
    if (raw) {
        const numeric = /^-?\d+(?:\.\d+)?$/.test(raw);
        const normalized = definition.percentage
            ? Number(raw.replace(/%$/, "")) / 100
            : numeric && ["width", "max-width", "height", "border-radius"].includes(definition.property)
              ? Number(raw)
              : raw;
        const property = normalizeProperty(definition.property, normalized);
        if (!rule) {
            rule = reference;
            next.rules.push(rule);
        }
        delete rule.enabled;
        rule.properties[definition.property] = property;
    } else if (rule) delete rule.properties[definition.property];
    return normalizeConfig(next);
}

export function createAboutImageControls({ container, getContext, onChange, onSize, onInvalid }) {
    const document = container.ownerDocument;
    let observedImage = null;
    const note = document.createElement("p");
    note.className = "mps-help";
    note.textContent =
        "هر اندازه تنظیم مستقل دارد. فیلد خالی یعنی استفاده از استایل پایه؛ ۱۰۰٪ زوم عادی است. ارتفاع auto از نسبت قاب استفاده می‌کند. فایل محلی را ابتدا داخل assets قرار بده.";
    const deviceRow = document.createElement("div");
    deviceRow.className = "mps-about-image__devices";
    const deviceButtons = sizes.map(([key, label, width]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mps-button";
        button.dataset.aboutDevice = key;
        button.textContent = label;
        button.addEventListener("click", () => onSize(key, width));
        deviceRow.append(button);
        return button;
    });
    const status = document.createElement("p");
    status.className = "mps-help";
    status.setAttribute("role", "status");
    const grid = document.createElement("div");
    grid.className = "mps-about-image__fields";
    const entries = definitions.map((definition) => {
        const field = document.createElement("div");
        field.className = `mps-field${definition.wide ? " mps-field--wide" : ""}`;
        const label = document.createElement("label");
        label.textContent = definition.label;
        const input = document.createElement(definition.choices ? "select" : "input");
        input.id = `about-control-${definition.key}`;
        label.htmlFor = input.id;
        input.dir = "ltr";
        if (definition.choices) {
            for (const [value, text] of [["", "استایل پایه"], ...definition.choices]) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = text;
                input.append(option);
            }
        } else {
            input.type = "text";
            input.autocomplete = "off";
            input.spellcheck = false;
            input.placeholder = definition.placeholder;
        }
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "mps-field__reset";
        reset.textContent = "↺";
        reset.title = "حذف تنظیم در همین اندازه";
        reset.setAttribute("aria-label", `بازنشانی ${definition.label}`);
        reset.addEventListener("click", () => change(""));
        const change = (value) => {
            const context = getContext();
            if (context.page !== "about" || !context.enabled) return;
            try {
                onChange(
                    updateAboutImage(context.config, {
                        key: definition.key,
                        value,
                        breakpoint: context.breakpoint,
                        range: context.range,
                    }),
                    `about:${context.breakpoint}:${definition.key}`,
                );
                render();
            } catch (error) {
                input.setAttribute("aria-invalid", "true");
                onInvalid(error.message);
            }
        };
        input.addEventListener("change", () => change(input.value));
        const labelRow = document.createElement("div");
        labelRow.className = "mps-field__label";
        labelRow.append(label, reset);
        field.append(labelRow, input);
        grid.append(field);
        return { definition, field, input, reset };
    });
    container.append(deviceRow, status, note, grid);

    function render() {
        const context = getContext();
        for (const button of deviceButtons) {
            button.setAttribute("aria-pressed", String(button.dataset.aboutDevice === context.breakpoint));
            button.disabled = !context.enabled;
        }
        if (context.page !== "about") return;
        const image = context.document?.querySelector(".about-team-media__image");
        if (observedImage !== image) {
            for (const event of ["load", "error"]) {
                observedImage?.removeEventListener(event, render);
                image?.addEventListener(event, render);
            }
            observedImage = image;
        }
        const frame = context.document?.querySelector(".about-team-media");
        const bounds = frame?.getBoundingClientRect();
        status.textContent = `${context.breakpoint === "range" ? "بازهٔ دلخواه" : sizes.find(([key]) => key === context.breakpoint)?.[1] || "موبایل کوچک"} · عرض صفحه ${context.width}px${bounds ? ` · قاب ${Math.round(bounds.width)} × ${Math.round(bounds.height)}px` : ""}${image?.dataset.sourceError ? " · تصویر جدید پیدا نشد؛ تصویر پایه نمایش داده می‌شود." : ""}`;
        for (const { definition, field, input, reset } of entries) {
            const key = ruleKey(ruleFor(definition, context.breakpoint, context.range));
            const rule = context.config.rules.find((item) => ruleKey(item) === key && item.enabled !== false);
            const value = rule?.properties[definition.property];
            const display =
                value === undefined ? "" : definition.percentage ? Math.round(Number(value) * 100) : String(value);
            if (document.activeElement !== input) input.value = display;
            input.disabled = !context.enabled;
            reset.disabled = !context.enabled || value === undefined;
            field.dataset.edited = String(value !== undefined);
            input.removeAttribute("aria-invalid");
            if (!definition.choices) {
                const element = context.document?.querySelector(targetSelector({ kind: "role", key: definition.role }));
                const actual =
                    definition.property === "image-source"
                        ? image?.getAttribute("src")
                        : element?.ownerDocument.defaultView
                              .getComputedStyle(element)
                              .getPropertyValue(definition.property)
                              .trim();
                input.placeholder = actual && actual !== "none" ? `${actual} · پایه / ارث‌بری` : definition.placeholder;
            }
        }
    }
    return { render };
}
