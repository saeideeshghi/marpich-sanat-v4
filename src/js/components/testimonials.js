/* Shared testimonial slider: touch/mouse dragging, keyboard and optional controls.
 * Auto-advance pauses for interaction, hidden documents and reduced motion.
 * Reachable positions are deduplicated when two cards fit in the viewport.
 */
export function initTestimonials(scope = document) {
    scope.querySelectorAll("[data-testimonials-track]").forEach((track) => {
        if (track.dataset.initialized) return;
        track.dataset.initialized = "true";
        const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
        const root = track.closest(".testimonials");
        const controls = root?.querySelector("[data-slider-controls]");
        const pause = root?.querySelector("[data-slider-pause]");
        let timer;
        let pointer = null;
        let paused = false;
        let suppressClickUntil = 0;
        const rtl = () => getComputedStyle(track).direction === "rtl";
        const sliding = () => track.scrollWidth > track.clientWidth + 2;
        const stop = () => clearInterval(timer);
        const positions = () => {
            const box = track.getBoundingClientRect();
            const maximum = Math.max(0, track.scrollWidth - track.clientWidth);
            const rightToLeft = rtl();
            const offsets = [];
            for (const card of track.children) {
                const rect = card.getBoundingClientRect();
                const offset = track.scrollLeft + (rightToLeft ? rect.right - box.right : rect.left - box.left);
                const position = Math.max(rightToLeft ? -maximum : 0, Math.min(rightToLeft ? 0 : maximum, offset));
                if (!offsets.some((value) => Math.abs(value - position) < 2)) offsets.push(position);
            }
            return offsets;
        };
        const nearest = (offsets) =>
            offsets.reduce(
                (best, value, n) =>
                    Math.abs(value - track.scrollLeft) < Math.abs(offsets[best] - track.scrollLeft) ? n : best,
                0,
            );
        const go = (next) => {
            if (!sliding()) return;
            const offsets = positions();
            if (!offsets.length) return;
            const index = ((next % offsets.length) + offsets.length) % offsets.length;
            track.scrollTo({ left: offsets[index], behavior: reduceMotion.matches ? "instant" : "smooth" });
        };
        const step = (direction) => go(nearest(positions()) + direction);
        const start = () => {
            stop();
            if (
                !sliding() ||
                reduceMotion.matches ||
                paused ||
                pointer ||
                document.hidden ||
                root?.matches(":hover, :focus-within")
            )
                return;
            timer = setInterval(() => step(1), 5500);
        };
        track.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !sliding()) return;
            event.preventDefault();
            step((event.key === "ArrowLeft") === rtl() ? 1 : -1);
        });
        track.addEventListener("pointerdown", (event) => {
            if (
                !sliding() ||
                !event.isPrimary ||
                event.button !== 0 ||
                pointer ||
                event.target.closest("button, input, textarea, select, [contenteditable='true']")
            )
                return;
            const index = nearest(positions());
            pointer = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                lastX: event.clientX,
                scroll: track.scrollLeft,
                index,
                axis: null,
            };
            stop();
        });
        window.addEventListener(
            "pointermove",
            (event) => {
                if (!pointer || event.pointerId !== pointer.id) return;
                const dx = event.clientX - pointer.x;
                const dy = event.clientY - pointer.y;
                pointer.lastX = event.clientX;
                if (!pointer.axis) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
                    pointer.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
                    if (pointer.axis === "x") {
                        track.setAttribute("data-slider-dragging", "");
                        track.setPointerCapture(event.pointerId);
                    }
                }
                if (pointer.axis !== "x") return;
                event.preventDefault();
                track.scrollLeft = pointer.scroll - dx;
            },
            { passive: false },
        );
        const finish = (event) => {
            if (!pointer || event.pointerId !== pointer.id) return;
            const gesture = pointer;
            pointer = null;
            const offsets = positions();
            let target = nearest(offsets);
            if (gesture.axis === "x") {
                const dx = gesture.lastX - gesture.x;
                if (
                    event.type === "pointerup" &&
                    target === gesture.index &&
                    Math.abs(dx) >= Math.min(64, track.clientWidth * 0.15)
                ) {
                    const direction = (rtl() ? dx > 0 : dx < 0) ? 1 : -1;
                    target = Math.max(0, Math.min(offsets.length - 1, gesture.index + direction));
                }
                suppressClickUntil = performance.now() + 400;
                track.removeAttribute("data-slider-dragging");
                if (track.hasPointerCapture(gesture.id)) track.releasePointerCapture(gesture.id);
                go(target);
            }
            start();
        };
        for (const event of ["pointerup", "pointercancel"]) window.addEventListener(event, finish);
        track.addEventListener("lostpointercapture", (event) => {
            // Touch starts with implicit capture on the tapped child. Its
            // release bubbles here when horizontal dragging captures the track.
            if (event.target === track) finish(event);
        });
        track.addEventListener(
            "click",
            (event) => {
                if (event.detail && performance.now() < suppressClickUntil) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            true,
        );
        track.addEventListener("dragstart", (event) => {
            if (sliding()) event.preventDefault();
        });
        root?.addEventListener("mouseenter", stop);
        root?.addEventListener("mouseleave", start);
        root?.addEventListener("focusin", stop);
        root?.addEventListener("focusout", () => requestAnimationFrame(start));
        root?.querySelector("[data-slider-next]")?.addEventListener("click", () => step(1));
        root?.querySelector("[data-slider-prev]")?.addEventListener("click", () => step(-1));
        pause?.addEventListener("click", () => {
            paused = !paused;
            pause.setAttribute("aria-pressed", String(paused));
            pause.textContent = paused ? "ادامه پخش خودکار" : "توقف پخش خودکار";
            start();
        });
        const sync = () => {
            const scrollable = sliding();
            track.toggleAttribute("data-slider-scrollable", scrollable);
            if (controls) controls.hidden = !scrollable;
            if (pause) pause.hidden = reduceMotion.matches;
            start();
        };
        new ResizeObserver(sync).observe(track);
        new MutationObserver(sync).observe(track, { childList: true });
        reduceMotion.addEventListener("change", sync);
        document.addEventListener("visibilitychange", start);
        sync();
    });
}
