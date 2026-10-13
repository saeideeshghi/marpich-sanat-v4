// Pure validation shared by local saving, export and the live pattern preview.
import { isValidSvgPath } from "../utils/svg-path.js";
export const PATTERN_RENDER_DEFAULTS = { minStrokeWidth: 0.85 };
const finite = (v, min = -10000, max = 10000) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const color = (v) => typeof v === "string" && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(v);
const fail = () => {
    throw new Error("تنظیمات پترن معتبر نیست.");
};
const safeTree = (v, depth = 0) => {
    if (depth > 10) fail();
    if (typeof v === "number") {
        if (!finite(v)) fail();
    } else if (typeof v === "string") {
        if (v.length > 30000 || /[<>]|javascript:|url\(/i.test(v)) fail();
    } else if (typeof v === "boolean" || v === null) return;
    else if (Array.isArray(v)) {
        if (v.length > 64) fail();
        v.forEach((item) => safeTree(item, depth + 1));
    } else if (v && typeof v === "object") {
        for (const [key, value] of Object.entries(v)) {
            if (["__proto__", "constructor", "prototype"].includes(key)) fail();
            safeTree(value, depth + 1);
        }
    } else fail();
};
const animation = (a) => {
    if (
        !a ||
        !["none", "wave", "light", "combined"].includes(a.mode) ||
        !["linear", "smooth"].includes(a.easing) ||
        !["none", "fade", "reveal"].includes(a.entrance)
    )
        fail();
    for (const key of ["period", "lightPeriod", "pulsePeriod", "entranceDuration"])
        if (!finite(a[key], 0.05, 600)) fail();
    if (!color(a.lightColor) || !color(a.coreColor) || !finite(a.fps, 1, 60) || !finite(a.speed, 0, 10)) fail();
    if (a.minStrokeWidth !== undefined && !finite(a.minStrokeWidth, 0, 2)) fail();
    // Match the editor's actual ranges; enormous cycle/amplitude values can
    // otherwise turn a short SVG into millions of subdivision/animation points.
    if (!finite(a.cycles, 0.1, 10) || !finite(a.amplitude, 0, 100) || !finite(a.glow, 0, 30)) fail();
    for (const key of ["direction", "lightDirection"]) if (![1, -1].includes(a[key])) fail();
};
const lines = (items) => {
    if (!Array.isArray(items) || !items.length || items.length > 64) fail();
    for (const line of items) {
        if (!isValidSvgPath(line.d, 10000) || !line.gradientBase) fail();
        for (const key of [
            "x",
            "y",
            "rotation",
            "scaleX",
            "scaleY",
            "thickness",
            "opacity",
            "wave",
            "speed",
            "phase",
            "delay",
            "light",
            "gradientScale",
            "gradientAngle",
            "gradientShift",
        ])
            if (!finite(line[key])) fail();
        if (!Array.isArray(line.stops) || line.stops.length < 2 || line.stops.length > 32) fail();
        for (const stop of line.stops)
            if (!color(stop.color) || !finite(stop.offset, 0, 100) || !finite(stop.opacity, 0, 1)) fail();
    }
};
export function normalizePattern(input) {
    if (
        !input ||
        input.format !== "mps-pattern-studio" ||
        !finite(input.breakpoint, 280, 1180) ||
        !input.profiles?.desktop ||
        !input.profiles?.mobile
    )
        fail();
    if (JSON.stringify(input).length > 350000) fail();
    safeTree(input);
    animation(input.animation);
    lines(input.lines);
    const result = structuredClone(input);
    result.animation = { ...PATTERN_RENDER_DEFAULTS, ...result.animation };
    for (const [key, p] of Object.entries(result.profiles)) {
        if (!["desktop", "tablet", "mobile"].includes(key)) fail();
        if (
            !finite(p.height, 1, 2400) ||
            !finite(p.width, 1, 500) ||
            !finite(p.opacity, 0, 100) ||
            !finite(p.scaleY, 1, 400)
        )
            fail();
        if (p.artwork && !result.artworks?.[p.artwork]) fail();
        if (p.animation) animation({ ...result.animation, ...p.animation });
    }
    for (const artwork of Object.values(result.artworks || {})) {
        if (artwork.strokeOnly !== undefined && typeof artwork.strokeOnly !== "boolean") fail();
        if (
            !Array.isArray(artwork.viewBox) ||
            artwork.viewBox.length !== 4 ||
            !artwork.viewBox.every((v) => finite(v)) ||
            artwork.viewBox[2] <= 0 ||
            artwork.viewBox[3] <= 0
        )
            fail();
        if (!["x", "y"].includes(artwork.waveAxis) || !["x", "y"].includes(artwork.lightAxis)) fail();
        lines(artwork.lines);
    }
    // Give tablet a real independent profile while retaining the approved look.
    result.profiles.tablet ||= structuredClone(result.profiles.desktop);
    result.artworks ||= {};
    for (const key of ["desktop", "mobile", "tablet"]) {
        const profile = result.profiles[key];
        const source = result.artworks[profile.artwork || key] ||
            result.artworks.desktop || {
                viewBox: [0, 0, 1008, 494],
                waveAxis: "y",
                lightAxis: "x",
                lines: result.lines,
            };
        if (!result.artworks[key]) result.artworks[key] = structuredClone(source);
        profile.artwork = key;
    }
    result.lines = structuredClone(result.artworks.desktop.lines);
    return result;
}
export function normalizePatterns(input) {
    if (!input || !input.header || !input.footer) fail();
    return { header: normalizePattern(input.header), footer: normalizePattern(input.footer) };
}
