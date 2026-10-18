/* Product image tools only: CSS rotateY is a 2D image flip, not a 3D model.
 * Failed images reveal adjacent data-image-fallback; fullscreen depends on browser support.
 */
import { initSite } from "../main.js";

initSite();

// Razor/CMS renders a validated download link when a file exists. Until then,
// an adapter can claim this event; the UI never requests a made-up document.
document.querySelectorAll("[data-product-document]").forEach((button) => {
    button.addEventListener("click", () => {
        const request = new CustomEvent("product:document-request", {
            bubbles: true,
            cancelable: true,
            detail: { kind: button.dataset.productDocument, button },
        });
        if (!button.dispatchEvent(request)) return;
        const status = document.querySelector("[data-product-document-status]");
        if (status) {
            status.hidden = false;
            status.textContent = "فایل فنی این محصول هنوز اضافه نشده است؛ برای دریافت آن با ما تماس بگیرید.";
        }
    });
});

const productImage = document.querySelector("[data-product-image]");
const rotateButton = document.querySelector("[data-view-rotate]");
const fullscreenButton = document.querySelector("[data-view-fullscreen]");

let rotation = 0;

const showImageFallback = (image) => {
    // Native hidden is backed by the shared [hidden] rule, even with img display:block.
    image.hidden = true;

    const fallback = image.nextElementSibling;
    if (fallback?.hasAttribute("data-image-fallback")) {
        fallback.classList.remove("hidden");
        fallback.classList.add("flex");
    }
};

document.querySelectorAll("[data-product-image], [data-fallback-image]").forEach((image) => {
    image.addEventListener("error", () => showImageFallback(image));

    if (image.complete && image.naturalWidth === 0) {
        showImageFallback(image);
    }
});

rotateButton?.addEventListener("click", () => {
    rotation += 180;
    if (productImage) productImage.style.transform = `rotateY(${rotation}deg)`;
});

fullscreenButton?.addEventListener("click", async () => {
    if (!productImage?.requestFullscreen) return;

    try {
        await productImage.requestFullscreen();
    } catch {
        // Fullscreen can be blocked by the browser; the normal image remains usable.
    }
});
