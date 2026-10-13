import { VIEWPORT_LIMITS } from "./schema.js";

/** Resize the actual iframe viewport. Freeze zoom during a drag so a scaled,
 * centered canvas follows the pointer rather than fighting auto-fit. */
export function createViewportResizer({ handles, stage, getWidth, getScale, setWidth }) {
    let drag = null;
    let pending = null;
    let animationFrame = 0;
    const flush = () => {
        animationFrame = 0;
        if (pending !== null) {
            setWidth(pending);
            pending = null;
        }
    };
    const finish = () => {
        if (!drag) return;
        cancelAnimationFrame(animationFrame);
        flush();
        const { handle, pointerId } = drag;
        drag = null;
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        stage.classList.remove("is-resizing");
        setWidth(getWidth());
    };
    for (const handle of handles) {
        const direction = handle.dataset.resizeSide === "left" ? -1 : 1;
        handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || drag) return;
            event.preventDefault();
            handle.focus({ preventScroll: true });
            const padding = getComputedStyle(stage);
            const availableWidth =
                stage.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
            drag = {
                handle,
                pointerId: event.pointerId,
                x: event.clientX,
                width: getWidth(),
                scale: getScale(),
                // Oversized zoomed canvases start at the left edge instead of being centered.
                factor: getWidth() * getScale() > availableWidth ? 1 : 2,
            };
            handle.setPointerCapture(event.pointerId);
            stage.classList.add("is-resizing");
        });
        handle.addEventListener("pointermove", (event) => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            pending = Math.round(drag.width + (drag.factor * direction * (event.clientX - drag.x)) / drag.scale);
            if (!animationFrame) animationFrame = requestAnimationFrame(flush);
        });
        for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) handle.addEventListener(name, finish);
        handle.addEventListener("keydown", (event) => {
            const step = event.shiftKey ? 10 : event.ctrlKey || event.metaKey ? 100 : 1;
            let width;
            if (event.key === "ArrowRight") width = getWidth() + step * direction;
            else if (event.key === "ArrowLeft") width = getWidth() - step * direction;
            else if (event.key === "Home") width = VIEWPORT_LIMITS.min;
            else if (event.key === "End") width = VIEWPORT_LIMITS.max;
            else return;
            event.preventDefault();
            setWidth(width);
        });
    }
    window.addEventListener("blur", finish);
    return {
        get dragging() {
            return Boolean(drag);
        },
        get scale() {
            return drag?.scale;
        },
        update(width) {
            for (const handle of handles) {
                handle.setAttribute("aria-valuenow", String(width));
                handle.setAttribute("aria-valuetext", `${width} پیکسل`);
            }
        },
    };
}
