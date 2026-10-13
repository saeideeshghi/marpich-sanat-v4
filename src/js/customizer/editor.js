import "../../css/customizer.css";
import "../../css/token-reference.css";
import { pages } from "../../../build/pages.js";
import {
    BREAKPOINTS,
    PAGE_NAMES,
    TARGETS,
    PROPERTIES,
    normalizeConfig,
    compileCSS,
    defaultConfig,
    ruleKey,
    targetSelector,
    ruleAppliesAtWidth,
    STATES,
} from "./model.js";
import { createStyleControls, setControlValue, filterStyleControls } from "./controls.js";
import { downloadSettings } from "./export.js";
import { describeElement, semanticClasses, elementSelector, repeatedSelector } from "./picker.js";
import { createPatternEditor } from "./pattern-editor.js";
import { createViewportResizer } from "./viewport.js";
import { normalizeZoom, previewGeometry, ZOOM_LIMITS } from "./zoom.js";
import { savePreviewSnapshot, previewURL } from "./preview-session.js";
import { removeSharedPropertyOverrides } from "./shared-overrides.js";
import { imageSourceRules } from "./image-source.js";
import { createTokenReference } from "./token-reference.js";
import { tokenRule } from "./token-values.js";
import { describeToken } from "./token-descriptions.js";
import { createAboutImageControls } from "./about-image-controls.js";

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(
    [
        "page",
        "width",
        "target",
        "scope",
        "breakpoint",
        "preview",
        "stage",
        "frame-shell",
        "loading",
        "controls",
        "status",
        "connection",
        "save-state",
        "save",
        "undo",
        "redo",
        "pick",
        "compare",
        "selection-label",
        "match-count",
        "parent",
        "similar",
        "locate",
        "rules",
        "rule-count",
        "confirm",
        "confirm-summary",
        "confirm-pages",
        "confirm-mode",
        "confirm-save",
        "save-error",
        "preview-caption",
        "scale",
        "open-preview",
    ].map((id) => [id, $(id)]),
);
const base = import.meta.env.BASE_URL;
const cacheKey = `marpich-customizer-draft:${base}`;
const preferencesKey = `marpich-customizer-view:${base}`;
const clone = (value) => structuredClone(value);
const asText = (element, value) => {
    element.textContent = value;
};
const labelFor = (target) =>
    target.kind === "token"
        ? `متغیر · ${describeToken(target.key).label}`
        : target.kind === "role"
          ? TARGETS.find((role) => role.key === target.key)?.label
          : target.label;
let saved = defaultConfig(),
    draft = clone(saved),
    revision = "",
    token = "",
    canSave = false;
let currentPage = "home",
    currentWidth = 1440,
    currentBreakpoint = "desktop",
    scope = "page";
let target = { kind: "role", key: "hero-title" },
    selectedElement = null,
    similarSelector = "";
let exactTarget = null,
    componentSelector = "",
    editorMode = "style",
    customRange = { min: 360, max: 480 };
let currentState = "normal",
    forceState = false,
    copiedProperties = null;
let extraOverlays = [];
let frameDocument = null,
    draftStyle = null,
    savedLink = null,
    overlay = null,
    hoverOverlay = null;
let frameLayoutObserver = null;
let pickEnabled = true,
    comparing = false,
    busy = false,
    scale = 1,
    ready = false;
let treeElement = null,
    treeNodes = [];
let history = [clone(draft)],
    historyIndex = 0,
    lastChange = { key: "", at: 0 },
    lastRules = "";
let previewId = null;
let previewZoom = "fit";

const option = (value, label) => {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = label;
    return item;
};
for (const page of pages) ui.page.append(option(page.name, PAGE_NAMES[page.name]));
for (const item of BREAKPOINTS) ui.breakpoint.append(option(item.key, item.label));
for (const item of STATES) $("element-state").append(option(item.key, item.label));

const fields = createStyleControls({
    container: ui.controls,
    onChange: changeProperty,
    onBlur: refreshFields,
    onInvalid: (text) => message(text, true),
    onReference: showToken,
});
const aboutImageControls = createAboutImageControls({
    container: $("about-image-controls"),
    getContext: () => ({
        page: currentPage,
        breakpoint: currentBreakpoint,
        range: customRange,
        width: currentWidth,
        config: comparing ? saved : draft,
        document: frameDocument,
        enabled: ready && !busy && !comparing,
    }),
    onChange: (next, key) => {
        commit(next, key);
        refreshFields();
        message("تصویر درباره ما در همین اندازه به‌روز شد؛ برای ذخیره، تأیید و ثبت را بزن.");
    },
    onSize: (breakpoint, width) => {
        currentBreakpoint = breakpoint;
        ui.breakpoint.value = breakpoint;
        if (width) setWidth(width, breakpoint);
        refreshTargets();
        refreshFields();
    },
    onInvalid: (text) => message(text, true),
});
const viewportResizer = createViewportResizer({
    handles: document.querySelectorAll("[data-resize-side]"),
    stage: ui.stage,
    getWidth: () => currentWidth,
    getScale: () => scale,
    setWidth,
});

function activeRule() {
    return {
        page: target.kind === "element" || scope === "page" ? currentPage : "*",
        breakpoint: currentBreakpoint,
        ...(currentBreakpoint === "range" ? { range: clone(customRange) } : {}),
        target: clone(target),
        ...(currentState !== "normal" ? { state: currentState } : {}),
        properties: {},
    };
}
function activeProperties() {
    return draft.rules.find((rule) => ruleKey(rule) === ruleKey(activeRule()))?.properties || {};
}
function matchingElements() {
    if (!frameDocument) return [];
    const selector = targetSelector(target);
    return selector ? [...frameDocument.querySelectorAll(selector)] : [frameDocument.body];
}
function message(text, error = false) {
    asText(ui.status, text);
    ui.status.dataset.error = String(error);
}
function isDirty() {
    return JSON.stringify(saved) !== JSON.stringify(draft);
}

function remember(viewOnly = false) {
    try {
        localStorage.setItem(
            preferencesKey,
            JSON.stringify({ page: currentPage, width: currentWidth, zoom: previewZoom }),
        );
        if (viewOnly) return;
        if (isDirty())
            localStorage.setItem(cacheKey, JSON.stringify({ baseline: JSON.stringify(saved), config: draft }));
        else localStorage.removeItem(cacheKey);
    } catch {
        /* Export and real file writeback remain available without storage. */
    }
}

