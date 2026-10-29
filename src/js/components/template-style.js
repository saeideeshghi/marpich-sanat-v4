import { initCustomizerImage } from "./customizer-image.js";
import { imageSourceRules } from "../customizer/image-source.js";

// The approved stylesheet is a separate link, so the editor can replace it with
// a draft without leaking old approved declarations into its preview.
export function initTemplateStyles() {
    initCustomizerImage(import.meta.env.BASE_URL);
    if (
        import.meta.env.MODE !== "backend" &&
        import.meta.env.MODE !== "pages" &&
        new URL(location.href).searchParams.has("mps-preview")
    )
        import("../customizer/preview-session.js").then(({ initDraftPreview }) =>
            initDraftPreview(import.meta.env.BASE_URL),
        );
    if (import.meta.hot) {
        import.meta.hot.on("marpich:template-saved", async ({ revision }) => {
            const link = document.getElementById("mps-template-overrides");
            if (!link) return;
            const url = new URL(link.href);
            url.searchParams.set("v", revision);
            link.href = url.href;
            try {
                const response = await fetch(`${import.meta.env.BASE_URL}assets/customizer/settings.json`, {
                    cache: "no-store",
                });
                const config = await response.json();
                window.dispatchEvent(new CustomEvent("site:image-preview", { detail: imageSourceRules(config.rules) }));
                if (config.patterns)
                    window.dispatchEvent(new CustomEvent("site:pattern-preview", { detail: config.patterns }));
            } catch {
                /* A later page load uses the saved source artwork. */
            }
        });
    }
}
