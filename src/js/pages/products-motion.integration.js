import { initProductCategoryMotion } from "../components/product-category-motion.js";
import { normalizeSearchText } from "../utils/search-text.js";
import settings from "../../data/product-motion/config.json";
import categoryIndex from "../../data/product-motion/category-index.json";

/** Align the category section below the menu, including a future fixed state. */
export function getProductsScrollTarget(stage) {
    const doc = stage.ownerDocument,
        win = doc.defaultView;
    const gap = 16;
    const sectionTop = win.scrollY + stage.getBoundingClientRect().top;
    const ordinaryTarget = Math.max(0, sectionTop - gap);
    const header = doc.querySelector(".site-header");
    if (!header) return ordinaryTarget;

    const css = win.getComputedStyle(header);
    const enabledValue = css.getPropertyValue?.("--header-fixed-enabled").trim();
    const fixed = header.dataset.headerFixed === "true" || css.position === "fixed";
    const enabled = enabledValue ? Number(enabledValue) !== 0 : fixed;
    if (!enabled) return ordinaryTarget;

    // initSite's measuring element resolves rem/clamp/var settings to pixels.
    const measure = header.querySelector(".site-header__settings-measure");
    const measured = measure ? win.getComputedStyle(measure) : null;
    const threshold = Math.max(
        0,
        Number.parseFloat(measured?.width || css.getPropertyValue?.("--header-fixed-scroll-threshold")) || 0,
    );
    if (ordinaryTarget < threshold) return ordinaryTarget;
    const fixedTop = Math.max(
        0,
        Number.parseFloat(measured?.height || css.getPropertyValue?.("--header-fixed-top")) || 0,
    );
    let height = header.getBoundingClientRect().height;
    const mobile = header.querySelector(".site-header__mobile");
    if (!fixed && mobile) {
        const mobileCSS = win.getComputedStyle(mobile);
        if (mobileCSS.display !== "none") {
            // The fixed hamburger row replaces its hero padding with 8px/side.
            const padding =
                (Number.parseFloat(mobileCSS.paddingTop) || 0) + (Number.parseFloat(mobileCSS.paddingBottom) || 0);
            height = Math.max(80, mobile.getBoundingClientRect().height - padding + 16);
        }
    }
    const fixedTarget = Math.max(0, sectionTop - fixedTop - height - gap);
    // Near the activation threshold, keep the header unfixed and the section
    // visible instead of choosing a position that would hide its top edge.
    return fixedTarget >= threshold ? fixedTarget : Math.max(0, threshold - 1);
}

/** Enhance the rendered catalogue without replacing cards, links or page styles. */
export function setupProductsMotion(root = document.querySelector("[data-products-page]")) {
    if (!root) return null;
    if (root.__productMotion) return root.__productMotion;

    const memberships = new Map(
        categoryIndex.products.map((product) => [normalizeSearchText(product.title), product.categories]),
    );
    root.querySelectorAll("[data-product-grid] .product-card").forEach((card) => {
        // Explicit memberships from the CMS take precedence over title matching.
        if (card.hasAttribute("data-pcm-categories") || card.hasAttribute("data-pcm-category")) return;
        const title = card.querySelector(".product-card__title")?.textContent || "";
        const categories = memberships.get(normalizeSearchText(title));
        if (categories) card.dataset.pcmCategories = categories.join(" ");
    });

    return initProductCategoryMotion(root, {
        config: settings.motion,
        categories: categoryIndex.categories,
        toolbar: "overlay",
        scrollTarget: getProductsScrollTarget,
        // Escape remains owned by the existing search controls and site menus.
        shouldHandleEscape: (event) => !event.target?.closest?.("[data-product-search]"),
    });
}
