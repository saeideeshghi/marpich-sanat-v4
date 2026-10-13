import tokens from "virtual:design-tokens";
import { PAGE_NAMES, BREAKPOINTS } from "./schema.js";
import { normalizeTokenValue, tokenRule } from "./token-values.js";
import { ruleKey, ruleAppliesAtWidth } from "./model.js";

const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
};
const searchText = (value) => value.toLowerCase().replaceAll("ي", "ی").replaceAll("ك", "ک");
const searchable = new Map(
    tokens.map((token) => [
        token.name,
        searchText(
            [
                token.name,
                token.label,
                token.description,
                token.group,
                ...token.pages.map((page) => PAGE_NAMES[page]),
                ...token.definitions.map((definition) => definition.file),
            ].join(" "),
        ),
    ]),
);

function liveValue(token, document) {
    if (!document?.body) return null;
    // Local variables must be read on their consumer, not always on body.
    const locations = [...token.usages.filter((usage) => !usage.property?.startsWith("--")), ...token.definitions];
    for (const place of locations) {
        if (!place.selector || place.selector.startsWith("@") || place.selector === "JavaScript") continue;
        const pseudo = place.selector.match(/::(before|after)$/)?.[0] || null;
        const selector = pseudo ? place.selector.slice(0, -pseudo.length) : place.selector;
        try {
            const elements = [...document.querySelectorAll(selector)];
            const element = elements.find((item) => item.getClientRects().length);
            if (!element) continue;
            const computed = document.defaultView.getComputedStyle(element, pseudo);
            const value = computed.getPropertyValue(token.name).trim();
            if (value) return { value, selector: place.selector };
        } catch {
            /* Some source selectors belong to build-time utilities. */
        }
    }
    const value = document.defaultView.getComputedStyle(document.body).getPropertyValue(token.name).trim();
    return value ? { value, selector: "body[data-page]" } : null;
}

