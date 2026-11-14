/*
 * Shared decorative site pattern.
 *
 * Placement and geometry retain the approved Pattern Studio export:
 * - header and footer mobile profiles cover every viewport below 640px
 * - each footer profile keeps its own artwork and animation
 * - authored geometry retains its aspect ratio; mobile footer fills its host height
 * - decorative layers never affect layout
 *
 * Motion uses native SVG interpolation; imported FPS metadata remains compatible.
 * Only the Pattern Studio demo background/text are omitted here. The site host owns
 * its background/content; this module supplies the decorative SVG layer only.
 */
import { normalizePattern, PATTERN_RENDER_DEFAULTS } from "../customizer/pattern-model.js";
import { continuousLoopProgress, repeatingLightSpan, repeatingLightStops } from "./pattern-loop.js";
const mountedPatterns = new Map();
let previewListener = false;
let productBusy = false;
const linkedProducts = new WeakSet();

const SVG_NS = "http://www.w3.org/2000/svg";

const patternLoaders = {
    header: () => import("virtual:site-pattern/header").then((module) => module.default),
    footer: () => import("virtual:site-pattern/footer").then((module) => module.default),
};

export function mountPattern(root, initialConfig, initialTime = 0) {
    const uid = `mps-pattern-${Math.random().toString(36).slice(2, 10)}`;
    const create = (tag, attrs = {}, parent) => {
        const element = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        parent?.append(element);
        return element;
    };

    const config = initialConfig;
    // Profiles may override motion without affecting another artwork/profile.
    let animation = config.animation;
    let time = Math.max(0, initialTime);
    let clockRate = 1;
    let timelineReady = false;
    let paused = false;
    let suspended = false;
    let selected = null;
    let artwork = null;
    let sceneWidth = 1008;
    let sceneHeight = 494;
    const defaultArtwork = { viewBox: [0, 0, 1008, 494], lines: config.lines, waveAxis: "y", lightAxis: "x" };
    const initialBounds = root.getBoundingClientRect();
    let visible =
        initialBounds.bottom > 0 && initialBounds.top < (window.innerHeight || document.documentElement.clientHeight);
    let profile;
    let nodes = [];
    let preparationTask = null,
        prepareNext = null,
        preparationRevision = 0;

    function cancelPreparation() {
        preparationRevision++;
        prepareNext = null;
        if (!preparationTask) return;
        if (preparationTask.idle) window.cancelIdleCallback?.(preparationTask.id);
        else window.clearTimeout(preparationTask.id);
        preparationTask = null;
    }

    function schedulePreparation() {
        if (!prepareNext || preparationTask || !visible || suspended || document.hidden) return;
        const revision = preparationRevision;
        const run = () => {
            preparationTask = null;
            if (revision !== preparationRevision || !visible || suspended || document.hidden) return;
            prepareNext?.();
        };
        preparationTask = window.requestIdleCallback
            ? { idle: true, id: window.requestIdleCallback(run, { timeout: 120 }) }
            : { idle: false, id: window.setTimeout(run, 0) };
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    root.replaceChildren();

    // Header and desktop footer keep the authored stage. Mobile footer stretches
    // vertically with the real content, so its portrait artwork fills the whole host.
    const stage = document.createElement("div");
    stage.className = "site-pattern-stage";
    root.append(stage);

    const pattern = document.createElement("div");
    pattern.className = "site-pattern-graphic";
    pattern.setAttribute("aria-hidden", "true");
    stage.append(pattern);

    const svg = create(
        "svg",
        {
            xmlns: SVG_NS,
            viewBox: "0 0 1008 494",
            width: 1008,
            height: 494,
            "aria-hidden": "true",
            "shape-rendering": "geometricPrecision",
        },
        pattern,
    );

    const defs = create("defs", {}, svg);
    const maskGradient = create(
        "linearGradient",
        { id: `${uid}-mask-gradient`, x1: "0%", y1: "0%", x2: "100%", y2: "0%" },
        defs,
    );
    const mask = create(
        "mask",
        {
            id: `${uid}-mask`,
            maskUnits: "userSpaceOnUse",
            x: -2000,
            y: -2000,
            width: 5000,
            height: 5000,
        },
        defs,
    );
    create(
        "rect",
        {
            x: -2000,
            y: -2000,
            width: 5000,
            height: 5000,
            fill: `url(#${uid}-mask-gradient)`,
        },
        mask,
    );

    // Match the exported player: the fade gradient spans the 1008-unit pattern viewport,
    // independent from the deliberately oversized mask bounds.
    maskGradient.setAttribute("gradientUnits", "userSpaceOnUse");
    maskGradient.setAttribute("x1", 0);
    maskGradient.setAttribute("x2", 1008);

    const filter = create(
        "filter",
        {
            id: `${uid}-glow`,
            x: "-60%",
            y: "-60%",
            width: "220%",
            height: "220%",
            "color-interpolation-filters": "sRGB",
        },
        defs,
    );
    const blur = create("feGaussianBlur", { stdDeviation: 0 }, filter);
    mask.style.maskType = "alpha";
    const filtered = create("g", { mask: `url(#${uid}-mask)` }, svg);
    const normal = create("g", {}, filtered);
    const glowGroup = create("g", { filter: `url(#${uid}-glow)` }, filtered);

    const setStyles = (element, values) => {
        for (const [name, value] of Object.entries(values))
            if (element.style[name] !== String(value)) element.style[name] = value;
    };
    const setAttribute = (element, name, value) => {
        const text = String(value);
        if (element.getAttribute(name) !== text) element.setAttribute(name, text);
    };
    let fadeSignature = "";
    const setGradientStops = (gradient, stops) => {
        gradient.replaceChildren();
        [...stops]
            .sort((a, b) => a.offset - b.offset)
            .forEach((stop) =>
                create(
                    "stop",
                    {
                        offset: `${Math.max(0, Math.min(100, stop.offset))}%`,
                        "stop-color": stop.color,
                        "stop-opacity": stop.opacity,
                    },
                    gradient,
                ),
            );
    };

    const prefersReducedMotion = () => animation.respectReducedMotion && reducedMotion.matches;

    function build() {
        nodes.forEach((node) => {
            node.gradient.remove();
            node.light.remove();
            node.basePath.remove();
        });
        normal.replaceChildren();
        glowGroup.replaceChildren();

        nodes = artwork.lines.map((line, index) => {
            const gradient = create(
                "linearGradient",
                { id: `${uid}-gradient-${index}`, gradientUnits: "userSpaceOnUse" },
                defs,
            );
            setGradientStops(gradient, line.stops);

            const angle = (line.gradientAngle * Math.PI) / 180;
            const base = line.gradientBase;
            const centerX = (base.x1 + base.x2) / 2;
            const centerY = (base.y1 + base.y2) / 2;
            const deltaX = ((base.x1 - base.x2) / 2) * (line.gradientScale / 100);
            const deltaY = ((base.y1 - base.y2) / 2) * (line.gradientScale / 100);
            const shift = (line.gradientShift / 100) * (sceneWidth + 8);
            const rotatedX = deltaX * Math.cos(angle) - deltaY * Math.sin(angle);
            const rotatedY = deltaX * Math.sin(angle) + deltaY * Math.cos(angle);

            Object.entries({
                x1: centerX + rotatedX + shift,
                y1: centerY + rotatedY,
                x2: centerX - rotatedX + shift,
                y2: centerY - rotatedY,
            }).forEach(([key, value]) => gradient.setAttribute(key, value));

            const light = create(
                "linearGradient",
                {
                    id: `${uid}-light-${index}`,
                    gradientUnits: "userSpaceOnUse",
                    spreadMethod: "repeat",
                    y1: 0,
                    y2: 0,
                },
                defs,
            );

            const group = create("g", {}, normal);
            const glowWrapper = create("g", {}, glowGroup);
            const transform = `translate(${line.x} ${line.y}) translate(${sceneWidth / 2} ${sceneHeight / 2}) rotate(${line.rotation}) scale(${line.scaleX / 100} ${line.scaleY / 100}) translate(${-sceneWidth / 2} ${-sceneHeight / 2})`;

            [group, glowWrapper].forEach((item) => {
                item.setAttribute("transform", transform);
                item.style.display = line.visible ? "" : "none";
                item.setAttribute("opacity", line.opacity / 100);
            });

            // Filled artwork keeps its ribbons. Mobile footer centre lines use
            // strokes, so return edges cannot leave hooks or solid fill wedges.
            const attrs = {
                d: line.d,
                fill: artwork.strokeOnly ? "none" : `url(#${uid}-gradient-${index})`,
                stroke: `url(#${uid}-gradient-${index})`,
                "stroke-width": line.thickness,
                "stroke-linejoin": "round",
            };

            const basePath = create(
                "path",
                {
                    id: `${uid}-path-${index}`,
                    d: line.d,
                    "stroke-width": line.thickness,
                    "stroke-linejoin": "round",
                    ...(artwork.strokeOnly ? { "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" } : {}),
                },
                defs,
            );
            const normalPath = create(
                "use",
                { href: `#${uid}-path-${index}`, fill: attrs.fill, stroke: attrs.stroke },
                group,
            );
            const brightPath = create(
                "use",
                {
                    href: `#${uid}-path-${index}`,
                    fill: artwork.strokeOnly ? "none" : `url(#${uid}-light-${index})`,
                    stroke: `url(#${uid}-light-${index})`,
                },
                group,
            );
            const glowPath = create(
                "use",
                {
                    href: `#${uid}-path-${index}`,
                    fill: artwork.strokeOnly ? "none" : `url(#${uid}-light-${index})`,
                    stroke: `url(#${uid}-light-${index})`,
                },
                glowWrapper,
            );

            return {
                basePath,
                normalPath,
                brightPath,
                glowPath,
                gradient,
                light,
                group,
                glowWrapper,
                line,
                index,
            };
        });

        layout();
    }

    // Warp the curve, not its control points independently. Applying a sine to
    // every control point pinched the two edges of narrow filled ribbons. Short
    // cubic spans plus the derivative of the warp preserve their common tangent.
    function prepareMotion(node) {
        const vertical = artwork.waveAxis === "x";
        const axis = vertical ? 1 : 0;
        const raw = node.line.d.match(/[a-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
        const commands = [];
        let position = [0, 0];
        let subpathStart = position;
        const amplitude = animation.amplitude * (node.line.wave / 100) * (profile.motion / 100);
        const spanLimit = 48 / Math.max(1, animation.cycles) / Math.pow(Math.max(1, amplitude / 17.5), 0.25);
        let explicitCommands = raw.length > 0;
        for (let i = 0; i < raw.length && explicitCommands;) {
            const command = raw[i++];
            if (!["M", "L", "C", "Z"].includes(command)) {
                explicitCommands = false;
                break;
            }
            const count = command === "Z" ? 0 : command === "C" ? 6 : 2;
            if (
                raw.slice(i, i + count).length !== count ||
                raw.slice(i, i + count).some((value) => !Number.isFinite(Number(value)))
            )
                explicitCommands = false;
            i += count;
        }
        const midpoint = (a, b) => a.map((value, i) => (value + b[i]) / 2);
        function curve(a, b, c, d) {
            const along = [a[axis], b[axis], c[axis], d[axis]];
            if (Math.max(...along) - Math.min(...along) > spanLimit) {
                const ab = midpoint(a, b),
                    bc = midpoint(b, c),
                    cd = midpoint(c, d);
                const abc = midpoint(ab, bc),
                    bcd = midpoint(bc, cd),
                    middle = midpoint(abc, bcd);
                curve(a, ab, abc, middle);
                curve(middle, bcd, cd, d);
            } else commands.push({ command: "C", points: [b, c, d], anchors: [a, d, d] });
        }
        // Authored artwork uses absolute M/L/C/Z. Imported SVG commands are
        // sampled once by the browser, so relative/arcs are not misread as pairs.
        if (explicitCommands) {
            for (let i = 0; i < raw.length;) {
                const command = raw[i++];
                if (command === "Z") {
                    commands.push({ command, points: [] });
                    position = subpathStart;
                    continue;
                }
                const count = command === "C" ? 3 : 1;
                const points = Array.from({ length: count }, () => [Number(raw[i++]), Number(raw[i++])]);
                if (command === "C") curve(position, ...points);
                else commands.push({ command, points });
                position = points.at(-1);
                if (command === "M") subpathStart = position;
            }
        } else {
            const length = node.basePath.getTotalLength();
            const steps = Math.min(4096, Math.max(2, Math.ceil(length / 6)));
            for (let i = 0; i <= steps; i++) {
                const point = node.basePath.getPointAtLength((length * i) / steps);
                commands.push({ command: i ? "L" : "M", points: [[point.x, point.y]] });
            }
            if (/[zZ]\s*$/.test(node.line.d)) commands.push({ command: "Z", points: [] });
        }
        const along = commands.flatMap((item) => item.points.map((point) => point[axis]));
        const start = Math.min(...along),
            end = Math.max(...along),
            span = end - start || 1;
        function coefficients(point) {
            const u = Math.max(0, Math.min(1, (point[axis] - start) / span));
            const phase =
                u * Math.PI * 2 * animation.cycles +
                node.index * animation.phaseStep +
                (node.line.phase * Math.PI) / 180;
            const envelope = u === 0 || u === 1 ? 0 : Math.sin(Math.PI * u) * 0.5;
            const derivative = (Math.cos(Math.PI * u) * Math.PI * 0.5) / span;
            const frequency = (Math.PI * 2 * animation.cycles) / span;
            const sine = Math.sin(phase),
                cosine = Math.cos(phase);
            return {
                sine: envelope * sine,
                cosine: envelope * cosine,
                sineDerivative: derivative * sine + envelope * frequency * cosine,
                cosineDerivative: derivative * cosine - envelope * frequency * sine,
            };
        }
        node.motionTokens = commands.flatMap((item) => [
            item.command,
            ...item.points.flatMap((point, index) => {
                const anchor = item.anchors?.[index] || point;
                const coefficientsAtAnchor = coefficients(anchor),
                    distance = point[axis] - anchor[axis];
                return point.map((value, coordinate) =>
                    coordinate === axis
                        ? String(value)
                        : {
                              value,
                              sine: coefficientsAtAnchor.sine + distance * coefficientsAtAnchor.sineDerivative,
                              cosine: coefficientsAtAnchor.cosine + distance * coefficientsAtAnchor.cosineDerivative,
                          },
                );
            }),
        ]);
    }
    let motionSignature = "";
    let timelineSignature = "";

    function layout() {
        // Header switches below 640px; footer follows its independent JSON breakpoint.
        const breakpoint = root.dataset.sitePattern === "header" ? 640 : config.breakpoint;
        const profileName =
            root.clientWidth < breakpoint
                ? "mobile"
                : root.clientWidth < 1180 && config.profiles.tablet
                  ? "tablet"
                  : "desktop";
        const elapsed = currentTime();
        profile = config.profiles[profileName];
        animation = { ...config.animation, ...profile.animation };
        root.dataset.patternProfile = profileName;
        root.dataset.patternArtwork = profile.artwork || profileName;
        const nextArtwork = config.artworks?.[profile.artwork || profileName] || defaultArtwork;
        if (artwork !== nextArtwork) {
            cancelPreparation();
            svg.pauseAnimations();
            time = elapsed;
            timelineReady = false;
            timelineSignature = "";
            artwork = nextArtwork;
            sceneWidth = artwork.viewBox[2];
            sceneHeight = artwork.viewBox[3];
            svg.setAttribute("viewBox", artwork.viewBox.join(" "));
            svg.setAttribute("width", sceneWidth);
            svg.setAttribute("height", sceneHeight);
            maskGradient.setAttribute("x2", sceneWidth);
            build();
            return;
        }
        const nextMotion = [
            artwork.viewBox,
            animation.cycles,
            animation.phaseStep,
            animation.amplitude,
            profileName,
        ].join("|");
        if (motionSignature !== nextMotion) {
            nodes.forEach((node) => {
                node.motionTokens = null;
            });
            motionSignature = nextMotion;
        }
        const p = profile;
        // The stage keeps authored geometry; CSS clips the layer to the host’s dark surface.
        if (root.dataset.sitePattern === "header") {
            root.style.setProperty("--site-pattern-scene-height", `${p.height}px`);
        }

        const fillFooter = p.fillHost ?? (root.dataset.sitePattern === "footer" && profileName === "mobile");
        root.dataset.patternFit = fillFooter ? "host" : "authored";
        setStyles(stage, { height: fillFooter ? "100%" : `${p.height}px` });
        // Mobile footer is taller than the authored portrait: let the same
        // artwork span the host, including its contact/certificate/bottom rows.
        svg.style.height = fillFooter ? "100%" : "auto";
        svg.setAttribute("preserveAspectRatio", fillFooter ? "none" : "xMidYMid meet");

        setStyles(pattern, {
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.width}%`,
            height: fillFooter ? "100%" : "auto",
            maxWidth: p.maxWidth ? `${p.maxWidth}px` : "none",
            transform: `rotate(${p.rotation}deg) scale(${p.flipX ? -1 : 1}, ${p.scaleY / 100})`,
            transformOrigin: "center center",
            opacity: p.opacity / 100,
            clipPath: "none",
        });

        // The approved Y value (7.1%) is the center reference in this range.
        // Keeping Y on the graphic lets Customizer edits offset that center,
        // including after Save, while the stage follows the real backdrop.
        const centerHeader =
            root.dataset.sitePattern === "header" && root.clientWidth >= 675 && root.clientWidth <= 1180;
        const centeredTop =
            root.clientHeight / 2 - (p.height * 0.071 + parseFloat(getComputedStyle(pattern).height) / 2);
        stage.style.top = centerHeader ? `${centeredTop}px` : "0px";

        const nextFade = [p.fadeLeft, p.fadeStart, p.fadeEnd].join("|");
        if (fadeSignature !== nextFade) {
            setGradientStops(maskGradient, [
                { offset: 0, color: "#ffffff", opacity: p.fadeLeft > 0 ? 0 : 1 },
                { offset: p.fadeLeft, color: "#ffffff", opacity: 1 },
                { offset: Math.max(p.fadeLeft, p.fadeStart), color: "#ffffff", opacity: 1 },
                {
                    offset: Math.max(p.fadeStart, p.fadeEnd),
                    color: "#ffffff",
                    opacity: p.fadeEnd >= 100 && p.fadeStart === 100 ? 1 : 0,
                },
            ]);

            fadeSignature = nextFade;
        }
        setAttribute(blur, "stdDeviation", animation.glow);
        glowGroup.style.display = animation.glow > 0 ? "" : "none";
        for (const node of nodes) {
            node.glowWrapper.style.display = node.line.visible && animation.glow > 0 ? "" : "none";
            const crossAxis = artwork.lightAxis === "y" ? "x" : "y";
            setAttribute(node.light, `${crossAxis}1`, 0);
            setAttribute(node.light, `${crossAxis}2`, 0);
        }
        stabilizeStrokes();
        prepareTimeline(elapsed);
    }

    function stabilizeStrokes() {
        const minimum = animation.minStrokeWidth ?? PATTERN_RENDER_DEFAULTS.minStrokeWidth;
        root.dataset.patternMinStroke = String(minimum);
        const matrices = nodes.map((node) => node.normalPath.getScreenCTM());
        for (const [index, node] of nodes.entries()) {
            const matrix = matrices[index];
            let width = Math.max(0, node.line.thickness);
            if (artwork.strokeOnly) {
                // Non-scaling strokes keep the same CSS-pixel weight in a tall
                // portrait footer, even while the SVG stretches or waves.
                setAttribute(node.basePath, "stroke-width", Math.max(width, minimum).toFixed(4));
                continue;
            }
            if (minimum > 0 && matrix) {
                // The smallest singular scale handles rotation plus unequal
                // portrait/footer scaling. Column lengths alone miss thin edges.
                const { a, b, c, d } = matrix;
                const squared = a * a + b * b + c * c + d * d;
                const area = Math.abs(a * d - b * c);
                const largest = Math.sqrt((squared + Math.sqrt(Math.max(0, squared * squared - 4 * area * area))) / 2);
                const scale = largest > 0 ? area / largest : 0;
                if (scale > 0) width = Math.max(width, minimum / scale);
            }
            // Layout-only work: the browser owns every animation frame.
            setAttribute(node.basePath, "stroke-width", width.toFixed(4));
        }
    }

    const eased = (value) => (animation.easing === "smooth" ? value * value * (3 - 2 * value) : value);

    function currentTime() {
        return timelineReady ? svg.getCurrentTime() * clockRate : time;
    }

    function motionPath(node, phase) {
        const amplitude = animation.amplitude * (node.line.wave / 100) * (profile.motion / 100);
        const sine = Math.sin(phase),
            cosine = Math.cos(phase) - 1;
        return node.motionTokens
            .map((token) =>
                typeof token === "string"
                    ? token
                    : (token.value + amplitude * (token.sine * cosine - token.cosine * sine)).toFixed(4),
            )
            .join(" ");
    }

    // Native SVG interpolation runs at the browser's display cadence. Geometry is
    // prepared once, rather than reallocated and rewritten in a 30 FPS JS loop.
    // The closing sample is byte-identical to the first, including both ribbon edges.
    function animate(element, attributeName, values, duration, options = {}) {
        if (!(duration > 0)) return;
        return create(
            "animate",
            {
                attributeName,
                values: values.join(";"),
                dur: `${duration / clockRate}s`,
                begin: `${(options.delay || 0) / clockRate}s`,
                repeatCount: options.once ? 1 : "indefinite",
                fill: "freeze",
                calcMode: "linear",
                ...(options.keyTimes ? { keyTimes: options.keyTimes.join(";") } : {}),
            },
            element,
        );
    }

    function prepareTimeline(elapsed = currentTime()) {
        const signature = JSON.stringify([
            animation,
            profile.motion,
            profile.motionSpeed,
            profile.light,
            profile.opacity,
            artwork,
            nodes.map((node) => node.basePath.getAttribute("stroke-width")),
            selected,
            prefersReducedMotion(),
        ]);
        if (signature === timelineSignature) return;
        cancelPreparation();
        timelineReady = false;
        timelineSignature = signature;
        time = elapsed;
        svg.pauseAnimations();
        svg.querySelectorAll("animate, clipPath[data-entrance]").forEach((item) => item.remove());
        filtered.removeAttribute("clip-path");
        filtered.removeAttribute("opacity");
        svg.removeAttribute("opacity");
        clockRate = Math.max(0, animation.speed * profile.motionSpeed) || 1;
        const calm = prefersReducedMotion();
        const wave = !calm && ["wave", "combined"].includes(animation.mode);
        const lightActive = !calm && ["light", "combined"].includes(animation.mode);
        const samples = 64;
        const fractions = Array.from({ length: samples + 1 }, (_, i) => i / samples);
        const axis = artwork.lightAxis === "y" ? "y" : "x";
        const sceneSpan = Math.max(1, axis === "y" ? sceneHeight : sceneWidth);
        const span = repeatingLightSpan(sceneSpan, animation.lightWidth);
        const lightStops = repeatingLightStops(span, animation.lightWidth, animation.lightColor, animation.coreColor);
        function prepareNode(node) {
            const line = node.line;
            setAttribute(node.basePath, "d", line.d);
            if (line.visible && wave && line.wave > 0 && line.speed > 0) {
                if (!node.motionTokens) prepareMotion(node);
                const paths = fractions.map((f) => motionPath(node, f * Math.PI * 2 * animation.direction));
                paths[samples] = paths[0];
                setAttribute(node.basePath, "d", paths[0]);
                animate(node.basePath, "d", paths, animation.period / line.speed, { delay: line.delay });
            }
            const intensity = (animation.lightIntensity / 100) * (line.light / 100) * (profile.light / 100);
            const active = lightActive && line.visible && line.light > 0 && line.speed > 0;
            setAttribute(node.brightPath, "opacity", active ? intensity : 0);
            setAttribute(node.glowPath, "opacity", active && animation.glow > 0 ? intensity * 0.7 : 0);
            const emphasis = selected === null || selected === node.index ? 1 : 0.08;
            setAttribute(node.group, "opacity", (line.opacity / 100) * emphasis);
            setAttribute(node.glowWrapper, "opacity", (line.opacity / 100) * emphasis);
            if (!active) return;
            // Start with light inside the drawing. Neighbouring repeat tiles hand
            // it across the edges; no off-canvas travel creates a dark wait.
            setGradientStops(node.light, lightStops);
            const origins = fractions.map(
                (f) => -span / 4 + span * animation.lightDirection * continuousLoopProgress(f, animation.easing),
            );
            // A shorter repeat tile keeps at least one highlight in the visible
            // drawing. Scale its time too, preserving the original travel speed.
            const lightPeriod = animation.lightPeriod * (span / sceneSpan);
            const total = lightPeriod + Math.max(0, animation.lightPause);
            const keyTimes = fractions.map((f) => (f * lightPeriod) / total);
            if (animation.lightPause > 0) {
                origins.push(origins.at(-1));
                keyTimes.push(1);
            }
            for (const [name, offset] of [
                [`${axis}1`, 0],
                [`${axis}2`, span],
            ]) {
                const values = origins.map((v) => v + offset);
                setAttribute(node.light, name, values[0]);
                animate(node.light, name, values, total / line.speed, { delay: line.delay, keyTimes });
            }
        }
        function finishTimeline() {
            if (!calm && animation.pulse > 0) {
                const values = fractions.map(
                    (f) => 1 - (animation.pulse / 100) * (0.5 + 0.5 * Math.cos(f * 2 * Math.PI)),
                );
                values[samples] = values[0];
                animate(svg, "opacity", values, animation.pulsePeriod);
            }
            if (!calm && animation.entrance === "fade") {
                filtered.setAttribute("opacity", 0);
                animate(filtered, "opacity", fractions.map(eased), animation.entranceDuration, {
                    delay: animation.entranceDelay,
                    once: true,
                });
            } else if (!calm && animation.entrance === "reveal") {
                const clip = create(
                    "clipPath",
                    { id: `${uid}-entrance`, clipPathUnits: "userSpaceOnUse", "data-entrance": "" },
                    defs,
                );
                const rect = create("rect", { x: sceneWidth, y: -2000, width: 0, height: 5000 }, clip);
                animate(
                    rect,
                    "x",
                    fractions.map((f) => sceneWidth - eased(f) * (sceneWidth + 2000)),
                    animation.entranceDuration,
                    { delay: animation.entranceDelay, once: true },
                );
                animate(
                    rect,
                    "width",
                    fractions.map((f) => eased(f) * (sceneWidth + 2000)),
                    animation.entranceDuration,
                    { delay: animation.entranceDelay, once: true },
                );
                filtered.setAttribute("clip-path", `url(#${uid}-entrance)`);
            }
            timelineReady = true;
            timelineSignature = signature;
            svg.setCurrentTime(time / clockRate);
            root.dataset.patternRenderer = "native-svg";
            sync();
        }
        let index = 0;
        prepareNext = () => {
            if (index < nodes.length) prepareNode(nodes[index++]);
            if (index < nodes.length) schedulePreparation();
            else {
                prepareNext = null;
                finishTimeline();
            }
        };
        schedulePreparation();
    }

    function isAnimating() {
        return (
            timelineReady &&
            !paused &&
            !suspended &&
            !document.hidden &&
            visible &&
            !prefersReducedMotion() &&
            animation.speed > 0 &&
            profile.motionSpeed > 0 &&
            (animation.mode !== "none" ||
                animation.pulse > 0 ||
                (animation.entrance !== "none" && currentTime() < animation.entranceDelay + animation.entranceDuration))
        );
    }

    function sync() {
        if (!visible || suspended || document.hidden) {
            svg.pauseAnimations();
            return;
        }
        prepareTimeline();
        schedulePreparation();
        // Pausing the native clock preserves the exact frame on scroll/tab hiding.
        // Resuming never adds invisible wall-clock time to the next visible frame.
        if (isAnimating()) svg.unpauseAnimations();
        else svg.pauseAnimations();
    }

    // Stage/profile updates can change the header layer's own measured height.
    // Paint them in the next frame instead of writing inside ResizeObserver.
    let resizeFrame = 0;
    let measuredSize = "";
    const resizeObserver = new ResizeObserver(() => {
        if (resizeFrame) return;
        resizeFrame = requestAnimationFrame(() => {
            resizeFrame = 0;
            const size = `${root.clientWidth}|${root.clientHeight}`;
            if (size === measuredSize) return;
            measuredSize = size;
            layout();
            sync();
        });
    });
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver((entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        sync();
    });
    intersectionObserver.observe(root);

    const syncVisibility = () => sync();
    document.addEventListener("visibilitychange", syncVisibility);
    if (typeof reducedMotion.addEventListener === "function") {
        reducedMotion.addEventListener("change", syncVisibility);
    } else {
        reducedMotion.addListener?.(syncVisibility);
    }

    layout();
    sync();

    return {
        pause(value) {
            paused = Boolean(value);
            sync();
        },
        suspend(value) {
            suspended = Boolean(value);
            sync();
        },
        seek(value) {
            time = Math.max(0, Number(value) || 0);
            svg.setCurrentTime(time / clockRate);
        },
        restart() {
            this.seek(0);
            sync();
        },
        solo(index) {
            selected = index;
            sync();
        },
        get time() {
            return currentTime();
        },
        snapshot() {
            const clone = svg.cloneNode(true);
            const elapsed = currentTime();
            const sources = [...svg.querySelectorAll("*")];
            const copies = [...clone.querySelectorAll("*")];
            for (let i = 0; i < sources.length; i++) {
                const source = sources[i],
                    copy = copies[i];
                for (const name of ["x", "y", "width", "height", "x1", "x2", "y1", "y2"])
                    if (source[name]?.animVal?.value !== undefined) copy.setAttribute(name, source[name].animVal.value);
                if (source.querySelector(':scope > animate[attributeName="opacity"]'))
                    copy.setAttribute("opacity", getComputedStyle(source).opacity);
            }
            nodes.forEach((node) => {
                if (!prefersReducedMotion() && ["wave", "combined"].includes(animation.mode) && node.line.wave > 0) {
                    if (!node.motionTokens) prepareMotion(node);
                    clone
                        .querySelector(`[id="${node.basePath.id}"]`)
                        .setAttribute(
                            "d",
                            motionPath(
                                node,
                                (Math.max(0, elapsed - node.line.delay) *
                                    node.line.speed *
                                    2 *
                                    Math.PI *
                                    animation.direction) /
                                    animation.period,
                            ),
                        );
                }
            });
            clone.querySelectorAll("animate").forEach((item) => item.remove());
            clone.setAttribute(
                "style",
                `opacity:${Number(pattern.style.opacity) * Number(getComputedStyle(svg).opacity)}`,
            );
            return new XMLSerializer().serializeToString(clone);
        },
        destroy() {
            cancelPreparation();
            cancelAnimationFrame(resizeFrame);
            resizeObserver.disconnect();
            intersectionObserver.disconnect();
            document.removeEventListener("visibilitychange", syncVisibility);
            if (typeof reducedMotion.removeEventListener === "function") {
                reducedMotion.removeEventListener("change", syncVisibility);
            } else {
                reducedMotion.removeListener?.(syncVisibility);
            }
            root.replaceChildren();
        },
    };
}

function createPatternLayer(kind) {
    const root = document.createElement("div");
    root.className = `site-pattern-layer site-pattern-layer--${kind}`;
    root.dataset.sitePattern = kind;
    root.setAttribute("aria-hidden", "true");
    return root;
}

// Hidden footer artwork is not parsed or sampled during the initial page load.
function registerPattern(host, kind) {
    host.classList.add("site-pattern-host");
    const root = createPatternLayer(kind);
    host.prepend(root);
    const entry = { root, source: null, config: "", player: null, paused: false, loading: false };
    mountedPatterns.set(kind, entry);
    const mount = async () => {
        if (entry.player || entry.loading) return;
        entry.loading = true;
        const loaded = await patternLoaders[kind]();
        // A live preview received during loading takes precedence.
        entry.source ||= loaded;
        entry.config = JSON.stringify(entry.source);
        entry.player = mountPattern(root, entry.source);
        entry.player.pause(entry.paused);
        entry.player.suspend(productBusy);
    };
    if (typeof IntersectionObserver === "function") {
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((item) => item.isIntersecting)) return;
                observer.disconnect();
                mount().catch((error) => console.warn("Pattern initialization failed", error));
            },
            { rootMargin: "160px" },
        );
        observer.observe(host);
    } else mount().catch((error) => console.warn("Pattern initialization failed", error));
}