function commit(next, changeKey = "") {
    if (busy || !ready) return;
    next = normalizeConfig(next);
    if (JSON.stringify(next) === JSON.stringify(draft)) return;
    const now = Date.now();
    history = history.slice(0, historyIndex + 1);
    if (changeKey && lastChange.key === changeKey && now - lastChange.at < 700 && historyIndex > 0)
        history[historyIndex] = clone(next);
    else {
        history.push(clone(next));
        historyIndex++;
    }
    if (history.length > 80) {
        history.shift();
        historyIndex--;
    }
    lastChange = { key: changeKey, at: now };
    draft = next;
    comparing = false;
    applyDraft();
    refreshState();
    patternEditor.render();
    remember();
}

function changeProperty(name, value, fromInput = false) {
    if (busy || !ready) return;
    const next = clone(draft),
        rule = activeRule(),
        key = ruleKey(rule);
    let existing = next.rules.find((item) => ruleKey(item) === key);
    if (!existing) {
        existing = rule;
        next.rules.push(existing);
    }
    if (value === undefined) delete existing.properties[name];
    else existing.properties[name] = value;
    if (scope === "global" && value !== undefined && $("unify-shared").checked)
        removeSharedPropertyOverrides(next, existing, name);
    if (target.kind === "component" && value !== undefined && $("unify-repeats").checked) {
        const elements = new Set(matchingElements());
        for (const item of next.rules)
            if (
                item.target.kind === "element" &&
                item.page === currentPage &&
                item.breakpoint === currentBreakpoint &&
                JSON.stringify(item.range) === JSON.stringify(rule.range) &&
                (item.state || "normal") === currentState
            ) {
                if (elements.has(frameDocument?.querySelector(item.target.selector))) delete item.properties[name];
            }
    }
    try {
        commit(next, `${key}:${name}`);
        message("پیش‌نمایش به‌روز شد؛ برای ثبت روی قالب، تأیید و ثبت را بزن.");
        if (!fromInput) refreshFields();
        else refreshFieldMarkers();
    } catch (error) {
        message(error.message, true);
    }
}

function refreshTargets() {
    $("about-image-shortcuts").hidden = currentPage !== "about";
    $("fixed-header-shortcuts").hidden = target.kind !== "role" || target.key !== "header-behavior";
    ui.target.replaceChildren();
    if (target.kind !== "role") ui.target.append(option("__picked", `انتخاب‌شده · ${target.label.slice(0, 45)}`));
    const grouped = new Map();
    const search = $("target-search").value.trim().toLowerCase();
    for (const role of TARGETS) {
        if (role.pages && !role.pages.includes(currentPage)) continue;
        if (
            search &&
            role.key !== target.key &&
            !`${role.label} ${role.key} ${role.group}`.toLowerCase().includes(search)
        )
            continue;
        if (!grouped.has(role.group)) {
            const group = document.createElement("optgroup");
            group.label = role.group;
            grouped.set(role.group, group);
            ui.target.append(group);
        }
        grouped.get(role.group).append(option(role.key, role.label));
    }
    ui.target.value = target.kind !== "role" ? "__picked" : target.key;
    const restricted = target.kind === "element" || TARGETS.find((role) => role.key === target.key)?.pages;
    if (restricted) scope = "page";
    ui.scope.disabled = Boolean(restricted);
    ui.scope.value = scope;
    const shared = scope === "global" && target.kind !== "element";
    $("shared-scope-note").hidden = !shared;
    $("unify-shared-label").hidden = !shared;
    asText(
        $("shared-scope-note"),
        "پس از ثبت، این تنظیم در همه صفحه‌هایی که همین جزء را دارند اعمال می‌شود. یکسان‌سازی، مقدارهای اختصاصی همین جزء و همین بازه را هم جایگزین می‌کند.",
    );
    ui.breakpoint.value = currentBreakpoint;
    $("custom-range").hidden = currentBreakpoint !== "range";
    $("range-min").value = customRange.min;
    $("range-max").value = customRange.max ?? "";
    $("selection-mode").hidden = !exactTarget;
    $("repeat-mode").value = target.kind === "component" ? "component" : "exact";
    $("repeat-mode").querySelector('[value="component"]').disabled = !componentSelector;
    $("unify-label").hidden = target.kind !== "component";
    $("element-state").value = currentState;
    $("state-preview").checked = forceState;
    $("state-preview").disabled = currentState === "normal";
    filterStyleControls(
        fields,
        $("property-search").value,
        target.kind === "role" && target.key === "theme",
        target.kind === "role" && currentState === "normal" ? target.key : "",
    );
    refreshRangeStatus();
}

function colorHex(value) {
    if (value.startsWith("#") || value === "transparent") return value;
    const values = value.match(/[\d.]+/g)?.map(Number);
    if (!values || values[3] === 0) return "transparent";
    const rgb = values
        .slice(0, 3)
        .map((number) => Math.round(number).toString(16).padStart(2, "0"))
        .join("");
    return `#${rgb}${
        values[3] !== undefined && values[3] < 1
            ? Math.round(values[3] * 255)
                  .toString(16)
                  .padStart(2, "0")
            : ""
    }`;
}
function refreshRangeStatus() {
    const rule = activeRule(),
        stored = draft.rules.find((item) => ruleKey(item) === ruleKey(rule)),
        active = ruleAppliesAtWidth(stored || rule, currentWidth);
    const range = rule.range
        ? `${rule.range.min} تا ${rule.range.max ?? "بدون سقف"}px`
        : BREAKPOINTS.find((item) => item.key === rule.breakpoint).label;
    asText(
        $("range-status"),
        `${range} · این قانون در عرض ${currentWidth}px ${active ? "فعال" : "غیرفعال"} است.${currentState !== "normal" ? ` حالت ${currentState}${forceState ? " در پیش‌نمایش شبیه‌سازی می‌شود" : " با تعامل واقعی فعال می‌شود"}.` : ""}`,
    );
    asText($("selection-selector"), targetSelector(target) || "body[data-page]");
    const properties = activeProperties();
    asText(
        $("css-output"),
        Object.keys(properties).length
            ? compileCSS({ version: 1, rules: [{ ...rule, properties }] })
            : "/* این محدوده تنظیم اختصاصی ندارد. */",
    );
}
function computedValue(name, element) {
    if (name === "image-source") {
        const source = element?.getAttribute("src") || "";
        return base !== "/" && source.startsWith(base) ? `/${source.slice(base.length)}` : source;
    }
    if (!element) return "";
    const computed = element.ownerDocument.defaultView.getComputedStyle(element),
        raw = computed.getPropertyValue(name).trim(),
        spec = PROPERTIES[name];
    if (name === "translate-x" || name === "translate-y") {
        const values = computed.translate.split(" ");
        return parseFloat(values[name === "translate-x" ? 0 : 1] || "0") || 0;
    }
    if (name === "description-lines") return Number.parseInt(computed.webkitLineClamp, 10) || 0;
    if (name === "grid-template-columns")
        return computed.display === "grid" && raw !== "none" ? raw.split(" ").length : "";
    if (spec.type === "color") return colorHex(raw);
    if (spec.type !== "number") return raw;
    if (spec.extra?.includes(raw)) return raw;
    if (name === "line-height") return Math.round((parseFloat(raw) / parseFloat(computed.fontSize)) * 100) / 100 || "";
    if (name === "width")
        return (
            Math.round(
                (element.getBoundingClientRect().width / (element.parentElement?.getBoundingClientRect().width || 1)) *
                    1000,
            ) / 10
        );
    const number =
        parseFloat(raw) * (name === "transition-duration" && raw.endsWith("s") && !raw.endsWith("ms") ? 1000 : 1);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : "";
}