/** Shared dictionary UI: static source help in its page, live computed help in the editor. */
export function createTokenReference({ container, getContext, onEdit }) {
    const params = new URLSearchParams(location.search);
    const search = node("input");
    search.type = "search";
    search.dir = "auto";
    search.placeholder = "مثلاً فونت هیرو، --card-radius یا type-settings";
    search.value = params.get("q") || "";
    search.setAttribute("aria-label", "جست‌وجوی نام یا کاربرد متغیر");
    const group = node("select");
    group.setAttribute("aria-label", "گروه متغیرها");
    const option = (value, label) => {
        const element = node("option", "", label);
        element.value = value;
        return element;
    };
    group.append(option("", "همهٔ بخش‌ها"));
    for (const name of [...new Set(tokens.map((token) => token.group))]) group.append(option(name, name));
    const page = node("select");
    page.setAttribute("aria-label", "صفحهٔ مرتبط با متغیرها");
    page.append(option("", "همهٔ صفحه‌ها"));
    for (const [key, name] of Object.entries(PAGE_NAMES)) page.append(option(key, name));
    page.value = PAGE_NAMES[params.get("page")] ? params.get("page") : "";
    const onlyPage = node("input");
    onlyPage.type = "checkbox";
    onlyPage.checked = Boolean(getContext);
    const pageLabel = node("label", "mps-token-current-page", "مشترک‌ها و همین صفحه");
    pageLabel.prepend(onlyPage);
    pageLabel.hidden = !getContext;
    page.hidden = Boolean(getContext);
    const filters = node("div", "mps-token-filters");
    filters.append(search, group, page, pageLabel);
    const count = node("p", "mps-token-count");
    count.setAttribute("role", "status");
    const list = node("div", "mps-token-list");
    const empty = node("p", "mps-token-empty", "متغیری پیدا نشد؛ نام یا بخش دیگری را جست‌وجو کن.");
    const editScope = node("div", "mps-token-edit-scope");
    editScope.hidden = !onEdit;
    const scope = node("select");
    scope.id = "token-scope";
    scope.append(option("page", "همین صفحه"), option("global", "همهٔ صفحه‌های مرتبط"));
    const breakpoint = node("select");
    breakpoint.id = "token-breakpoint";
    for (const item of BREAKPOINTS) breakpoint.append(option(item.key, item.label));
    const minimum = node("input"),
        maximum = node("input");
    for (const [input, id, value] of [
        [minimum, "token-range-min", 360],
        [maximum, "token-range-max", 480],
    ]) {
        input.id = id;
        input.type = "number";
        input.min = 0;
        input.max = 7680;
        input.step = 1;
        input.value = value;
    }
    const labeled = (text, input) => {
        const label = node("label", "", text);
        label.append(input);
        return label;
    };
    const range = node("div", "mps-token-edit-range");
    range.append(labeled("از عرض (px)", minimum), labeled("تا عرض (خالی: بدون سقف)", maximum));
    range.hidden = true;
    editScope.append(
        labeled("محدودهٔ تغییر", scope),
        labeled("اندازهٔ صفحه", breakpoint),
        range,
        node(
            "p",
            "mps-token-note",
            "مقدار را در کارت متغیر وارد کن و «اعمال در پیش‌نمایش» را بزن. برای ذخیرهٔ دائمی از دکمهٔ ثبت بالای کاستومایزر استفاده کن. بازنشانی فقط تغییر همین متغیر در همین محدوده را حذف می‌کند.",
        ),
    );
    container.replaceChildren(editScope, filters, count, list, empty);
    const currentValues = new Map();
    let previousPage;
    let refreshFrame = 0;
    function editContext() {
        const context = getContext?.();
        const min = Number(minimum.value),
            max = maximum.value === "" ? null : Number(maximum.value);
        if (
            breakpoint.value === "range" &&
            (!minimum.value ||
                !Number.isInteger(min) ||
                min < 0 ||
                min > 7680 ||
                (max !== null && (!Number.isInteger(max) || max < min || max > 7680)))
        )
            throw new Error("بازهٔ عرض معتبر نیست؛ حداقل را وارد کن و حداکثر را برابر یا بیشتر از آن بگذار.");
        return { ...context, scope: scope.value, breakpoint: breakpoint.value, range: { min, max } };
    }
    function storedRule(token) {
        const context = editContext();
        return context.rules?.find((rule) => ruleKey(rule) === ruleKey(tokenRule(token.name, context)));
    }

    function updateValue(token, output) {
        const context = getContext?.();
        if (!context) {
            output.hidden = true;
            return;
        }
        const current = liveValue(token, context.document);
        output.replaceChildren(node("span", "", `در ${PAGE_NAMES[context.page]} · عرض ${context.width}px`));
        output.append(node("code", "", current?.value || "مقدار مستقیمی در این صفحه پیدا نشد"));
        if (current) output.append(node("small", "", `روی ${current.selector}`));
        output.hidden = false;
    }
    function makeCard(token) {
        const card = node("details", "mps-token-card");
        card.dataset.tokenName = token.name;
        const summary = node("summary");
        summary.append(node("strong", "", token.label), node("code", "", token.name));
        const body = node("div", "mps-token-card__body");
        const badges = node("div", "mps-token-badges");
        for (const label of [
            token.group,
            token.shared ? "مشترک" : token.pages.map((name) => PAGE_NAMES[name]).join("، "),
            token.editable ? "قابل ویرایش" : "تنظیم خودکار / ساخت",
            token.runtime ? "محاسبهٔ خودکار" : "",
        ])
            if (label) badges.append(node("span", "", label));
        body.append(badges, node("p", "", token.description));
        if (token.contract?.reason) body.append(node("p", "mps-token-note", token.contract.reason));
        if (token.runtime)
            body.append(
                node(
                    "p",
                    "mps-token-note",
                    "مقدارهای محاسبه‌شده ممکن است با تغییر محتوا یا اندازهٔ صفحه دوباره توسط JavaScript تنظیم شوند.",
                ),
            );
        if (token.buildToken)
            body.append(
                node(
                    "p",
                    "mps-token-note",
                    "در @theme تعریف شده است؛ بخشی از utilityهای Tailwind هنگام ساخت از این توکن ساخته می‌شوند.",
                ),
            );
        if (!token.usages.length && !token.buildToken)
            body.append(
                node(
                    "p",
                    "mps-token-note",
                    "تعریف موجود است؛ مصرف مستقیم var() یا خواندن در JavaScript در فایل‌های این نسخه پیدا نشد.",
                ),
            );
        const value = node("div", "mps-token-value");
        value.hidden = true;
        body.append(value);
        currentValues.set(token.name, { token, card, value });
        if (token.editable && onEdit) {
            const form = node("form", "mps-token-edit");
            const input = node("input");
            input.id = `token-value-${token.name.slice(2)}`;
            input.type = "text";
            input.dir = "ltr";
            input.autocomplete = "off";
            input.spellcheck = false;
            input.dataset.tokenValue = token.name;
            const help = node("p", "mps-token-note");
            help.id = `${input.id}-help`;
            help.textContent = {
                length: "عدد ساده به px تبدیل می‌شود. مثال: 24px، 2rem، 50% یا clamp(24px, 4vw, 64px).",
                color: "رنگ: #79b6ed یا rgb(121 182 237 / 0.8)؛ شفافیت را هم می‌توانی وارد کنی.",
                shadow: "سایه: 0 8px 24px rgb(15 23 43 / 0.12)؛ none سایه را حذف می‌کند.",
                ratio: "نسبت عرض به ارتفاع؛ مثلاً 16 / 9 یا 2.12.",
                font: 'نام فونت و جایگزین‌ها؛ مثلاً "Peyda", Tahoma, sans-serif. فایل فونت باید در پروژه موجود باشد.',
                number: "عدد بدون واحد؛ مثلاً 1.7. برای فاصلهٔ خط‌ها، این عدد در اندازهٔ فونت ضرب می‌شود.",
                integer: `عدد صحیح بین ${token.contract.min} تا ${token.contract.max}؛ بدون px یا درصد.`,
            }[token.contract.kind];
            if (token.device)
                help.textContent += ` این نام مخصوص ${token.device} است؛ معمولاً «همه اندازه‌ها» مناسب است چون انتخاب دستگاه در نام متغیر انجام شده.`;
            input.setAttribute("aria-describedby", help.id);
            const status = node("p", "mps-token-edit-status");
            status.setAttribute("role", "status");
            const apply = node("button", "", "اعمال در پیش‌نمایش");
            apply.type = "submit";
            const reset = node("button", "", "بازنشانی این محدوده");
            reset.type = "button";
            const actions = node("div", "mps-token-actions");
            actions.append(apply, reset);
            form.append(labeled("مقدار جدید", input));
            let picker;
            if (token.contract.kind === "color") {
                picker = node("input", "mps-token-color");
                picker.type = "color";
                picker.setAttribute("aria-label", `انتخاب ${token.label}`);
                picker.addEventListener("input", () => {
                    input.value = picker.value;
                });
                form.append(picker);
            }
            form.append(help, actions, status);
            body.append(form);
            const entry = { input, reset, apply, status, picker };
            currentValues.get(token.name).editor = entry;
            const change = (value) => {
                try {
                    const context = editContext();
                    if (value !== undefined) {
                        value = normalizeTokenValue(token.name, value);
                        if (!CSS.supports(token.contract.property, value))
                            throw new Error("این مقدار از نظر CSS معتبر نیست؛ واحد و نمونهٔ زیر فیلد را بررسی کن.");
                    }
                    onEdit(token.name, value, context);
                    input.setCustomValidity("");
                    updateEditor(token, entry);
                } catch (error) {
                    input.setCustomValidity(error.message);
                    status.textContent = error.message;
                    status.dataset.error = "true";
                }
            };
            input.addEventListener("input", () => input.setCustomValidity(""));
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                change(input.value.trim() || undefined);
            });
            reset.addEventListener("click", () => change(undefined));
        }
        const family = tokens.filter((item) => item.family === token.family && item.name !== token.name);
        if (family.length) {
            const row = node("div", "mps-token-family");
            row.append(node("span", "", "نام‌های مرتبط:"));
            for (const related of family) {
                const button = node("button", "", related.device || "فعال");
                button.type = "button";
                button.title = related.name;
                button.addEventListener("click", () => show(related.name));
                row.append(button);
            }
            body.append(row);
        }
        const actions = node("div", "mps-token-actions");
        if (token.editable && !onEdit) {
            const edit = node("a", "", "باز کردن در کاستومایزر ↗");
            const url = new URL("./customizer.html", location.href);
            url.searchParams.set("token", token.name);
            if (page.value) url.searchParams.set("page", page.value);
            edit.href = url.href;
            actions.append(edit);
        }
        const copy = node("button", "", "کپی نام");
        copy.type = "button";
        copy.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(token.name);
                copy.textContent = "کپی شد";
            } catch {
                copy.textContent = "نام را از بالای کارت انتخاب و کپی کن";
            }
        });
        actions.append(copy);
        body.append(actions);
        body.append(node("h3", "", "محل تعریف و مقدار در فایل"));
        if (!token.definitions.length)
            body.append(
                node(
                    "p",
                    "mps-token-note",
                    "تعریف ثابت ندارد؛ از مقدار جایگزین var() یا تنظیم اختصاصی کاستومایزر استفاده می‌کند.",
                ),
            );
        for (const definition of token.definitions) {
            const source = node("div", "mps-token-source");
            source.append(
                node("code", "", `${definition.file}:${definition.line}`),
                node("code", "", definition.selector),
                node("code", "", definition.media || "بدون شرط media"),
                node("code", "mps-token-source__value", definition.value),
            );
            body.append(source);
        }
        const uses = node("details", "mps-token-usages");
        uses.append(node("summary", "", `محل استفاده · ${token.usages.length.toLocaleString("fa")} مورد`));
        for (const usage of token.usages) {
            const source = node("div", "mps-token-source");
            source.append(
                node("code", "", `${usage.file}:${usage.line}`),
                node("code", "", usage.selector),
                node("code", "", usage.media || "بدون شرط media"),
                node("code", "", usage.property ? `${usage.property}: ${usage.value}` : "خواندن در JavaScript"),
            );
            uses.append(source);
        }
        body.append(uses);
        card.append(summary, body);
        card.addEventListener("toggle", () => {
            if (card.open) {
                updateValue(token, value);
                const editor = currentValues.get(token.name)?.editor;
                if (editor) updateEditor(token, editor);
            }
        });
        return card;
    }
    function updateEditor(token, entry) {
        try {
            const context = editContext(),
                rule = storedRule(token);
            const current = liveValue(token, context.document);
            const edited = rule?.properties[token.name];
            if (document.activeElement !== entry.input) entry.input.value = edited ?? "";
            entry.input.placeholder =
                current?.value || token.definitions.find((definition) => !definition.runtime)?.value || "مقدار جدید";
            entry.reset.disabled = edited === undefined || context.busy || !context.ready;
            entry.apply.disabled = context.busy || !context.ready;
            if (entry.picker && /^#[\da-f]{6,8}$/i.test(edited || current?.value || ""))
                entry.picker.value = (edited || current.value).slice(0, 7);
            entry.status.dataset.error = "false";
            entry.status.textContent =
                edited === undefined
                    ? "در این محدوده تغییری ثبت نشده است؛ مقدار فعلی در کادر سبز دیده می‌شود."
                    : rule.enabled === false
                      ? "قانون این متغیر خاموش است؛ از فهرست قوانین فعالش کن."
                      : !ruleAppliesAtWidth(rule, context.width)
                        ? `تغییر در پیش‌نویس هست؛ عرض فعلی ${context.width}px خارج از این بازه است.`
                        : context.comparing
                          ? "نمایش نسخهٔ ذخیره‌شده فعال است؛ برای دیدن پیش‌نویس مقایسه را خاموش کن."
                          : "تغییر در پیش‌نمایش اعمال شد؛ برای نگه‌داشتن آن دکمهٔ ثبت بالای صفحه را بزن.";
            if (token.usages.some((usage) => ["font-size", "line-height"].includes(usage.property)))
                entry.status.textContent += " سایز یا فاصلهٔ خط مستقیم در تب استایل، از متغیر اولویت بیشتری دارد.";
        } catch (error) {
            entry.apply.disabled = true;
            entry.status.textContent = error.message;
            entry.status.dataset.error = "true";
        }
    }
    for (const input of [scope, breakpoint, minimum, maximum])
        input.addEventListener("change", () => {
            range.hidden = breakpoint.value !== "range";
            for (const { token, editor } of currentValues.values()) if (editor) updateEditor(token, editor);
        });
    function render() {
        const context = getContext?.();
        previousPage = context?.page;
        const selectedPage = context ? (onlyPage.checked ? context.page : "") : page.value;
        const terms = searchText(search.value).trim().split(/\s+/).filter(Boolean);
        const matches = tokens.filter(
            (token) =>
                (!group.value || token.group === group.value) &&
                (!selectedPage || token.shared || token.pages.includes(selectedPage)) &&
                terms.every((term) => searchable.get(token.name).includes(term)),
        );
        currentValues.clear();
        list.replaceChildren(...matches.map(makeCard));
        empty.hidden = matches.length > 0;
        count.textContent = `${matches.length.toLocaleString("fa")} از ${tokens.length.toLocaleString("fa")} متغیر${context ? ` · ${PAGE_NAMES[context.page]}` : ""}`;
        if (matches.length === 1) list.firstElementChild.open = true;
    }
    function show(name) {
        search.value = name;
        group.value = "";
        onlyPage.checked = false;
        page.value = "";
        render();
        const card = currentValues.get(name)?.card;
        if (card) {
            card.open = true;
            card.scrollIntoView({ block: "nearest" });
        }
    }
    for (const input of [search, group, page, onlyPage])
        input.addEventListener(input === search ? "input" : "change", render);
    render();
    return {
        show,
        editRule(rule) {
            scope.value = rule.page === "*" ? "global" : "page";
            breakpoint.value = rule.breakpoint;
            if (rule.range) {
                minimum.value = rule.range.min;
                maximum.value = rule.range.max ?? "";
            }
            range.hidden = breakpoint.value !== "range";
            show(rule.target.key);
        },
        refresh() {
            if (container.closest("[hidden]")) return;
            cancelAnimationFrame(refreshFrame);
            refreshFrame = requestAnimationFrame(() => {
                if (getContext?.().page !== previousPage) render();
                for (const { token, card, value, editor } of currentValues.values())
                    if (card.open) {
                        updateValue(token, value);
                        if (editor) updateEditor(token, editor);
                    }
            });
        },
    };
}

export const tokenStats = {
    total: tokens.length,
    groups: new Set(tokens.map((token) => token.group)).size,
    editable: tokens.filter((token) => token.editable).length,
};
