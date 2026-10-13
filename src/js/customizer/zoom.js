export const ZOOM_LIMITS = { min: 25, max: 200, step: 10 };

/** Zoom belongs to the editor view. It never becomes a template CSS rule. */
export function normalizeZoom(value) {
    if (value === "fit" || value === "" || !["string", "number"].includes(typeof value)) return "fit";
    const percent = Number(value);
    return Number.isFinite(percent) ? Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, Math.round(percent))) : "fit";
}

export function previewGeometry({ width, availableWidth, availableHeight, zoom = "fit", frozenScale }) {
    const fit = Math.min(1, Math.max(0.15, availableWidth / width));
    const mode = normalizeZoom(zoom);
    const scale = frozenScale ?? (mode === "fit" ? fit : mode / 100);
    // Both iframe dimensions stay the same when only the zoom changes.
    const height = Math.round(Math.max(320, availableHeight) / fit);
    return { width, height, scale, shellWidth: width * scale, shellHeight: height * scale };
}
