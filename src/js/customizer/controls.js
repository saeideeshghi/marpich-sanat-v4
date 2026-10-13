// Controls and labels are independent of editor state, selection and persistence.
import { PROPERTIES } from "./schema.js";
import { describeToken } from "./token-descriptions.js";
const option = (value, label) => {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
};
const digits = (value) =>
    value
        .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
        .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
const choices = {
    "--header-fixed-enabled": [
        ["1", "فعال"],
        ["0", "غیرفعال"],
    ],
    "font-weight": [
        ["300", "نازک"],
        ["400", "معمولی"],
        ["500", "متوسط"],
        ["600", "نیمه ضخیم"],
        ["700", "ضخیم"],
        ["800", "خیلی ضخیم"],
        ["900", "سنگین"],
    ],
    "text-align": [
        ["right", "راست‌چین"],
        ["justify", "جاستیفای"],
        ["center", "وسط‌چین"],
        ["left", "چپ‌چین"],
        ["start", "ابتدای متن"],
    ],
    "text-align-last": [
        ["right", "راست‌چین"],
        ["auto", "خودکار"],
        ["center", "وسط‌چین"],
        ["left", "چپ‌چین"],
    ],
    direction: [
        ["rtl", "راست به چپ"],
        ["ltr", "چپ به راست"],
    ],
    "align-items": [
        ["flex-start", "ابتدای محور"],
        ["flex-end", "انتهای محور"],
        ["center", "وسط"],
        ["stretch", "کشیده"],
    ],
    "justify-content": [
        ["flex-start", "ابتدای محور"],
        ["flex-end", "انتهای محور"],
        ["center", "وسط"],
        ["space-between", "فاصله بین"],
        ["space-around", "فاصله اطراف"],
    ],
    "flex-direction": [
        ["row", "ردیف"],
        ["row-reverse", "ردیف برعکس"],
        ["column", "ستون"],
        ["column-reverse", "ستون برعکس"],
    ],
    "object-fit": [
        ["contain", "تصویر کامل"],
        ["cover", "پر کردن قاب"],
        ["fill", "کشیدن در قاب"],
        ["scale-down", "کوچک شدن در قاب"],
    ],
    "object-position": [
        ["center", "وسط"],
        ["center top", "بالا"],
        ["center bottom", "پایین"],
        ["right center", "راست"],
        ["left center", "چپ"],
    ],
    transform: [["none", "حذف زوم و چرخش"]],
    display: [
        ["block", "بلوک"],
        ["flex", "Flex"],
        ["grid", "Grid"],
        ["inline-flex", "Flex داخل خط"],
        ["none", "مخفی"],
    ],
    "flex-wrap": [
        ["nowrap", "یک ردیف"],
        ["wrap", "چند ردیف"],
        ["wrap-reverse", "چند ردیف معکوس"],
    ],
    "justify-self": [
        ["start", "ابتدا"],
        ["end", "انتها"],
        ["center", "وسط"],
        ["stretch", "کشیده"],
    ],
    "align-self": [
        ["auto", "خودکار"],
        ["flex-start", "ابتدا"],
        ["flex-end", "انتها"],
        ["center", "وسط"],
        ["stretch", "کشیده"],
    ],
    "border-style": [
        ["solid", "ساده"],
        ["dashed", "خط‌چین"],
        ["dotted", "نقطه‌ای"],
        ["none", "حذف"],
    ],
    "white-space": [
        ["normal", "شکستن خط طبیعی"],
        ["nowrap", "یک خط"],
        ["pre-wrap", "حفظ خطوط"],
    ],
    overflow: [
        ["visible", "نمایش کامل"],
        ["hidden", "برش اضافات"],
        ["auto", "اسکرول در صورت نیاز"],
    ],
    "overflow-wrap": [
        ["normal", "طبیعی"],
        ["break-word", "شکستن کلمه بلند"],
        ["anywhere", "شکستن آزاد"],
    ],
};
const groups = [
    [
        "منوی ثابت با اسکرول",
        true,
        [
            ["--header-fixed-enabled", "ثابت‌شدن منو"],
            ["--header-fixed-scroll-threshold", "آستانهٔ اسکرول"],
            ["--header-fixed-top", "فاصله از بالا"],
            ["--header-fixed-background-color", "رنگ زمینه"],
            ["--header-fixed-background-opacity", "پوشانندگی زمینه (%)"],
            ["--header-fixed-backdrop-blur", "محو پشت منو"],
            ["--header-fixed-shadow", "سایهٔ منو", true],
        ],
    ],
    [
        "فونت و راست‌چین",
        true,
        [
            ["font-size", "سایز متن"],
            ["line-height", "فاصله خطوط"],
            ["font-weight", "وزن فونت"],
            ["description-lines", "تعداد خطوط · ۰ = کامل"],
            ["text-align", "تراز متن"],
            ["text-align-last", "تراز خط آخر"],
            ["direction", "جهت متن", true],
        ],
    ],
    [
        "ارتفاع و عرض",
        true,
        [
            ["min-height", "حداقل ارتفاع"],
            ["height", "ارتفاع ثابت"],
            ["max-height", "حداکثر ارتفاع"],
            ["max-width", "حداکثر عرض"],
            ["width", "عرض"],
            ["min-width", "حداقل عرض"],
            ["aspect-ratio", "نسبت عرض به ارتفاع"],
            ["border-radius", "گردی گوشه‌ها"],
        ],
    ],
    [
        "فاصله‌های داخلی",
        true,
        [
            ["padding-top", "بالا"],
            ["padding-bottom", "پایین"],
            ["padding-right", "راست"],
            ["padding-left", "چپ"],
        ],
    ],
    [
        "فاصله‌های بیرونی",
        false,
        [
            ["margin-top", "بالا"],
            ["margin-bottom", "پایین"],
            ["margin-right", "راست"],
            ["margin-left", "چپ"],
        ],
    ],
    [
        "چیدمان باکس‌ها",
        false,
        [
            ["display", "نوع چیدمان"],
            ["gap", "فاصله بین باکس‌ها"],
            ["row-gap", "فاصله ردیف‌ها"],
            ["column-gap", "فاصله ستون‌ها"],
            ["grid-template-columns", "ستون‌ها · تعداد یا CSS", true],
            ["grid-template-rows", "ردیف‌ها", true],
            ["grid-auto-flow", "ترتیب Grid"],
            ["grid-column", "ستون این المان"],
            ["grid-row", "ردیف این المان"],
            ["align-items", "تراز محور عرضی"],
            ["justify-content", "تراز محور اصلی"],
            ["flex-direction", "جهت چیدمان", true],
            ["flex-wrap", "شکستن ردیف"],
            ["align-self", "تراز این المان"],
            ["justify-self", "جای این المان در Grid"],
            ["justify-items", "تراز آیتم‌های Grid"],
            ["align-content", "تراز ردیف‌ها"],
            ["flex-basis", "عرض پایه Flex"],
            ["flex-grow", "رشد Flex"],
            ["flex-shrink", "جمع شدن Flex"],
            ["order", "ترتیب المان"],
        ],
    ],
    [
        "حاشیه و کنترل متن",
        false,
        [
            ["border-width", "ضخامت حاشیه"],
            ["border-color", "رنگ حاشیه"],
            ["border-style", "نوع حاشیه"],
            ["letter-spacing", "فاصله حروف"],
            ["word-spacing", "فاصله کلمات"],
            ["white-space", "شکستن متن"],
            ["overflow-wrap", "کلمه‌های بلند"],
            ["overflow", "محتوای اضافی"],
            ["overflow-x", "سرریز افقی"],
            ["overflow-y", "سرریز عمودی"],
            ["visibility", "نمایش / پنهان"],
        ],
    ],
    [
        "تصویر و رنگ",
        false,
        [
            ["image-source", "فایل تصویر درباره ما · مسیر یا URL", true],
            ["object-fit", "نمایش تصویر"],
            ["object-position", "جای تصویر"],
            ["transform", "زوم و چرخش", true],
            ["opacity", "وضوح · ۰ تا ۱"],
            ["box-shadow", "سایه · CSS", true],
            ["color", "رنگ متن"],
            ["background-color", "رنگ پس‌زمینه", true],
        ],
    ],

    [
        "موقعیت و لایه‌ها",
        false,
        [
            ["position", "نوع موقعیت"],
            ["z-index", "ترتیب لایه"],
            ["top", "بالا"],
            ["right", "راست"],
            ["bottom", "پایین"],
            ["left", "چپ"],
            ["box-sizing", "محاسبه اندازه"],
        ],
    ],
    [
        "گوشه‌ها و لینک",
        false,
        [
            ["border-top-right-radius", "بالا راست"],
            ["border-top-left-radius", "بالا چپ"],
            ["border-bottom-right-radius", "پایین راست"],
            ["border-bottom-left-radius", "پایین چپ"],
            ["text-decoration-line", "خط متن"],
            ["text-decoration-color", "رنگ خط"],
            ["text-decoration-thickness", "ضخامت خط"],
            ["text-underline-offset", "فاصله خط"],
            ["text-overflow", "متن اضافی"],
            ["font-style", "استایل فونت"],
            ["list-style-type", "نشانه فهرست"],
        ],
    ],
    [
        "حرکت و تعامل",
        false,
        [
            ["rotate", "چرخش (deg)"],
            ["scale", "مقیاس"],
            ["translate-x", "جابجایی افقی"],
            ["translate-y", "جابجایی عمودی"],
            ["transition-duration", "زمان transition (ms)"],
            ["transition-timing-function", "منحنی حرکت"],
            ["cursor", "نشانگر"],
            ["pointer-events", "واکنش به کلیک"],
        ],
    ],
    [
        "توکن‌های مشترک",
        true,
        [
            ["--color-brand-navy", "سرمه‌ای برند"],
            ["--color-brand-blue", "آبی برند"],
            ["--color-brand-orange", "نارنجی برند"],
            ["--color-page-bg", "پس‌زمینه صفحه"],
            ["--site-gutter", "فاصله از لبه‌ها"],
            ["--site-layout-max-width", "سقف عرض نمایشگر بزرگ"],
            ["--card-radius", "گردی کارت"],
            ["--hero-title-font-size", "عنوان Hero"],
            ["--hero-description-font-size", "توضیح Hero"],
            ["--card-title-font-size", "عنوان کارت"],
            ["--card-description-font-size", "توضیح کارت"],
            ["--card-link-font-size", "اندازه متن لینک کارت"],
            ["--card-media-tag-font-size", "اندازه تگ روی تصویر"],
            ["--card-meta-tag-font-size", "اندازه تگ مشخصات پایین"],
        ],
    ],
];

