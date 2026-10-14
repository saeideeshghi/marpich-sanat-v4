import { imageSourceAtWidth, publicImageSource } from "../customizer/image-source.js";

// Approved sources are embedded at build time, so Pages needs no extra request.
// The editor and standalone preview replace the same responsive source list.
export function initCustomizerImage(base) {
    const image = document.querySelector(".about-team-media__image");
    if (!image || image.dataset.sourceInitialized) return;
    image.dataset.sourceInitialized = "true";
    const original = image.getAttribute("src");
    const originalAttributes = new Map(
        ["srcset", "sizes", "width", "height"].map((name) => [name, image.getAttribute(name)]),
    );
    const generatedDimensions = image.hasAttribute("data-asset-dimensions");
    const restoreAttributes = () => {
        for (const [name, value] of originalAttributes)
            if (value === null) image.removeAttribute(name);
            else image.setAttribute(name, value);
    };
    image.dataset.originalSource = original;
    const approved = JSON.parse(document.getElementById("mps-image-sources")?.textContent || "[]");
    let sources = approved;
    let desired = null;
    let custom = false;
    let frame = 0;
    const apply = () => {
        const source = imageSourceAtWidth(sources, window.innerWidth);
        const next = source ? publicImageSource(source, base) : original;
        if (next === desired && Boolean(source) === custom) return;
        desired = next;
        custom = Boolean(source);
        delete image.dataset.sourceError;
        if (custom) {
            image.removeAttribute("srcset");
            image.removeAttribute("sizes");
            if (generatedDimensions) {
                image.removeAttribute("width");
                image.removeAttribute("height");
            }
        } else restoreAttributes();
        image.setAttribute("src", next);
    };
    image.addEventListener("error", () => {
        if (image.getAttribute("src") === original) return;
        image.dataset.sourceError = desired;
        restoreAttributes();
        image.setAttribute("src", original);
    });
    window.addEventListener(
        "resize",
        () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                apply();
            });
        },
        { passive: true },
    );
    window.addEventListener("site:image-preview", (event) => {
        sources = event.detail || approved;
        apply();
    });
    apply();
}