export function initSitePatterns() {
    const page = document.body.dataset.page;
    const products = document.querySelector("[data-products-page]");
    if (products && !linkedProducts.has(products)) {
        linkedProducts.add(products);
        productBusy = Boolean(products.__productMotion?.getState().busy);
        products.addEventListener("product-motion:busy", (event) => {
            productBusy = Boolean(event.detail?.busy);
            for (const entry of mountedPatterns.values()) entry.player?.suspend(productBusy);
        });
    }

    // Home has its own image-led hero and intentionally does not use the shared
    // header pattern. Every internal page, including Contact, mounts it once.
    if (page !== "home") {
        const header = document.querySelector(".site-header");
        const headerHost = document.querySelector("[data-site-hero]") || header?.parentElement;
        if (headerHost && !headerHost.querySelector(":scope > [data-site-pattern='header']")) {
            registerPattern(headerHost, "header");
        }
    }

    const footer = document.querySelector(".site-footer");
    if (footer && !footer.querySelector(":scope > [data-site-pattern='footer']")) {
        // Desktop placement and the mobile portrait artwork come from the footer export.
        registerPattern(footer, "footer");
    }
    if (!previewListener && import.meta.env.MODE !== "backend") {
        previewListener = true;
        window.addEventListener("site:pattern-preview", (event) => {
            for (const [kind, entry] of mountedPatterns) {
                if (!event.detail?.[kind]) continue;
                const config = normalizePattern(event.detail[kind]);
                const signature = JSON.stringify(config);
                if (signature !== entry.config) {
                    entry.source = config;
                    if (entry.player) {
                        const time = entry.player.time;
                        entry.player.destroy();
                        entry.player = mountPattern(entry.root, config, time);
                        entry.player.suspend(productBusy);
                    }
                    entry.config = signature;
                }
                entry.paused = Boolean(event.detail.paused);
                entry.player?.pause(entry.paused);
            }
        });
    }
}
