/** Continuous customer strip; no scroll container or control toolbar.
 * Copies only complete the visual loop and are hidden from assistive technology.
 */
export function initPartners() {
    document.querySelectorAll("[data-partners]").forEach((root) => {
        if (root.dataset.initialized) return;
        root.dataset.initialized = "true";
        const viewport = root.querySelector("[data-partner-viewport]");
        const track = root.querySelector("[data-partner-track]");
        const group = root.querySelector("[data-partner-group]");
        if (!viewport || !track || !group || !group.children.length) return;
        const copies = [...track.children].filter((child) => child !== group);
        const loadCopy = (copy) =>
            copy.querySelectorAll("img").forEach((image) => {
                image.loading = "eager";
            });
        copies.forEach(loadCopy);
        let visible = false;
        function measure() {
            const distance = group.getBoundingClientRect().width;
            if (!distance) return;
            // A compact group may be narrower than the viewport. Extra copies
            // cover it even at the final animation frame, without stretching gaps.
            const needed = Math.max(1, Math.ceil(viewport.clientWidth / distance));
            while (copies.length < needed) {
                const copy = group.cloneNode(true);
                copy.removeAttribute("data-partner-group");
                copy.removeAttribute("aria-label");
                copy.setAttribute("aria-hidden", "true");
                loadCopy(copy);
                track.append(copy);
                copies.push(copy);
            }
            while (copies.length > needed) copies.pop().remove();
            root.style.setProperty("--partners-scroll-distance", `${distance}px`);
            root.style.setProperty("--partners-scroll-duration", `${Math.max(24, distance / 26)}s`);
        }
        const sync = () => (track.style.animationPlayState = visible && !document.hidden ? "running" : "paused");
        new ResizeObserver(measure).observe(viewport);
        new ResizeObserver(measure).observe(group);
        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            sync();
        }).observe(root);
        document.addEventListener("visibilitychange", sync);
        measure();
    });
}