function refreshFieldMarkers() {
    const properties = activeProperties();
    for (const [name, { field, reset }] of fields) {
        field.dataset.edited = String(name in properties);
        reset.disabled = !(name in properties);
    }
}
function refreshFields() {
    const elements = matchingElements(),
        first = elements.find((element) => element.getClientRects().length) || elements[0],
        properties = activeProperties();
    for (const [name, entry] of fields) {
        const value = name in properties ? properties[name] : computedValue(name, first);
        const raw = first ? first.ownerDocument.defaultView.getComputedStyle(first).getPropertyValue(name).trim() : "";
        setControlValue(name, entry, value, raw);
    }
    refreshFieldMarkers();
    asText(ui["selection-label"], labelFor(target));
    const overrides =
        first &&
        Object.entries(properties).some(([name, value]) => {
            if (
                ["description-lines", "grid-template-columns", "width"].includes(name) ||
                (typeof value === "string" && /(?:px|rem|em|%|vw|vh)$/.test(value))
            )
                return false;
            const actual = computedValue(name, first);
            return typeof value === "number"
                ? typeof actual === "number" && Math.abs(value - actual) > 0.1
                : actual !== value;
        });
    asText(
        ui["match-count"],
        elements.length
            ? `${elements.length.toLocaleString("fa")} مورد در این صفحه · مقادیر از اولین مورد خوانده می‌شوند.${overrides ? " برای بعضی مقادیر، تنظیمی اختصاصی‌تر یا اندازه دیگری در پیش‌نمایش فعال است." : ""}`
            : "این بخش در این صفحه وجود ندارد؛ صفحه دیگری را انتخاب کن.",
    );
    ui.parent.disabled = !selectedElement?.parentElement || selectedElement.parentElement === frameDocument?.body;
    ui.similar.hidden = !similarSelector || target.kind !== "element" || target.selector === similarSelector;
    refreshSelectionTree();
    watchFrameLayout(first);
    positionOverlays();
    refreshRangeStatus();
    aboutImageControls.render();
}

function watchFrameLayout(element) {
    if (!frameLayoutObserver || !frameDocument) return;
    frameLayoutObserver.disconnect();
    const nodes = new Set([frameDocument.documentElement, frameDocument.body]);
    let node = element;
    for (let count = 0; node && count < 6; count++, node = node.parentElement) nodes.add(node);
    for (const item of nodes) frameLayoutObserver.observe(item);
}

function refreshSelectionTree() {
    const tree = $("selection-tree"),
        ancestors = $("ancestors"),
        children = $("children");
    const element = selectedElement || matchingElements()[0];
    tree.hidden = !element || element === frameDocument?.body;
    if (tree.hidden) {
        treeElement = null;
        treeNodes = [];
        ancestors.replaceChildren();
        children.replaceChildren();
        return;
    }
    const chain = [];
    let node = element;
    while (node && node !== frameDocument.body && chain.length < 5) {
        chain.unshift(node);
        node = node.parentElement;
    }
    const descendants = [...element.children]
        .filter((item) => !["script", "style"].includes(item.localName))
        .slice(0, 12);
    const nodes = [...chain, ...descendants];
    // A numeric field blurs on pointerdown. Keep existing path buttons alive
    // through that refresh so their subsequent click still reaches the handler.
    if (
        treeElement === element &&
        nodes.length === treeNodes.length &&
        nodes.every((item, index) => item === treeNodes[index])
    )
        return;
    treeElement = element;
    treeNodes = nodes;
    ancestors.replaceChildren();
    children.replaceChildren();
    const add = (container, item, active = false) => {
        const button = document.createElement("button");
        button.className = "mps-selection-node";
        button.type = "button";
        button.textContent = describeElement(item);
        button.title = button.textContent;
        button.dataset.active = String(active);
        button.addEventListener("click", () => selectElement(item));
        container.append(button);
    };
    for (const item of chain) add(ancestors, item, item === element);
    for (const item of descendants) add(children, item);
    if (!children.children.length) asText(children, "این المان بخش داخلی دیگری ندارد.");
}

