/* Catalog UI only: grid/list, filter chips and cancelable integration events.
 * catalog:search detail is a flat map of named form fields; its listener must
 * call preventDefault() synchronously to suppress the disconnected fallback.
 * Changing a select/chip does not request results. Pagination is not implemented.
 */
import { enhanceSearchableSelect } from "./searchable-select.js";

function closeCatalogDropdowns(except = null) {
    document.querySelectorAll("[data-catalog-dropdown].is-open").forEach((dropdown) => {
        if (dropdown === except) return;
        dropdown.dispatchEvent(new Event("catalog:dropdown-close"));
        dropdown.classList.remove("is-open");
        dropdown.querySelector("[data-catalog-dropdown-toggle]")?.setAttribute("aria-expanded", "false");
    });
}

let catalogDropdownGlobalEventsBound = false;
function bindCatalogDropdownGlobalEvents() {
    if (catalogDropdownGlobalEventsBound) return;
    catalogDropdownGlobalEventsBound = true;
    document.addEventListener("click", (event) => {
        if (!event.target.closest("[data-catalog-dropdown]")) closeCatalogDropdowns();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeCatalogDropdowns();
    });
}

export function initCatalogs(scope = document) {
    bindCatalogDropdownGlobalEvents();
    scope
        .querySelectorAll(
            "[data-products-page], [data-air-handling-page], [data-industries-page], [data-page='projects']",
        )
        .forEach((page) => {
            if (page.dataset.catalogInitialized) return;
            page.dataset.catalogInitialized = "true";
            const grid = page.querySelector("[data-product-grid], [data-industry-grid], [data-projects-grid]");
            const buttons = [...page.querySelectorAll("[data-view], [data-project-view]")];
            buttons.forEach((button) =>
                button.addEventListener("click", () => {
                    const view = button.dataset.view || button.dataset.projectView;
                    if (!grid || !["list", "grid"].includes(view)) return;
                    grid.classList.toggle("is-list", view === "list");
                    // The products page uses its established class for list layout.
                    if (page.matches("[data-products-page]")) {
                        grid.classList.toggle("products-grid--list", view === "list");
                    }
                    buttons.forEach((other) => {
                        const active = (other.dataset.view || other.dataset.projectView) === view;
                        other.classList.toggle("is-active", active);
                        other.setAttribute("aria-pressed", String(active));
                    });
                }),
            );
            page.querySelectorAll("[data-product-search]").forEach((form) => {
                [...form.querySelectorAll("select.product-search__select")].forEach((select, index) =>
                    enhanceSearchableSelect(select, index, closeCatalogDropdowns),
                );
                const chips = form.querySelector("[data-active-filters]");
                const status = form.querySelector("[data-search-status]");
                const announce = (message) => {
                    if (status) {
                        status.hidden = false;
                        status.textContent = message;
                    }
                };
                form.addEventListener("submit", (event) => {
                    event.preventDefault();
                    // Frontend contract for the future CMS. No pretend search results.
                    const request = new CustomEvent("catalog:search", {
                        bubbles: true,
                        cancelable: true,
                        detail: Object.fromEntries(new FormData(form)),
                    });
                    if (form.dispatchEvent(request))
                        announce(
                            "جستجوی آنلاین پس از اتصال به سامانه فعال می‌شود؛ می‌توانید دسته‌بندی‌ها را مرور کنید.",
                        );
                });
                form.querySelector("[data-search-advanced]")?.addEventListener("click", () => {
                    const request = new CustomEvent("catalog:advanced", { bubbles: true, cancelable: true });
                    if (form.dispatchEvent(request))
                        announce("فیلترهای موجود در همین بخش قابل انتخاب‌اند؛ گزینه‌های تکمیلی هنوز فعال نیستند.");
                });
                form.querySelectorAll("select").forEach((select) =>
                    select.addEventListener("change", () => {
                        if (!chips) return;
                        [...chips.children]
                            .filter((chip) => chip.dataset.filterName === select.name)
                            .forEach((chip) => chip.remove());
                        if (!select.value) return;
                        const label = select.selectedOptions[0].textContent.trim();
                        // Replace matching initial display chips instead of duplicating them.
                        [...chips.children]
                            .filter((chip) => chip.querySelector("span")?.textContent.trim() === label)
                            .forEach((chip) => chip.remove());
                        const chip = document.createElement("span");
                        chip.className = "filter-chip";
                        chip.dataset.filterChip = "";
                        chip.dataset.filterName = select.name;
                        const text = document.createElement("span");
                        text.textContent = label;
                        const remove = document.createElement("button");
                        remove.type = "button";
                        remove.dataset.removeFilter = "";
                        remove.textContent = "×";
                        remove.setAttribute("aria-label", `حذف فیلتر ${label}`);
                        chip.append(text, remove);
                        chips.append(chip);
                    }),
                );
                chips?.addEventListener("click", (event) => {
                    const chip = event.target.closest("[data-remove-filter]")?.closest("[data-filter-chip]");
                    if (!chip) return;
                    const select = [...form.querySelectorAll("select")].find((s) => s.name === chip.dataset.filterName);
                    if (select) {
                        select.value = "";
                        select.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                    chip.remove();
                });
                form.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
                    form.reset();
                    chips?.replaceChildren();
                    form.querySelectorAll("select").forEach((select) =>
                        select.dispatchEvent(new Event("change", { bubbles: true })),
                    );
                    if (status) status.hidden = true;
                });
            });
        });
}
