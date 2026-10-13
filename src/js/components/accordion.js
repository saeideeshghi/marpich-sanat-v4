/* Progressively enhanced FAQ. Keep data hooks, unique IDs, aria-controls and
 * aria-labelledby together when rendering server-side. Defaults to one open item.
 */
export function initAccordions(scope = document) {
    scope.querySelectorAll("[data-faq]").forEach((root) => {
        if (root.dataset.initialized) return;
        root.dataset.initialized = "true";
        const buttons = [...root.querySelectorAll("[data-faq-trigger]")];
        const setOpen = (button, open) => {
            const item = button.closest("[data-faq-item]");
            const answer = item?.querySelector('[role="region"]');
            if (!answer) return;
            button.setAttribute("aria-expanded", String(open));
            item.classList.toggle("is-open", open);
            answer.hidden = !open;
        };
        const items = [...root.querySelectorAll("[data-faq-item]")];
        const more = root.querySelector("[data-faq-more]");
        const previewCount = Math.max(1, Number(root.dataset.faqPreviewCount) || 3);
        if (more && items.length > previewCount) {
            const label = more.querySelector(".site-text-link__label");
            const initialLabel = label?.textContent || "بیشتر بخوانید";
            const setMore = (open) => {
                items.slice(previewCount).forEach((item) => {
                    if (!open) {
                        const button = item.querySelector("[data-faq-trigger]");
                        if (button) setOpen(button, false);
                    }
                    item.hidden = !open;
                });
                more.setAttribute("aria-expanded", String(open));
                if (label) label.textContent = open ? "نمایش کمتر" : initialLabel;
            };
            more.hidden = false;
            setMore(false);
            more.addEventListener("click", () => setMore(more.getAttribute("aria-expanded") !== "true"));
        }
        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                const open = button.getAttribute("aria-expanded") !== "true";
                if (open && root.dataset.singleOpen !== "false") buttons.forEach((other) => setOpen(other, false));
                setOpen(button, open);
            });
            button.addEventListener("keydown", (event) => {
                const visibleButtons = buttons.filter((item) => !item.closest("[data-faq-item]").hidden);
                const index = visibleButtons.indexOf(button);
                const next = {
                    ArrowDown: (index + 1) % visibleButtons.length,
                    ArrowUp: (index - 1 + visibleButtons.length) % visibleButtons.length,
                    Home: 0,
                    End: visibleButtons.length - 1,
                }[event.key];
                if (next === undefined) return;
                event.preventDefault();
                visibleButtons[next].focus();
            });
        });
    });
}
