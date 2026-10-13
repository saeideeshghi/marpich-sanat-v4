/* Language disclosure only. EN/AR content must come from the site's actual
 * localized routes. A backend adapter can cancel site:language-request and
 * navigate there; Persian content never receives a false lang/dir attribute. */
export function initLanguageSelectors() {
    const selectors = [...document.querySelectorAll("[data-language-selector]")];
    const close = (root, restoreFocus = false) => {
        const toggle = root.querySelector("[data-language-toggle]");
        root.querySelector("[data-language-menu]").hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        if (restoreFocus) toggle.focus();
    };

    selectors.forEach((root) => {
        const toggle = root.querySelector("[data-language-toggle]");
        const menu = root.querySelector("[data-language-menu]");
        const options = [...menu.querySelectorAll("[data-language-option]")];
        const status = root.querySelector("[data-language-status]");
        const open = () => {
            selectors.forEach((other) => {
                if (other !== root) close(other);
            });
            status.hidden = true;
            menu.hidden = false;
            toggle.setAttribute("aria-expanded", "true");
        };
        toggle.addEventListener("click", () => (menu.hidden ? open() : close(root)));
        toggle.addEventListener("keydown", (event) => {
            if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            open();
            (event.key === "ArrowDown" ? options[0] : options.at(-1)).focus();
        });
        root.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && (!menu.hidden || !status.hidden)) {
                event.preventDefault();
                event.stopPropagation();
                status.hidden = true;
                close(root, true);
            } else if (
                ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
                options.includes(document.activeElement)
            ) {
                event.preventDefault();
                const index = options.indexOf(document.activeElement);
                const next =
                    event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? options.length - 1
                          : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
                options[next].focus();
            }
        });
        options.forEach((option) =>
            option.addEventListener("click", () => {
                const language = option.dataset.languageOption;
                close(root, true);
                if (language === "fa") return;
                const request = new CustomEvent("site:language-request", { detail: { language }, cancelable: true });
                if (document.dispatchEvent(request)) {
                    status.textContent = `نسخه ${language === "en" ? "انگلیسی" : "عربی"} فعلاً در دسترس نیست.`;
                    status.hidden = false;
                }
            }),
        );
        root.addEventListener("focusout", (event) => {
            if (!root.contains(event.relatedTarget)) close(root);
        });
    });
    document.addEventListener("click", (event) =>
        selectors.forEach((root) => {
            if (!root.contains(event.target)) {
                close(root);
                root.querySelector("[data-language-status]").hidden = true;
            }
        }),
    );
    window.matchMedia("(min-width: 1180px)").addEventListener("change", () => selectors.forEach((root) => close(root)));
}