function changedRules() {
    const before = new Map(saved.rules.map((rule) => [ruleKey(rule), rule])),
        after = new Map(draft.rules.map((rule) => [ruleKey(rule), rule]));
    return [...new Set([...before.keys(), ...after.keys()])]
        .filter((key) => JSON.stringify(before.get(key)) !== JSON.stringify(after.get(key)))
        .map((key) => after.get(key) || before.get(key));
}
function changedPatterns() {
    return ["header", "footer"].filter(
        (key) => JSON.stringify(saved.patterns?.[key]) !== JSON.stringify(draft.patterns?.[key]),
    );
}
function refreshState() {
    const dirty = isDirty();
    asText(
        ui["save-state"],
        dirty
            ? `${(changedRules().length + changedPatterns().length).toLocaleString("fa")} تغییر تأییدنشده`
            : "نسخه ثبت‌شده",
    );
    ui["save-state"].dataset.dirty = String(dirty);
    ui.save.disabled = !ready || !dirty || busy;
    ui["open-preview"].disabled = !ready || busy;
    ui.save.textContent = canSave ? "تأیید و ثبت در قالب" : "تأیید و دریافت فایل‌ها";
    ui.undo.disabled = historyIndex <= 0 || busy;
    ui.redo.disabled = historyIndex >= history.length - 1 || busy;
    ui.compare.setAttribute("aria-pressed", String(comparing));
    asText(ui["rule-count"], `(${draft.rules.length.toLocaleString("fa")})`);
    renderRules();
    refreshRangeStatus();
    aboutImageControls.render();
}
function renderRules() {
    const serialized = JSON.stringify(draft.rules) + $("rule-search").value;
    if (serialized === lastRules) return;
    lastRules = serialized;
    ui.rules.replaceChildren();
    const search = $("rule-search").value.trim().toLowerCase();
    for (const rule of draft.rules) {
        const name = labelFor(rule.target) || targetSelector(rule.target);
        const page = rule.page === "*" ? "همه صفحه‌ها" : PAGE_NAMES[rule.page];
        if (search && !`${name} ${page} ${targetSelector(rule.target)}`.toLowerCase().includes(search)) continue;
        const row = document.createElement("div");
        row.className = "mps-rule-row";
        row.dataset.disabled = String(rule.enabled === false);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mps-rule";
        button.textContent = name;
        const sub = document.createElement("small");
        sub.textContent = `${page} · ${rule.range ? `${rule.range.min}–${rule.range.max ?? "∞"}px` : BREAKPOINTS.find((item) => item.key === rule.breakpoint).label} · ${rule.state || "normal"}`;
        button.append(sub);
        button.addEventListener("click", () => navigateToRule(rule));
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "mps-rule-action";
        toggle.textContent = rule.enabled === false ? "فعال" : "خاموش";
        toggle.title = "فعال / غیرفعال کردن قانون";
        toggle.addEventListener("click", () => {
            const next = clone(draft),
                item = next.rules.find((item) => ruleKey(item) === ruleKey(rule));
            item.enabled = item.enabled === false;
            commit(next);
            refreshFields();
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "mps-rule-action";
        remove.textContent = "حذف";
        remove.title = "حذف این قانون · با برگشت قابل بازیابی است";
        remove.addEventListener("click", () => {
            commit({ ...draft, rules: draft.rules.filter((item) => ruleKey(item) !== ruleKey(rule)) });
            refreshFields();
        });
        row.append(button, toggle, remove);
        ui.rules.append(row);
    }
}

function applyDraft() {
    if (!frameDocument || !draftStyle) return;
    for (const element of frameDocument.querySelectorAll(".mps-preview-state"))
        element.classList.remove("mps-preview-state");
    if (forceState && currentState !== "normal" && !comparing)
        for (const element of matchingElements()) element.classList.add("mps-preview-state");
    draftStyle.textContent = compileCSS(draft, { previewState: forceState ? currentState : undefined });
    draftStyle.disabled = comparing;
    if (savedLink) savedLink.disabled = !comparing;
    ui.compare.setAttribute("aria-pressed", String(comparing));
    previewPatterns();
    frameDocument.defaultView.dispatchEvent(new frameDocument.defaultView.Event("site:styles-preview"));
    frameDocument.defaultView.dispatchEvent(
        new frameDocument.defaultView.CustomEvent("site:image-preview", {
            detail: imageSourceRules((comparing ? saved : draft).rules),
        }),
    );
    requestAnimationFrame(positionOverlays);
    tokenReference.refresh();
}
function previewPatterns(paused = patternEditor?.paused || false) {
    if (!frameDocument?.body.dataset.siteReady) return;
    const patterns = (comparing ? saved : draft).patterns;
    if (patterns)
        frameDocument.defaultView.dispatchEvent(
            new frameDocument.defaultView.CustomEvent("site:pattern-preview", {
                detail: { ...clone(patterns), paused },
            }),
        );
}

function selectElement(element, scroll = false) {
    if (
        !frameDocument ||
        !element ||
        element.ownerDocument !== frameDocument ||
        !element.isConnected ||
        element === frameDocument.body ||
        element === frameDocument.documentElement
    )
        return;
    selectedElement = element;
    const label = describeElement(element);
    target = { kind: "element", selector: elementSelector(element), label };
    exactTarget = clone(target);
    componentSelector = repeatedSelector(element);
    box(hoverOverlay, null);
    setEditorMode("style");
    const similarClass = semanticClasses(element)[0];
    similarSelector =
        similarClass && frameDocument.querySelectorAll(`.${similarClass}`).length > 1 ? `.${similarClass}` : "";
    scope = "page";
    $("property-search").value = "";
    refreshTargets();
    applyDraft();
    refreshFields();
    if (scroll) element.scrollIntoView({ block: "center", behavior: "instant" });
    const textElement = element.matches("h1,h2,h3,h4,p,span,bdi,strong,blockquote,a,li,i,button,label,td,th");
    const control = fields.get(textElement ? "font-size" : element.localName === "img" ? "height" : "min-height");
    control.field.closest("details").open = true;
    control.field.scrollIntoView({ block: "nearest", behavior: "instant" });
    control.input.focus({ preventScroll: true });
    control.input.select();
    message("این المان انتخاب شد. تنظیماتش فقط روی همین صفحه اعمال می‌شود.");
}
function box(overlayElement, element, color) {
    if (!overlayElement) return;
    if (!element || !pickEnabled || comparing || !element.isConnected) {
        overlayElement.hidden = true;
        return;
    }
    const rect = element.getBoundingClientRect();
    overlayElement.hidden = !rect.width || !rect.height;
    Object.assign(overlayElement.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderColor: color,
    });
    const label = overlayElement.querySelector(".mps-picker-label");
    if (label) {
        label.textContent = describeElement(element);
        label.style.top = rect.top < 26 ? "0" : "-24px";
        label.style.background = color;
    }
}
function positionOverlays() {
    const elements = editorMode === "style" ? matchingElements().slice(0, 80) : [];
    box(overlay, elements[0], "#f47d3e");
    if (!frameDocument) return;
    for (let i = 1; i < elements.length; i++)
        if (!extraOverlays[i - 1]) {
            const item = overlay.cloneNode(true);
            item.querySelector(".mps-picker-label").remove();
            frameDocument.body.append(item);
            extraOverlays[i - 1] = item;
        }
    extraOverlays.forEach((item, index) => box(item, elements[index + 1], "#ed9b6880"));
}
function resizePreview() {
    const width = ui.stage.clientWidth - (window.innerWidth <= 760 ? 24 : 48);
    const geometry = previewGeometry({
        width: currentWidth,
        availableWidth: width,
        availableHeight: ui.stage.clientHeight - 28,
        zoom: previewZoom,
        frozenScale: viewportResizer.scale,
    });
    scale = geometry.scale;
    ui.preview.style.width = `${geometry.width}px`;
    ui.preview.style.height = `${geometry.height}px`;
    ui.preview.style.transform = `scale(${scale})`;
    ui["frame-shell"].style.width = `${geometry.shellWidth}px`;
    ui["frame-shell"].style.height = `${geometry.shellHeight}px`;
    $("zoom").value = Math.round(scale * 100);
    $("zoom-fit").setAttribute("aria-pressed", String(previewZoom === "fit"));
    $("zoom-out").disabled = scale * 100 <= ZOOM_LIMITS.min;
    $("zoom-in").disabled = scale * 100 >= ZOOM_LIMITS.max;
    asText(
        ui.scale,
        `نمایش ${Math.round(scale * 100).toLocaleString("fa")}٪ · عرض واقعی ${currentWidth.toLocaleString("fa")}px`,
    );
    asText(ui["preview-caption"], `${PAGE_NAMES[currentPage]} · ${currentWidth.toLocaleString("fa")} پیکسل`);
    tokenReference.refresh();
}
function setZoom(value) {
    previewZoom = normalizeZoom(value);
    resizePreview();
    remember(true);
}
$("zoom").addEventListener("change", () => setZoom($("zoom").value || "fit"));
$("zoom-out").addEventListener("click", () => setZoom(Math.round(scale * 100) - ZOOM_LIMITS.step));
$("zoom-in").addEventListener("click", () => setZoom(Math.round(scale * 100) + ZOOM_LIMITS.step));
$("zoom-fit").addEventListener("click", () => setZoom("fit"));
function setWidth(width, breakpoint) {
    currentWidth = Math.min(7680, Math.max(240, Math.round(width)));
    ui.width.value = currentWidth;
    viewportResizer.update(currentWidth);
    const size =
        breakpoint ||
        (currentWidth >= 1180
            ? "desktop"
            : currentWidth >= 640
              ? "tablet"
              : currentBreakpoint === "compact" && currentWidth <= 450
                ? "compact"
                : "mobile");
    if (!["all", "range"].includes(currentBreakpoint)) currentBreakpoint = size;
    ui.breakpoint.value = currentBreakpoint;
    for (const button of document.querySelectorAll("[data-device]"))
        button.setAttribute("aria-pressed", String(button.dataset.device === size));
    resizePreview();
    remember(true);
    refreshRangeStatus();
    // ResizeObserver-driven page layouts and fonts need one frame to settle.
    requestAnimationFrame(() =>
        requestAnimationFrame(() => {
            if (viewportResizer.dragging) return;
            refreshFields();
            positionOverlays();
        }),
    );
}
function navigateToPage(page, keepTarget = false) {
    if (!PAGE_NAMES[page]) return;
    currentPage = page;
    ui.page.value = page;
    frameDocument = null;
    selectedElement = null;
    similarSelector = "";
    exactTarget = null;
    componentSelector = "";
    if (
        (!keepTarget && scope !== "global") ||
        (target.kind === "role" &&
            TARGETS.find((item) => item.key === target.key)?.pages?.every((name) => name !== page))
    )
        target = { kind: "role", key: "hero-title" };
    refreshTargets();
    refreshFields();
    ui.loading.hidden = false;
    ui.preview.src = `${base}${pages.find((item) => item.name === page).file}`;
    resizePreview();
    remember();
}
function navigateToRule(rule) {
    if (rule.target.kind === "token") {
        if (rule.page !== "*" && rule.page !== currentPage) navigateToPage(rule.page);
        setEditorMode("tokens");
        tokenReference.editRule(rule);
        return;
    }
    target = clone(rule.target);
    scope = rule.page === "*" ? "global" : "page";
    currentBreakpoint = rule.breakpoint;
    currentState = rule.state || "normal";
    if (rule.range) {
        customRange = clone(rule.range);
        setWidth(Math.max(240, Math.min(rule.range.max ?? 7680, Math.max(rule.range.min, currentWidth))), "range");
    }
    const widths = { desktop: 1440, tablet: 820, mobile: 390, compact: 320 };
    if (widths[rule.breakpoint]) setWidth(widths[rule.breakpoint], rule.breakpoint);
    if (rule.page !== "*" && rule.page !== currentPage) navigateToPage(rule.page, true);
    else {
        refreshTargets();
        refreshFields();
        locate();
    }
}
function locate() {
    matchingElements()[0]?.scrollIntoView({ block: "center", behavior: "instant" });
    positionOverlays();
}

ui.preview.addEventListener("load", async () => {
    try {
        const document = ui.preview.contentDocument;
        if (!PAGE_NAMES[document?.body?.dataset.page]) return;
        frameLayoutObserver?.disconnect();
        frameDocument = document;
        extraOverlays = [];
        if (currentPage !== document.body.dataset.page) {
            currentPage = document.body.dataset.page;
            ui.page.value = currentPage;
            target = { kind: "role", key: "hero-title" };
            selectedElement = null;
            similarSelector = "";
        }
        savedLink = document.getElementById("mps-template-overrides");
        draftStyle = document.createElement("style");
        draftStyle.id = "mps-customizer-draft";
        document.head.append(draftStyle);
        const selectionStyle = document.createElement("style");
        selectionStyle.textContent =
            ".mps-picker-box{position:fixed;z-index:2147483647;pointer-events:none;border:2px solid;box-sizing:border-box;border-radius:3px;background:transparent;transition:none!important;}.mps-picker-label{position:absolute;right:-2px;max-width:260px;padding:2px 6px;border-radius:3px;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:12px/1.6 Peyda,Tahoma,sans-serif;}";
        document.head.append(selectionStyle);
        overlay = document.createElement("div");
        hoverOverlay = document.createElement("div");
        overlay.dataset.pickerKind = "selection";
        hoverOverlay.dataset.pickerKind = "hover";
        for (const element of [overlay, hoverOverlay]) {
            element.className = "mps-picker-box";
            element.setAttribute("aria-hidden", "true");
            element.hidden = true;
            document.body.append(element);
        }
        for (const element of [overlay, hoverOverlay]) {
            const label = document.createElement("span");
            label.className = "mps-picker-label";
            element.append(label);
        }
        hoverOverlay.style.borderStyle = "dashed";
        hoverOverlay.style.borderWidth = "1px";
        document.addEventListener(
            "click",
            (event) => {
                if (!pickEnabled || comparing) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                // Keep the literal clicked element: bdi/span/icon inside a title or
                // button can be styled independently. The path buttons select parents.
                let element = event.target;
                if (element.closest("svg")) element = element.closest("svg");
                selectElement(element);
            },
            true,
        );
        document.addEventListener(
            "pointerdown",
            (event) => {
                if (pickEnabled && !comparing) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            },
            true,
        );
        document.addEventListener(
            "pointermove",
            (event) => {
                if (pickEnabled) box(hoverOverlay, event.target.closest("svg") || event.target, "#27a1c1");
            },
            { passive: true },
        );
        document.addEventListener("pointerleave", () => {
            hoverOverlay.hidden = true;
        });
        document.addEventListener("scroll", positionOverlays, { passive: true, capture: true });
        document.addEventListener("keydown", keyboard);
        document.addEventListener("submit", (event) => event.preventDefault(), true);
        applyDraft();
        refreshTargets();
        resizePreview();
        // Vite may finish its injected page styles after the iframe load event.
        // Wait for real page initialization before reading sizes or hiding loading.
        if (document.body.dataset.siteReady !== "true")
            await new Promise((resolve, reject) => {
                const finish = () => {
                    clearTimeout(timer);
                    resolve();
                };
                const timer = setTimeout(() => {
                    document.removeEventListener("site:ready", finish);
                    reject(new Error("page not ready"));
                }, 15000);
                document.addEventListener("site:ready", finish, { once: true });
            });
        await document.fonts.ready;
        await new Promise((resolve) =>
            document.defaultView.requestAnimationFrame(() => document.defaultView.requestAnimationFrame(resolve)),
        );
        if (frameDocument !== document) return;
        frameLayoutObserver = new document.defaultView.ResizeObserver(positionOverlays);
        previewPatterns();
        patternEditor.render();
        refreshFields();
        ui.loading.hidden = true;
    } catch {
        ui.loading.hidden = true;
        message("پیش‌نمایش باید از همان سرور پروژه باز شود.", true);
    }
});

ui.page.addEventListener("change", () => navigateToPage(ui.page.value));
ui.preview.addEventListener("pointerleave", () => box(hoverOverlay, null));
ui.target.addEventListener("change", () => {
    if (ui.target.value === "__picked") return;
    selectRole(ui.target.value);
});
function selectRole(key, nextScope) {
    $("target-search").value = "";
    target = { kind: "role", key };
    scope =
        nextScope ||
        (TARGETS.find((item) => item.key === key)?.group === "کامپوننت‌های مشترک" || key === "theme"
            ? "global"
            : "page");
    selectedElement = null;
    similarSelector = "";
    exactTarget = null;
    componentSelector = "";
    refreshTargets();
    applyDraft();
    refreshFields();
    locate();
}
for (const [id, key] of [
    ["edit-page-header", "header"],
    ["edit-page-hero", "hero"],
    ["edit-fixed-header", "header-behavior"],
    ["edit-about-image", "about-image"],
    ["edit-about-frame", "about-image-frame"],
    ["edit-about-container", "about-image-container"],
])
    $(id).addEventListener("click", () => {
        currentState = "normal";
        forceState = false;
        $("property-search").value = "";
        selectRole(key, "page");
        fields.get("min-height").panel.open = true;
        if (key === "about-image") fields.get("image-source").panel.open = true;
        if (key === "header-behavior") fields.get("--header-fixed-enabled").panel.open = true;
    });
$("test-fixed-header").addEventListener("click", () => {
    const measure = frameDocument?.querySelector(".site-header__settings-measure");
    if (!measure) return;
    const threshold = parseFloat(frameDocument.defaultView.getComputedStyle(measure).width) || 0;
    frameDocument.defaultView.scrollTo({ top: threshold + 1, behavior: "instant" });
});
$("reset-header-scroll").addEventListener("click", () =>
    frameDocument?.defaultView.scrollTo({ top: 0, behavior: "instant" }),
);
ui.scope.addEventListener("change", () => {
    scope = ui.scope.value;
    refreshTargets();
    refreshFields();
});
ui.breakpoint.addEventListener("change", () => {
    currentBreakpoint = ui.breakpoint.value;
    const widths = { desktop: 1440, tablet: 820, mobile: 390, compact: 320 };
    if (widths[currentBreakpoint]) setWidth(widths[currentBreakpoint], currentBreakpoint);
    else if (currentBreakpoint === "range")
        setWidth(Math.min(customRange.max ?? 7680, Math.max(customRange.min, currentWidth)), "range");
    else refreshFields();
    refreshTargets();
});
ui.width.addEventListener("change", () => {
    const number = Number(ui.width.value);
    if (Number.isFinite(number)) setWidth(number);
});
for (const button of document.querySelectorAll("[data-width]"))
    button.addEventListener("click", () => {
        currentBreakpoint = button.dataset.device;
        setWidth(Number(button.dataset.width), button.dataset.device);
    });
ui.pick.addEventListener("click", () => {
    pickEnabled = !pickEnabled;
    ui.pick.setAttribute("aria-pressed", String(pickEnabled));
    ui.pick.textContent = `انتخاب با کلیک: ${pickEnabled ? "روشن" : "خاموش"}`;
    box(hoverOverlay, null);
    positionOverlays();
});
ui.compare.addEventListener("click", () => {
    comparing = !comparing;
    applyDraft();
    refreshFields();
    message(
        comparing ? "نسخه ثبت‌شده نمایش داده می‌شود. دوباره بزن تا به پیش‌نویس برگردی." : "پیش‌نویس نمایش داده می‌شود.",
    );
});
ui.parent.addEventListener("click", () => selectElement(selectedElement?.parentElement, true));
ui.similar.addEventListener("click", () => {
    target = {
        kind: "component",
        selector: componentSelector || similarSelector,
        label: `موارد مشابه · ${target.label}`,
    };
    refreshTargets();
    refreshFields();
    message("تنظیمات روی موارد مشابه در محدوده انتخاب‌شده اعمال می‌شود.");
});
$("repeat-mode").addEventListener("change", () => {
    target =
        $("repeat-mode").value === "component"
            ? { kind: "component", selector: componentSelector, label: `باکس‌های تکراری · ${exactTarget.label}` }
            : clone(exactTarget);
    refreshTargets();
    refreshFields();
});
for (const id of ["range-min", "range-max"])
    $(id).addEventListener("change", () => {
        const min = Number($("range-min").value || 0),
            max = $("range-max").value.trim() ? Number($("range-max").value) : null;
        if (
            !Number.isInteger(min) ||
            min < 0 ||
            min > 7680 ||
            (max !== null && (!Number.isInteger(max) || max < min || max > 7680))
        ) {
            message("بازهٔ عرض معتبر نیست.", true);
            refreshTargets();
            return;
        }
        customRange = { min, max };
        setWidth(Math.min(max ?? 7680, Math.max(min, currentWidth)), "range");
        refreshTargets();
        refreshFields();
    });
for (const button of document.querySelectorAll("[data-range-width]"))
    button.addEventListener("click", () => {
        const width =
            button.dataset.rangeWidth === "min"
                ? customRange.min
                : button.dataset.rangeWidth === "max"
                  ? (customRange.max ?? 1920)
                  : customRange.max !== null
                    ? customRange.max + 1
                    : customRange.min - 1;
        setWidth(width, "range");
    });
$("element-state").addEventListener("change", () => {
    currentState = $("element-state").value;
    refreshTargets();
    applyDraft();
    refreshFields();
});
$("state-preview").addEventListener("change", () => {
    forceState = $("state-preview").checked;
    applyDraft();
    refreshFields();
    refreshRangeStatus();
});
$("property-search").addEventListener("input", () =>
    filterStyleControls(
        fields,
        $("property-search").value,
        target.kind === "role" && target.key === "theme",
        target.kind === "role" && currentState === "normal" ? target.key : "",
    ),
);
$("rule-search").addEventListener("input", renderRules);
$("target-search").addEventListener("input", refreshTargets);
$("copy-properties").addEventListener("click", () => {
    const properties = activeProperties();
    if (!Object.keys(properties).length) {
        message("این محدوده تنظیم اختصاصی برای کپی ندارد.");
        return;
    }
    copiedProperties = clone(properties);
    $("paste-properties").disabled = false;
    message("تنظیمات این قانون کپی شد؛ بخش یا بازهٔ مقصد را انتخاب کن.");
});
$("paste-properties").addEventListener("click", () => {
    if (!copiedProperties) return;
    const next = clone(draft),
        rule = activeRule(),
        item = next.rules.find((item) => ruleKey(item) === ruleKey(rule));
    if (item) Object.assign(item.properties, copiedProperties);
    else next.rules.push({ ...rule, properties: clone(copiedProperties) });
    commit(next);
    refreshFields();
    message("تنظیمات در محدودهٔ انتخاب‌شده چسبانده شد.");
});
ui.locate.addEventListener("click", locate);
$("reset-target").addEventListener("click", () => {
    const key = ruleKey(activeRule());
    commit({ ...draft, rules: draft.rules.filter((rule) => ruleKey(rule) !== key) });
    refreshFields();
    message("تنظیمات این محدوده حذف شد؛ تغییر هنوز ثبت نشده است.");
});
$("discard").addEventListener("click", () => {
    commit(clone(saved));
    refreshFields();
    message("پیش‌نویس به آخرین نسخه ثبت‌شده برگشت.");
});
$("defaults").addEventListener("click", () => {
    commit({ ...defaultConfig(), patterns: clone(draft.patterns) });
    refreshFields();
    message("اندازه‌های پیشنهادی باکس‌ها و راست‌چین اعمال شد. قبل از ثبت می‌توانی ویرایش کنی یا برگشت بزنی.");
});
function moveHistory(offset) {
    if (busy || !history[historyIndex + offset]) return;
    historyIndex += offset;
    draft = clone(history[historyIndex]);
    lastChange = { key: "", at: 0 };
    comparing = false;
    applyDraft();
    refreshFields();
    refreshState();
    patternEditor.render();
    remember();
}
ui.undo.addEventListener("click", () => moveHistory(-1));
ui.redo.addEventListener("click", () => moveHistory(1));
function keyboard(event) {
    if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        !event.target.closest("input, textarea, select")
    ) {
        event.preventDefault();
        moveHistory(event.shiftKey ? 1 : -1);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (isDirty()) showConfirmation();
    }
}
document.addEventListener("keydown", keyboard);
new ResizeObserver(resizePreview).observe(ui.stage);

