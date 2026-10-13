// A native overlay link preserves keyboard navigation, modifier clicks and
// the context menu. Existing actions stay above it and keep their own targets.
export function initCardLinks() {
    const selectors = [
        ".home-expertise-grid > .site-card",
        ".home-projects-grid > .site-card",
        ".home-products-grid > .site-card",
        ".home-article__row",
        ".product-card",
        ".projects-page__card",
        ".project-details__product-card",
        ".article-card",
        ".industry-feature",
        ".industry-textile__product-card",
        ".industry-textile__project-card",
        ".about-expertise-card",
        ".about-gallery",
    ];
    const plans = [];
    document.querySelectorAll(selectors.join(",")).forEach((card) => {
        if (card.matches("a") || card.querySelector(":scope > .site-card-link")) return;
        const links = [...card.querySelectorAll("a[href]")];
        const primary = links.find((link) => {
            const href = link.getAttribute("href");
            return (
                href &&
                !href.startsWith("#") &&
                !link.hasAttribute("download") &&
                ["http:", "https:"].includes(new URL(link.href, location.href).protocol)
            );
        });
        if (!primary) return;
        const actions = [...card.querySelectorAll("a, button, input, select, textarea")].map((action) => ({
            action,
            staticPosition: getComputedStyle(action).position === "static",
        }));
        plans.push({ card, primary, actions });
    });
    // Finish all layout reads before adding links/classes to any card.
    plans.forEach(({ card, primary, actions }) => {
        actions.forEach(({ action, staticPosition }) => {
            action.classList.add("site-card-action");
            if (staticPosition) action.classList.add("site-card-action--static");
        });
        const overlay = document.createElement("a");
        overlay.className = "site-card-link";
        overlay.href = primary.href;
        if (primary.target) overlay.target = primary.target;
        if (primary.rel) overlay.rel = primary.rel;
        if (primary.target === "_blank")
            overlay.rel = [...new Set((overlay.rel + " noopener noreferrer").split(/\s+/))].join(" ").trim();
        overlay.setAttribute(
            "aria-label",
            card.querySelector("h2, h3, .site-card__title")?.textContent.trim() || primary.textContent.trim(),
        );
        card.classList.add("site-linked-card");
        card.append(overlay);
    });
}
