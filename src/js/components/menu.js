/* Shared navigation below 1180px. Locks background with inert, traps focus,
 * closes on navigation/Escape/desktop resize and restores the prior inert state.
 * Mobile submenus are real disclosure controls; desktop dropdowns use CSS hover/focus.
 */
const DESKTOP_QUERY = "(min-width: 1180px)";

export function initMobileMenu() {
    const menu = document.querySelector("[data-mobile-menu]");
    const trigger = document.querySelector("[data-menu-open]");
    if (!menu || !trigger || menu.dataset.initialized) return;
    menu.dataset.initialized = "true";

    const desktop = window.matchMedia(DESKTOP_QUERY);
    const background = new Map();
    let previousFocus;
    let isOpen = false;

    const focusable = () =>
        [
            ...menu.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
            ),
        ].filter((element) => element.getClientRects().length > 0);

    const submenuItems = [...menu.querySelectorAll("[data-mobile-submenu]")];

    const setSubmenu = (group, open) => {
        const toggle = group.querySelector("[data-mobile-submenu-toggle]");
        const panel = group.querySelector("[data-mobile-submenu-panel]");
        if (!toggle || !panel) return;

        toggle.setAttribute("aria-expanded", String(open));
        panel.hidden = !open;
        group.classList.toggle("is-open", open);
    };

    submenuItems.forEach((group) => {
        const toggle = group.querySelector("[data-mobile-submenu-toggle]");
        toggle?.addEventListener("click", () => {
            const next = toggle.getAttribute("aria-expanded") !== "true";
            submenuItems.forEach((other) => {
                if (other !== group) setSubmenu(other, false);
            });
            setSubmenu(group, next);
        });
    });

    function closeMenu({ restoreFocus = true } = {}) {
        if (!isOpen) return;
        isOpen = false;
        menu.classList.add("hidden");
        menu.setAttribute("aria-hidden", "true");
        trigger.setAttribute("aria-expanded", "false");
        document.documentElement.classList.remove("menu-open");
        document.body.classList.remove("menu-open");
        background.forEach((wasInert, element) => {
            element.inert = wasInert;
        });
        background.clear();
        if (restoreFocus) previousFocus?.focus({ preventScroll: true });
    }

    function openMenu() {
        if (isOpen || desktop.matches) return;
        isOpen = true;
        previousFocus = document.activeElement;
        menu.classList.remove("hidden");
        menu.setAttribute("aria-hidden", "false");
        trigger.setAttribute("aria-expanded", "true");
        document.documentElement.classList.add("menu-open");
        document.body.classList.add("menu-open");
        for (const element of document.body.children) {
            if (element === menu || ["SCRIPT", "STYLE", "LINK"].includes(element.tagName)) continue;
            background.set(element, element.inert);
            element.inert = true;
        }
        (menu.querySelector("button[data-menu-close]") || menu).focus();
    }

    trigger.addEventListener("click", openMenu);
    menu.addEventListener("click", (event) => {
        if (event.target.closest("[data-auth-open]")) closeMenu();
        else if (event.target.closest("[data-menu-close], a[href]")) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
        if (!isOpen) return;
        if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
        } else if (event.key === "Tab") {
            const items = focusable();
            const first = items[0];
            const last = items.at(-1);
            if (!first) {
                event.preventDefault();
                menu.focus();
                return;
            }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === menu)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === menu)) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    desktop.addEventListener("change", (event) => {
        if (event.matches) closeMenu({ restoreFocus: false });
    });

    window.addEventListener("pagehide", () => closeMenu({ restoreFocus: false }));
}
