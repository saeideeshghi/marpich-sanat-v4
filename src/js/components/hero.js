/* Align the search row with the dark background on the three landing pages. */
function initHeroSearchLayout(hero, content) {
    const panel = hero.querySelector(".product-search, .articles-search");
    if (!panel || hero.dataset.heroSearchLayoutInitialized) return;
    hero.dataset.heroSearchLayoutInitialized = "true";
    const alignSearchRow = ["articles", "products", "industries"].includes(document.body.dataset.page);
    const searchButton = alignSearchRow ? panel.querySelector('button[type="submit"]') : null;
    let offset = 0;

    const fitBackdrop = () => {
        const heroTop = hero.getBoundingClientRect().top;
        const box = panel.getBoundingClientRect();
        let boundary = box.top - heroTop + box.height / 2;
        if (searchButton) {
            const buttonBottom = searchButton.getBoundingClientRect().bottom;
            // Keep the small desktop correction without pushing tall mobile filters far down.
            const nextOffset = Math.min(24, Math.max(0, box.height / 2 - (buttonBottom - box.top)));
            boundary = buttonBottom - heroTop - offset + nextOffset;
            if (nextOffset !== offset) {
                panel.style.insetBlockStart = `${nextOffset}px`;
                panel.style.marginBlockEnd = `${nextOffset}px`;
                offset = nextOffset;
            }
        }
        const value = `${boundary}px`;
        if (hero.style.getPropertyValue("--hero-search-backdrop-height") !== value) {
            hero.style.setProperty("--hero-search-backdrop-height", value);
        }
    };
    // The offset depends on intrinsic panel dimensions, so layout settles after resizing.
    const observer = new ResizeObserver(fitBackdrop);
    observer.observe(content);
    observer.observe(panel);
    if (searchButton) observer.observe(searchButton);
    window.addEventListener("resize", fitBackdrop, { passive: true });
    document.fonts.ready.then(fitBackdrop);
    fitBackdrop();
}

/* Keep image/summary overlaps clear of the final wrapped hero text.
 * The preferred overlap comes from type-settings.css. Its actual value is
 * clamped to the space below the text, so future per-page font edits are safe. */
export function initHeroLayout() {
    const hero = document.querySelector("[data-site-hero]");
    const content = hero?.querySelector(".site-hero__content");
    if (!hero || !content) return;
    initHeroSearchLayout(hero, content);

    const summaries = {
        about: ".about-team-wrap",
        "project-details": ".project-details__summary",
        // Decoration can precede the card; use its own class, not child order.
        "product-details": ".product-details__summary",
        "industry-textile": ".industry-textile__summary",
    };
    const summary = document.querySelector(summaries[document.body.dataset.page] || "[data-hero-summary]");
    if (!summary || hero.dataset.heroLayoutInitialized) return;
    hero.dataset.heroLayoutInitialized = "true";

    const fitOverlap = () => {
        const text = hero.querySelector(".site-hero__description") || hero.querySelector(".site-hero__title");
        if (!text) return;
        const heroBottom = hero.getBoundingClientRect().bottom;
        const textBottom = text.getBoundingClientRect().bottom;
        // Respect the actual root size when the preferred value uses rem.
        const raw = getComputedStyle(document.body).getPropertyValue("--hero-summary-overlap-preferred").trim();
        const preferred = parseFloat(raw) || 0;
        const pixels = raw.endsWith("rem")
            ? preferred * parseFloat(getComputedStyle(document.documentElement).fontSize)
            : preferred;
        const available = Math.max(0, heroBottom - textBottom - 24);
        const overlap = Math.min(pixels, available);
        const value = `${overlap}px`;
        if (document.body.style.getPropertyValue("--hero-summary-overlap") !== value) {
            document.body.style.setProperty("--hero-summary-overlap", value);
        }
    };
    const observer = new ResizeObserver(fitOverlap);
    observer.observe(hero);
    observer.observe(content);
    window.addEventListener("resize", fitOverlap, { passive: true });
    document.fonts.ready.then(fitOverlap);
    fitOverlap();
}
