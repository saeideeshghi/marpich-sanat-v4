// Only the selected region/profile changes. Artwork, colors and placement stay
// authored, and one caller commit keeps each preset reversible with Undo.
export function applyPatternPreset(pattern, profileName, preset) {
    const profile = pattern.profiles[profileName];
    profile.motionSpeed = 1;
    const common = {
        speed: 0.85,
        lightPeriod: 14,
        lightPause: 0,
        minStrokeWidth: 0.85,
        glow: 0,
        pulse: 0,
        entrance: "none",
        easing: "smooth",
    };
    if (preset === "calm") {
        profile.motion = 100;
        profile.animation = {
            ...profile.animation,
            ...common,
            mode: "combined",
            amplitude: 7,
            period: 24,
            cycles: 1,
            phaseStep: 0.15,
        };
    } else if (preset === "light") {
        profile.animation = { ...profile.animation, ...common, mode: "light" };
    } else throw new Error("تنظیم آمادهٔ پترن شناخته نشد.");
}
