// Page behavior; the head loads styles before this module.
import { initSite } from "../main.js";

initSite();

/* ---------------------------------------------------------
 * Main textile image fallback
 * Preferred industry asset -> existing project assets.
 * ------------------------------------------------------ */
const summaryImage = document.querySelector(".industry-textile__summary-image");

if (summaryImage) {
    const candidates = (summaryImage.dataset.imageCandidates || "")
        .split("|")
        .map((src) => src.trim())
        .filter(Boolean);

    let candidateIndex = Math.max(candidates.indexOf(summaryImage.getAttribute("src")), 0);

    const showNextCandidate = () => {
        candidateIndex += 1;

        if (candidateIndex < candidates.length) {
            summaryImage.src = candidates[candidateIndex];
        }
    };
    summaryImage.addEventListener("error", showNextCandidate);
    // Handle an image that failed before module initialization as well.
    if (summaryImage.complete && summaryImage.naturalWidth === 0) showNextCandidate();
}
