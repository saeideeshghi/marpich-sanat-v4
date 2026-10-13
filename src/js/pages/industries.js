// Page behavior; the head loads styles before this module.
import { initSite } from "../main.js";

initSite();

function initIndustriesPage() {
    const page = document.querySelector("[data-industries-page]");

    if (!page) return;

    /* Temporary visual fallback until the final industry exports are copied
       into /public/assets/images/industries/. */
    page.querySelectorAll("img[data-fallback]").forEach((image) => {
        const showFallback = () => {
            const fallback = image.dataset.fallback;

            if (!fallback || image.dataset.fallbackUsed === "true") return;

            image.dataset.fallbackUsed = "true";
            image.src = fallback;
        };
        image.addEventListener("error", showFallback, { once: true });
        // Cached failures can happen before this ES module is evaluated.
        if (image.complete && image.naturalWidth === 0) showFallback();
    });
}

initIndustriesPage();
