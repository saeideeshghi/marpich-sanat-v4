/* The original header overlays the hero, so switching to fixed position does
 * not remove an in-flow row or change the page height. All settings are CSS
 * variables: approved, draft and exported styles use the same controller. */
export function initFixedHeader() {
    const header = document.querySelector(".site-header");
    if (!header || header.dataset.fixedHeaderInitialized) return;
    header.dataset.fixedHeaderInitialized = "true";

    // Resolve CSS lengths (including rem/clamp/var) to pixels without parsing
    // their text. This measurement stays outside navigation's flex layout.
    const measure = document.createElement("span");
    measure.className = "site-header__settings-measure";
    measure.setAttribute("aria-hidden", "true");
    header.append(measure);
    const html = document.documentElement;
    const originalPadding = html.style.scrollPaddingTop;
    const hamburger = window.matchMedia("(max-width: 1179px)");
    let frame = 0;
    let needsMeasure = true;
    let settings = { enabled: false, threshold: 0, top: 0 };

    function apply() {
        frame = 0;
        const measured = needsMeasure;
        needsMeasure = false;
        if (measured) {
            const css = getComputedStyle(header),
                size = getComputedStyle(measure);
            settings = {
                enabled: Number(css.getPropertyValue("--header-fixed-enabled")) !== 0,
                threshold: Math.max(0, parseFloat(size.width) || 0),
                top: hamburger.matches ? 0 : Math.max(0, parseFloat(size.height) || 0),
            };
        }
        const fixed = settings.enabled && window.scrollY >= settings.threshold;
        const changed = header.dataset.headerFixed !== String(fixed);
        if (changed) {
            header.dataset.headerFixed = String(fixed);
            // Re-measure the compact row on the next frame for anchor navigation.
            needsMeasure = true;
            schedule();
        }
        // Anchor navigation and scrollIntoView keep their targets below the menu.
        if (!measured && !changed) return;
        const padding = fixed
            ? `${Math.ceil(header.getBoundingClientRect().height + settings.top + 12)}px`
            : originalPadding;
        if (html.style.scrollPaddingTop !== padding) html.style.scrollPaddingTop = padding;
    }

    function schedule() {
        if (!frame) frame = requestAnimationFrame(apply);
    }
    const refresh = () => {
        needsMeasure = true;
        schedule();
    };
    const onScroll = () => schedule();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("pageshow", refresh);
    window.addEventListener("site:styles-preview", refresh);
    document.addEventListener(
        "load",
        (event) => {
            if (event.target instanceof HTMLLinkElement) refresh();
        },
        true,
    );
    document.fonts.ready.then(refresh);
    const resize = new ResizeObserver(refresh);
    resize.observe(header);
    resize.observe(measure);
    // Includes live editor style text, compare toggles and Vite CSS replacement.
    const styles = new MutationObserver(refresh);
    styles.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["href", "disabled", "media", "style"],
    });
    const bodyStyle = new MutationObserver(refresh);
    bodyStyle.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    apply();
}