export function createStyleControls({ container, onChange, onBlur, onInvalid, onReference }) {
    const fields = new Map();
    for (const [title, open, definitions] of groups) {
        const panel = document.createElement("details");
        panel.className = "mps-panel";
        panel.open = open;
        const summary = document.createElement("summary");
        summary.textContent = title;
        const grid = document.createElement("div");
        grid.className = "mps-panel__fields";
        panel.append(summary, grid);
        container.append(panel);
        for (const [name, label, wide] of definitions) {
            const spec = PROPERTIES[name];
            const field = document.createElement("div");
            field.className = `mps-field${wide ? " mps-field--wide" : ""}`;
            const explanation = spec.help || (spec.theme ? describeToken(name).description : "");
            if (spec.theme) field.title = `${name} · ${explanation}`;
            field.dataset.search = `${label} ${name} ${explanation}`.toLowerCase();
            field.dataset.theme = String(Boolean(spec.theme));
            field.dataset.target = spec.target || "";
            const labelRow = document.createElement("div");
            labelRow.className = "mps-field__label";
            const text = document.createElement("label");
            text.htmlFor = `control-${name}`;
            text.textContent = label;
            const reset = document.createElement("button");
            reset.type = "button";
            reset.className = "mps-field__reset";
            reset.textContent = "↺";
            reset.title = "حذف مقدار این قانون";
            reset.setAttribute("aria-label", `بازنشانی ${label}`);
            labelRow.append(text, reset);
            if (spec.theme && onReference) {
                const help = document.createElement("button");
                help.type = "button";
                help.className = "mps-field__help";
                help.textContent = "؟";
                help.title = explanation;
                help.setAttribute("aria-label", `راهنمای ${label}`);
                help.addEventListener("click", () => onReference(name));
                labelRow.append(help);
            }
            const row = document.createElement("div");
            row.className = "mps-field__input";
            const input = document.createElement(spec.type === "choice" ? "select" : "input");
            let unit = null,
                picker = null;
            if (spec.type === "choice") {
                input.append(option("", "استایل پایه"));
                for (const value of spec.values)
                    input.append(option(value, choices[name]?.find((item) => item[0] === value)?.[1] || value));
            } else {
                input.type = spec.type === "number" && !spec.text ? "number" : "text";
                input.autocomplete = "off";
                input.spellcheck = false;
                input.dir = "ltr";
                if (input.type === "number") {
                    input.inputMode = "decimal";
                    input.min = spec.min;
                    input.max = spec.max;
                    input.step = ["columns", "lines"].includes(spec.unit) || spec.integer ? "1" : "0.1";
                }
                input.placeholder = spec.example || (spec.text ? "3 یا 1fr 2fr" : "");
                if (spec.units) {
                    unit = document.createElement("select");
                    unit.id = `unit-${name}`;
                    unit.className = "mps-field__unit-select";
                    unit.setAttribute("aria-label", `واحد ${label}`);
                    for (const value of spec.units) unit.append(option(value, value));
                    row.append(unit);
                } else if (spec.unit && !["columns", "lines"].includes(spec.unit)) {
                    const unitLabel = document.createElement("span");
                    unitLabel.className = "mps-field__unit";
                    unitLabel.textContent = spec.unit;
                    row.append(unitLabel);
                }
                if (choices[name] && spec.type === "text") {
                    const suggestions = document.createElement("datalist");
                    suggestions.id = `suggestions-${name}`;
                    for (const [value, label] of choices[name]) suggestions.append(option(value, label));
                    input.setAttribute("list", suggestions.id);
                    field.append(suggestions);
                }
                if (spec.type === "color") {
                    picker = document.createElement("input");
                    picker.type = "color";
                    picker.className = "mps-color-picker";
                    picker.setAttribute("aria-label", `انتخاب ${label}`);
                    row.append(picker);
                    picker.addEventListener("input", () => {
                        input.value = picker.value;
                        onChange(name, picker.value, true);
                    });
                }
            }
            input.id = `control-${name}`;
            input.dataset.property = name;
            row.prepend(input);
            field.append(labelRow, row);
            if (spec.theme) {
                const code = document.createElement("code");
                code.className = "mps-field__token";
                code.textContent = name;
                code.dir = "ltr";
                field.append(code);
            }
            const actual = document.createElement("small");
            actual.className = "mps-field__actual";
            actual.dir = "ltr";
            field.append(actual);
            if (spec.help) {
                const help = document.createElement("small");
                help.className = "mps-help";
                help.id = `help-${name}`;
                help.textContent = spec.help;
                input.setAttribute("aria-describedby", help.id);
                field.append(help);
            }
            const entry = { field, input, reset, unit, picker, actual, panel };
            const read = () => {
                let value = spec.type === "image" ? input.value.trim() : digits(input.value.trim());
                if (!value) value = undefined;
                else if (spec.type === "number" && !spec.extra?.includes(value) && Number.isFinite(Number(value))) {
                    value = Number(value);
                    if (unit && unit.value !== spec.unit) value = `${value}${unit.value}`;
                }
                if (typeof value === "string" && (spec.type === "text" || spec.text) && !CSS.supports(name, value)) {
                    input.setCustomValidity("مقدار CSS معتبر نیست.");
                    onInvalid?.(`مقدار ${name} از نظر CSS معتبر نیست.`);
                    return;
                }
                input.setCustomValidity("");
                onChange(name, value, true);
            };
            input.addEventListener(["choice", "image"].includes(spec.type) ? "change" : "input", read);
            input.addEventListener("blur", onBlur);
            if (unit)
                unit.addEventListener("change", () => {
                    input.min = spec.min < 0 ? -7680 : 0;
                    input.max = unit.value === spec.unit ? spec.max : 7680;
                    read();
                });
            for (const value of spec.extra || []) {
                const extra = document.createElement("button");
                extra.type = "button";
                extra.className = "mps-field__extra";
                extra.textContent = value;
                extra.addEventListener("click", () => onChange(name, value));
                field.append(extra);
            }
            reset.addEventListener("click", () => onChange(name, undefined));
            fields.set(name, entry);
            grid.append(field);
        }
    }
    return fields;
}

