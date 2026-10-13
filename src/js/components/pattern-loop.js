// A repeating light tile needs equal endpoint speed as well as equal colour.
// Smooth easing varies the speed gently without stopping at each loop boundary.
export function continuousLoopProgress(value, easing = "linear") {
    if (easing !== "smooth" || value === 0 || value === 1) return value;
    return value + (0.35 * Math.sin(value * Math.PI * 2)) / (Math.PI * 2);
}

// A scene-wide tile left a long dark gap inside the faded/cropped artwork.
// Keep the authored band width and repeat it at most two band-widths apart.
export function repeatingLightSpan(sceneSpan, width) {
    return Math.min(Math.max(1, sceneSpan), Math.max(1, width) * 2);
}

// Keep the existing 260-unit light band inside a scene-sized repeating tile.
// Transparent tile edges make translations by exactly one tile visually equal.
export function repeatingLightStops(span, width, lightColor, coreColor) {
    const ratio = Math.min(1, Math.max(1, width) / Math.max(1, span));
    const start = (1 - ratio) * 50;
    const band = [
        [0, lightColor, 0],
        [34, lightColor, 0.3],
        [50, coreColor, 1],
        [67, lightColor, 0.65],
        [100, lightColor, 0],
    ];
    return [
        { offset: 0, color: lightColor, opacity: 0 },
        ...band.map(([offset, color, opacity]) => ({ offset: start + offset * ratio, color, opacity })),
        { offset: 100, color: lightColor, opacity: 0 },
    ];
}
