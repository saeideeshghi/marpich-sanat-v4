/* Editable catalog combobox. The native select remains the only named field,
 * so search text never changes FormData until an option is explicitly chosen. */
import { normalizeSearchText } from "../utils/search-text.js";

let sequence = 0;

export function enhanceSearchableSelect(select, index, closeOthers) {
    if (select.dataset.customized === "true") return;
    select.dataset.customized = "true";
    select.classList.add("product-search__select--native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const id = `catalog-filter-${++sequence}`;
    const accessibleName = select.getAttribute("aria-label") || select.name || "فیلتر";
    const dropdown = document.createElement("div");
    dropdown.className = `product-search__dropdown product-search__dropdown--${index + 1} product-search__dropdown--searchable`;
    dropdown.dataset.catalogDropdown = "";

    const control = document.createElement("div");
    control.className = "product-search__dropdown-toggle";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "product-search__dropdown-input";
    input.dataset.catalogDropdownToggle = "";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-label", `${accessibleName}؛ تایپ برای جستجو`);
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-controls", id);
    input.setAttribute("aria-expanded", "false");
    input.placeholder = select.options[0]?.textContent.trim() || "انتخاب کنید";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "product-search__dropdown-arrow";
    toggle.tabIndex = -1;
    toggle.setAttribute("aria-label", `نمایش گزینه‌های ${accessibleName}`);
    toggle.innerHTML = '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
    control.append(input, toggle);

    const panel = document.createElement("div");
    panel.className = "product-search__dropdown-panel";
    const list = document.createElement("ul");
    list.id = id;
    list.className = "product-search__dropdown-list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", accessibleName);
    const empty = document.createElement("p");
    empty.className = "product-search__dropdown-empty";
    empty.textContent = "گزینه‌ای پیدا نشد";
    empty.setAttribute("role", "status");
    empty.hidden = true;
    panel.append(list, empty);
    dropdown.append(control, panel);
    select.insertAdjacentElement("afterend", dropdown);

    let active = null;
    const entries = [...select.options].map((option, optionIndex) => {
        const item = document.createElement("li");
        item.id = `${id}-option-${optionIndex}`;
        item.className = "product-search__dropdown-option";
        item.dataset.value = option.value;
        item.setAttribute("role", "option");
        item.setAttribute("aria-disabled", String(option.disabled));
        item.textContent = option.textContent.trim();
        item.addEventListener("mousedown", (event) => event.preventDefault());
        item.addEventListener("click", () => choose(item));
        list.append(item);
        return { option, item, key: normalizeSearchText(item.textContent) };
    });
    const available = () =>
        entries.filter(({ option, item }) => !item.hidden && !option.disabled).map(({ item }) => item);

    function setActive(item, scroll = false) {
        active?.classList.remove("is-active");
        active = item || null;
        active?.classList.add("is-active");
        if (active) {
            input.setAttribute("aria-activedescendant", active.id);
            if (scroll) active.scrollIntoView({ block: "nearest" });
        } else input.removeAttribute("aria-activedescendant");
    }
    function filter(query) {
        const key = normalizeSearchText(query);
        entries.forEach(({ item, key: optionKey }) => {
            item.hidden = !optionKey.includes(key);
        });
        empty.hidden = entries.some(({ item }) => !item.hidden);
        setActive(null);
    }
    function sync() {
        const selected = select.selectedOptions[0];
        input.value = select.value ? selected?.textContent.trim() || "" : "";
        input.disabled = select.disabled;
        toggle.disabled = select.disabled;
        entries.forEach(({ option, item }) => {
            const selected = option.index === select.selectedIndex;
            item.classList.toggle("is-selected", selected);
            item.setAttribute("aria-selected", String(selected));
        });
    }
    function close() {
        dropdown.classList.remove("is-open");
        input.setAttribute("aria-expanded", "false");
        setActive(null);
        sync();
    }
    function open() {
        if (input.disabled || dropdown.classList.contains("is-open")) return;
        closeOthers(dropdown);
        filter("");
        dropdown.classList.add("is-open");
        input.setAttribute("aria-expanded", "true");
    }
    function choose(item) {
        const entry = entries.find((entry) => entry.item === item);
        if (!entry || entry.option.disabled) return;
        select.selectedIndex = entry.option.index;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        close();
        input.focus({ preventScroll: true });
    }

    dropdown.addEventListener("catalog:dropdown-close", close);
    dropdown.addEventListener("focusout", (event) => {
        if (!dropdown.contains(event.relatedTarget)) close();
    });
    input.addEventListener("focus", () => {
        open();
        input.select();
    });
    input.addEventListener("click", open);
    input.addEventListener("input", () => {
        open();
        filter(input.value);
    });
    input.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        const wasOpen = dropdown.classList.contains("is-open");
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            open();
            const items = available();
            const current = items.indexOf(active);
            const next =
                event.key === "ArrowDown"
                    ? Math.min(current + 1, items.length - 1)
                    : current < 0
                      ? items.length - 1
                      : Math.max(0, current - 1);
            setActive(items[next], true);
        } else if (wasOpen && (event.key === "Home" || event.key === "End")) {
            event.preventDefault();
            const items = available();
            setActive(event.key === "Home" ? items[0] : items.at(-1), true);
        } else if (wasOpen && event.key === "Enter") {
            event.preventDefault();
            const item = active || available()[0];
            if (item) choose(item);
        } else if (event.key === "Escape") {
            event.preventDefault();
            close();
        } else if (event.key === "Tab") close();
    });
    toggle.addEventListener("mousedown", (event) => event.preventDefault());
    toggle.addEventListener("click", () => {
        if (dropdown.classList.contains("is-open")) close();
        else {
            input.focus({ preventScroll: true });
            open();
        }
    });
    select.addEventListener("change", sync);
    select.form?.addEventListener("reset", () => queueMicrotask(close));
    sync();
}