export function setControlValue(name, entry, value, actual) {
    const { input, unit, picker } = entry,
        spec = PROPERTIES[name];
    if (input.tagName === "SELECT") input.value = spec.values.includes(String(value)) ? String(value) : "";
    else if (input.type === "number" && typeof value === "string") {
        const match = value.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%|vw|vh|dvh|svh|lvh|vmin|vmax)$/);
        input.value = match && unit ? match[1] : "";
        input.placeholder = match ? "" : value;
        if (unit) unit.value = match?.[2] || spec.unit;
    } else {
        input.value = String(value ?? "");
        if (unit) unit.value = spec.unit;
    }
    if (unit) {
        input.min = unit.value === spec.unit ? spec.min : spec.min < 0 ? -7680 : 0;
        input.max = unit.value === spec.unit ? spec.max : 7680;
    }
    if (picker && /^#[\da-f]{6,8}$/i.test(String(value))) picker.value = value.slice(0, 7);
    entry.actual.textContent = actual ? `computed: ${actual}` : "";
}

export function filterStyleControls(fields, query, theme = false, targetKey = "") {
    const search = query.trim().toLowerCase();
    for (const { field } of fields.values())
        field.hidden =
            (field.dataset.theme === "true") !== theme ||
            Boolean(field.dataset.target && field.dataset.target !== targetKey) ||
            Boolean(search && !field.dataset.search.includes(search));
    const panels = new Set([...fields.values()].map((entry) => entry.panel));
    for (const panel of panels) {
        panel.hidden = ![...panel.querySelectorAll(".mps-field")].some((field) => !field.hidden);
        if (search && !panel.hidden) panel.open = true;
    }
}