$("import").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        if (file.size > 2097152) throw new Error("فایل بیش از حد بزرگ است.");
        const imported = JSON.parse(await file.text());
        imported.patterns ||= clone(draft.patterns);
        commit(normalizeConfig(imported));
        refreshFields();
        patternEditor.render();
        message("تنظیمات وارد شد؛ پیش‌نمایش را بررسی و سپس ثبت کن.");
    } catch (error) {
        message(error.message, true);
    }
    event.target.value = "";
});
$("export").addEventListener("click", () => {
    downloadSettings(draft);
    message("بستهٔ استایل و پترن دریافت شد؛ پوشه src آن را در پروژه Merge و Replace کن، سپس محلی اجرا یا منتشر کن.");
});
ui["open-preview"].addEventListener("click", () => {
    try {
        previewId = savePreviewSnapshot(draft, base, previewId);
        const url = previewURL(
            pages.find((page) => page.name === currentPage),
            previewId,
            base,
        );
        window.open(url.href, "_blank", "noopener");
        message(
            "پیش‌نمایش تغییرات در تب جدید باز شد؛ با لینک‌های سایت می‌توانی صفحه‌ها را بررسی کنی. ثبت نهایی از همین کاستومایزر انجام می‌شود.",
        );
    } catch {
        message("برای باز کردن پیش‌نمایش، ذخیره‌سازی مرورگر باید در دسترس باشد.", true);
    }
});

