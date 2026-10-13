import assert from "node:assert/strict";
import { continuousLoopProgress, repeatingLightSpan, repeatingLightStops } from "../src/js/components/pattern-loop.js";

for (const easing of ["linear", "smooth"]) {
    assert.equal(continuousLoopProgress(0, easing), 0);
    assert.equal(continuousLoopProgress(1, easing), 1);
    const step = 1 / 10000;
    for (let i = 0; i < 10000; i++) {
        const speed =
            (continuousLoopProgress((i + 1) * step, easing) - continuousLoopProgress(i * step, easing)) / step;
        assert(speed >= 0.64 && speed <= 1.36, "Loop speed must stay positive throughout the cycle");
    }
    const entering = continuousLoopProgress(step, easing) / step;
    const leaving = (1 - continuousLoopProgress(1 - step, easing)) / step;
    assert(Math.abs(entering - leaving) < 1e-8, "Restart preserves speed in either light direction");
    assert(entering > 0.5, "The first frame must already move");
}
for (const span of [426, 706, 1008]) {
    for (const width of [1, 260, 2000]) {
        const stops = repeatingLightStops(span, width, "#f76e11", "#fff2dc");
        assert.equal(stops[0].offset, 0);
        assert.equal(stops.at(-1).offset, 100);
        assert.equal(stops[0].opacity, 0);
        assert.equal(stops.at(-1).opacity, 0);
        assert(
            stops.some((s) => Math.abs(s.offset - 50) < 1e-10 && s.opacity === 1),
            "Light is centred inside each tile",
        );
        for (let i = 1; i < stops.length; i++) {
            assert(stops[i].offset >= stops[i - 1].offset && stops[i].offset <= 100);
            assert(stops[i].opacity >= 0 && stops[i].opacity <= 1);
        }
        const repeatSpan = repeatingLightSpan(span, width);
        assert(repeatSpan <= span && repeatSpan >= 1, "Repeat tile stays within the scene");
        assert(repeatSpan <= width * 2, "No long invisible scene-wide interval between highlights");
        const duration = 14 * (repeatSpan / span);
        assert(Math.abs(repeatSpan / duration - span / 14) < 1e-8, "Shorter tiles preserve travel speed");
    }
}
console.log(
    "PASS: immediate continuous loop motion, closely spaced highlights, preserved speed and transparent repeat tiles.",
);
