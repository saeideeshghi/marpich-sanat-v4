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
        const primaryAction = document.querySelector('html:is([lang="fa"], [lang="ar"]) .home-hero-action--primary');
        if (primaryAction) {
            let alignmentFrame = 0;
            const alignSeparator = () => {
                if (alignmentFrame) cancelAnimationFrame(alignmentFrame);
                alignmentFrame = requestAnimationFrame(() => {
                    alignmentFrame = 0;
                    const separator = root.querySelector(".home-partners__separator");
                    const inner = root.querySelector(".home-partners__inner");
                    if (!separator || !inner) return;
                    const actionLeft = primaryAction.getBoundingClientRect().left - inner.getBoundingClientRect().left;
                    const narrow = window.matchMedia("(max-width: 639px)").matches;
                    const minLogosWidth = narrow ? 72 : 120;
                    const minTitleWidth = narrow ? 96 : 190;
                    const left = Math.max(minLogosWidth + 24, Math.min(actionLeft, inner.clientWidth - minTitleWidth));
                    root.dataset.separatorAligned = "true";
                    const separatorLeft = `${left}px`;
                    const columns = `minmax(0, ${Math.max(0, left - 24)}px) minmax(0, 1fr)`;
                    if (separator.style.left !== separatorLeft) separator.style.left = separatorLeft;
                    if (inner.style.gridTemplateColumns !== columns) inner.style.gridTemplateColumns = columns;
                });
            };
            const alignmentObserver = new ResizeObserver(alignSeparator);
            alignmentObserver.observe(primaryAction);
            window.addEventListener("resize", alignSeparator, { passive: true });
            document.fonts.ready.then(alignSeparator);
            alignSeparator();
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