function showConfirmation() {
    if (busy || !isDirty()) return;
    const changes = changedRules();
    asText(
        ui["confirm-summary"],
        `${(changes.length + changedPatterns().length).toLocaleString("fa")} تنظیم تغییر کرده. تغییرات بر اساس اندازه و محدوده‌ای که انتخاب کردی اعمال می‌شوند.`,
    );
    ui["confirm-pages"].replaceChildren();
    for (const page of new Set(changes.map((rule) => rule.page))) {
        const item = document.createElement("li");
        item.textContent = page === "*" ? "تنظیمات مشترک همه صفحه‌ها" : PAGE_NAMES[page];
        ui["confirm-pages"].append(item);
    }
    for (const kind of changedPatterns()) {
        const item = document.createElement("li");
        item.textContent = `پترن مشترک ${kind === "header" ? "هدر" : "فوتر"} · همهٔ صفحه‌ها`;
        ui["confirm-pages"].append(item);
    }
    asText(
        ui["confirm-mode"],
        canSave
            ? "با تأیید، تنظیمات در فایل‌های قالب ثبت می‌شوند؛ با باز کردن دوباره صفحه هم باقی می‌مانند. برای سایت آنلاین، نسخه جدید را منتشر کن."
            : "در نسخه آنلاین، فایل‌های پروژه قابل نوشتن نیستند. تأیید یک ZIP شامل CSS و JSON می‌دهد؛ آن‌ها را در پروژه جایگزین کن و نسخه جدید را منتشر کن.",
    );
    ui["confirm-save"].textContent = canSave ? "تأیید و ثبت" : "تأیید و دریافت ZIP";
    ui["save-error"].hidden = true;
    if (!ui.confirm.open) ui.confirm.showModal();
}
ui.save.addEventListener("click", showConfirmation);
$("cancel-save").addEventListener("click", () => {
    if (!busy) ui.confirm.close();
});
ui.confirm.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
});
ui["confirm-save"].addEventListener("click", async () => {
    if (busy) return;
    if (!canSave) {
        downloadSettings(draft);
        ui.confirm.close();
        message("بسته تأییدشده دریافت شد. برای ثبت روی قالب، فایل‌های src بسته را در پروژه جایگزین و منتشر کن.");
        return;
    }
    busy = true;
    ui.controls.disabled = true;
    $("pattern-editor").inert = true;
    ui["confirm-save"].disabled = true;
    refreshState();
    try {
        const response = await fetch(`${base}__customizer/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Marpich-Customizer": token },
            body: JSON.stringify({ revision, config: draft }),
            signal: AbortSignal.timeout(10000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "ثبت انجام نشد.");
        saved = normalizeConfig(result.config);
        draft = clone(saved);
        revision = result.revision;
        ui.confirm.close();
        remember();
        message(
            "ثبت شد. استایل‌ها در فایل‌های قالب ذخیره شدند و روی همه صفحه‌ها اعمال می‌شوند. برای سایت آنلاین، بیلد و انتشار را انجام بده.",
        );
    } catch (error) {
        ui["save-error"].hidden = false;
        asText(ui["save-error"], error.message || "ثبت انجام نشد؛ پیش‌نویس باقی مانده است.");
    } finally {
        busy = false;
        ui.controls.disabled = false;
        $("pattern-editor").inert = false;
        ui["confirm-save"].disabled = false;
        refreshState();
        refreshFields();
        applyDraft();
    }
});

async function initialize() {
    try {
        const response = await fetch(`${base}__customizer/settings`, {
            signal: AbortSignal.timeout(3000),
            cache: "no-store",
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
            throw new Error("static");
        const result = await response.json();
        saved = normalizeConfig(result.config);
        revision = result.revision;
        token = result.token;
        canSave = result.canSave === true;
    } catch {
        try {
            const response = await fetch(`${base}assets/customizer/settings.json`, { cache: "no-store" });
            if (!response.ok) throw new Error();
            saved = normalizeConfig(await response.json());
        } catch {
            message("تنظیمات قالب خوانده نشد. با npm run dev از داخل پروژه باز کن.", true);
        }
    }
    draft = clone(saved);
    try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached?.baseline === JSON.stringify(saved)) {
            draft = normalizeConfig(cached.config);
            message("پیش‌نویس قبلی بازیابی شد؛ هنوز روی فایل‌های قالب ثبت نشده است.");
        }
        const view = JSON.parse(localStorage.getItem(preferencesKey) || "null");
        if (PAGE_NAMES[view?.page]) currentPage = view.page;
        if (Number.isFinite(view?.width)) currentWidth = view.width;
        previewZoom = normalizeZoom(view?.zoom);
    } catch {
        /* Ignore incompatible/stale local drafts. */
    }
    history = [clone(saved)];
    historyIndex = 0;
    if (isDirty()) {
        history.push(clone(draft));
        historyIndex = 1;
    }
    ready = true;
    const requestedPage = new URLSearchParams(location.search).get("page");
    if (PAGE_NAMES[requestedPage]) currentPage = requestedPage;
    ui.connection.dataset.mode = canSave ? "local" : "static";
    asText(
        ui.connection,
        canSave ? "نسخه محلی · ذخیره مستقیم روی قالب فعال است" : "نسخه آنلاین · ثبت با دریافت فایل و جایگزینی در پروژه",
    );
    refreshState();
    patternEditor.render();
    setWidth(currentWidth);
    navigateToPage(currentPage);
    const requestedToken = new URLSearchParams(location.search).get("token");
    if (requestedToken) showToken(requestedToken);
}
function setEditorMode(mode) {
    editorMode = mode;
    $("style-editor").hidden = mode !== "style";
    $("pattern-editor").hidden = mode !== "pattern";
    $("tokens-editor").hidden = mode !== "tokens";
    $("style-tab").setAttribute("aria-pressed", String(mode === "style"));
    $("pattern-tab").setAttribute("aria-pressed", String(mode === "pattern"));
    $("tokens-tab").setAttribute("aria-pressed", String(mode === "tokens"));
    if (mode === "tokens") tokenReference.refresh();
    positionOverlays();
}
const patternEditor = createPatternEditor({
    container: $("pattern-editor"),
    getConfig: () => draft,
    commit,
    preview: previewPatterns,
    setWidth,
    getWidth: () => currentWidth,
    message,
    locate: (kind) => {
        const root = frameDocument?.querySelector(`[data-site-pattern="${kind}"]`);
        if (root) root.parentElement.scrollIntoView({ block: "start", behavior: "instant" });
        else message("این صفحه پترن هدر ندارد؛ یکی از صفحه‌های داخلی را انتخاب کن.");
    },
});
const tokenReference = createTokenReference({
    container: $("tokens-reference"),
    getContext: () => ({
        page: currentPage,
        width: currentWidth,
        document: frameDocument,
        rules: draft.rules,
        comparing,
        busy,
        ready,
    }),
    onEdit(name, value, context) {
        if (busy || !ready) throw new Error("پیش‌نمایش هنوز آماده نیست.");
        const next = clone(draft),
            rule = tokenRule(name, context),
            key = ruleKey(rule);
        const index = next.rules.findIndex((item) => ruleKey(item) === key);
        if (value === undefined) {
            if (index !== -1) next.rules.splice(index, 1);
        } else {
            rule.properties[name] = value;
            if (index === -1) next.rules.push(rule);
            else next.rules[index] = rule;
        }
        // These are explicit Apply/Reset actions, rather than continuous typing;
        // keep each action as its own undo step even when clicked rapidly.
        commit(next);
        message(
            value === undefined
                ? "تغییر متغیر در این محدوده حذف شد."
                : "متغیر در پیش‌نویس تنظیم شد؛ برای ذخیرهٔ دائمی از دکمهٔ ثبت استفاده کن.",
        );
    },
});
function showToken(name) {
    setEditorMode("tokens");
    tokenReference.show(name);
}
$("tokens-tab").addEventListener("click", () => setEditorMode("tokens"));
$("style-tab").addEventListener("click", () => setEditorMode("style"));
$("pattern-tab").addEventListener("click", () => {
    setEditorMode("pattern");
    patternEditor.open();
});
initialize();
