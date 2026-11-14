/* Marpich Product Motion 2.0.0 — dependency-free ES module.
 * Enhances the existing featured-products mosaic; the page's original CSS,
 * real images, product links and grid/list controls remain in use.
 */
export const MOTION_DEFAULTS = Object.freeze({
    enabled: true,
    sharedImage: true,
    autoScroll: true,
    openDuration: 620,
    closeDuration: 600,
    openDelay: 60,
    siblingsFade: 180,
    contentDelay: 200,
    contentDuration: 320,
    productsDelay: 390,
    productDuration: 420,
    stagger: 55,
    distance: 22,
    easing: "glide",
    entry: "up",
    sequence: "forward",
    heroHeight: 300,
    heroRadius: 14,
    opening: "top-right",
    cornerTravel: 24,
    closing: "direct",
    closeEasing: "smooth",
    returnHandoff: 24,
    gridReturnDelay: 60,
    gridReturnDuration: 180,
    gridReturnStagger: 16,
    productsReturnDelay: 60,
});
export const MOTION_LIMITS = Object.freeze({
    openDuration: [200, 1600],
    closeDuration: [150, 1400],
    openDelay: [0, 350],
    siblingsFade: [40, 500],
    contentDelay: [0, 700],
    contentDuration: [100, 800],
    productsDelay: [0, 1100],
    productDuration: [100, 1000],
    stagger: [0, 160],
    distance: [0, 65],
    heroHeight: [220, 440],
    heroRadius: [8, 24],
    cornerTravel: [0, 50],
    returnHandoff: [10, 40],
    gridReturnDelay: [0, 90],
    gridReturnDuration: [80, 500],
    gridReturnStagger: [0, 70],
    productsReturnDelay: [0, 500],
});
export const MOTION_EASINGS = Object.freeze({
    glide: "cubic-bezier(.22,1,.36,1)",
    smooth: "cubic-bezier(.4,0,.2,1)",
    gentle: "cubic-bezier(.16,1,.3,1)",
    linear: "linear",
});
export const MOTION_PRESETS = Object.freeze({
    balanced: { ...MOTION_DEFAULTS },
    quick: {
        ...MOTION_DEFAULTS,
        openDuration: 380,
        closeDuration: 300,
        openDelay: 25,
        siblingsFade: 115,
        contentDelay: 105,
        contentDuration: 235,
        productsDelay: 230,
        productDuration: 290,
        stagger: 35,
        distance: 14,
    },
    showcase: {
        ...MOTION_DEFAULTS,
        openDuration: 880,
        closeDuration: 670,
        openDelay: 90,
        siblingsFade: 240,
        contentDelay: 310,
        contentDuration: 450,
        productsDelay: 590,
        productDuration: 580,
        stagger: 80,
        distance: 32,
        easing: "gentle",
    },
    quiet: {
        ...MOTION_DEFAULTS,
        openDuration: 420,
        closeDuration: 330,
        openDelay: 0,
        siblingsFade: 110,
        contentDelay: 90,
        contentDuration: 220,
        productsDelay: 260,
        productDuration: 280,
        stagger: 20,
        distance: 0,
        entry: "fade",
        sharedImage: false,
    },
});

export function normalizeMotionConfig(input = {}) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const result = { ...MOTION_DEFAULTS };
    for (const [name, limits] of Object.entries(MOTION_LIMITS)) {
        const raw = source[name];
        const numeric = typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "");
        const value = numeric ? Number(raw) : NaN;
        if (Number.isFinite(value)) {
            result[name] = Math.round(Math.min(limits[1], Math.max(limits[0], value)));
        }
    }
    for (const key of ["enabled", "sharedImage", "autoScroll"]) {
        if (typeof source[key] === "boolean") result[key] = source[key];
    }
    if (typeof source.easing === "string" && Object.hasOwn(MOTION_EASINGS, source.easing))
        result.easing = source.easing;
    if (typeof source.closeEasing === "string" && Object.hasOwn(MOTION_EASINGS, source.closeEasing))
        result.closeEasing = source.closeEasing;
    if (["up", "right", "zoom", "fade"].includes(source.entry)) result.entry = source.entry;
    if (["forward", "reverse", "center"].includes(source.sequence)) result.sequence = source.sequence;
    if (["top-right", "morph"].includes(source.opening)) result.opening = source.opening;
    if (["direct", "corner"].includes(source.closing)) result.closing = source.closing;
    return result;
}

function rightGeometry(rect, base) {
    return {
        right: base.right - rect.right + "px",
        top: rect.top - base.top + "px",
        width: rect.width + "px",
        height: rect.height + "px",
    };
}

// Animate disposable layers on the compositor. Their fixed layout rectangle
// never changes per frame; compensated radii retain the intended corner size.
export function compositorFrames(frames, initial) {
    const width = Number.parseFloat(initial.width),
        height = Number.parseFloat(initial.height);
    if (!(width > 0 && height > 0)) return frames;
    const right = Boolean(initial.right) && initial.right !== "auto";
    const x = Number.parseFloat(right ? initial.right : initial.left) || 0;
    const y = Number.parseFloat(initial.top) || 0;
    return frames.map((frame) => {
        const { left, top, width: nextWidth, height: nextHeight, right: nextRight, ...other } = frame;
        const sx = nextWidth === undefined ? 1 : Number.parseFloat(nextWidth) / width;
        const sy = nextHeight === undefined ? 1 : Number.parseFloat(nextHeight) / height;
        const dx = right
            ? x - (nextRight === undefined ? x : Number.parseFloat(nextRight))
            : (left === undefined ? x : Number.parseFloat(left)) - x;
        const dy = (top === undefined ? y : Number.parseFloat(top)) - y;
        if (other.borderRadius && /^[\d.]+px$/.test(other.borderRadius)) {
            const radius = Number.parseFloat(other.borderRadius);
            other.borderRadius = `${radius / sx}px / ${radius / sy}px`;
        }
        return { ...other, transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` };
    });
}

function productStartDelay(config, closing) {
    return closing
        ? Math.min(config.productsDelay, Math.round(config.closeDuration * (1 - config.returnHandoff / 100))) +
              config.productsReturnDelay
        : config.productsDelay;
}

// Move the intact source card to the destination's upper-right corner first.
// During stretching, physical right/top remain fixed; only width/height change.
// Closing performs the same path in reverse, including cards from lower rows.
export function cornerStretchPlan(from, to, base, config = {}, closing = false) {
    const cfg = normalizeMotionConfig(config),
        corner = closing ? from : to,
        size = closing ? to : from;
    const anchor = { right: corner.right, top: corner.top, width: size.width, height: size.height };
    anchor.left = anchor.right - anchor.width;
    anchor.bottom = anchor.top + anchor.height;
    const travels = Math.abs(from.right - to.right) > 1 || Math.abs(from.top - to.top) > 1;
    const offset = travels ? (closing ? 1 - cfg.cornerTravel / 100 : cfg.cornerTravel / 100) : closing ? 1 : 0;
    const frame = (rect, offset) => ({ ...rightGeometry(rect, base), offset, easing: MOTION_EASINGS[cfg.easing] });
    const frames = travels ? [frame(from, 0), frame(anchor, offset), frame(to, 1)] : [frame(from, 0), frame(to, 1)];
    return { frames, anchor, offset, travels };
}

export function productEntryFrames(config) {
    const c = normalizeMotionConfig(config);
    const transform =
        c.entry === "right"
            ? "translateX(" + c.distance + "px)"
            : c.entry === "zoom"
              ? "scale(.965)"
              : c.entry === "fade"
                ? "none"
                : "translateY(" + c.distance + "px)";
    return [
        { opacity: 0, transform },
        { opacity: 1, transform: "none" },
    ];
}

export function entryRanks(count, sequence = "forward") {
    const order = Array.from({ length: count }, (_, i) => i);
    if (sequence === "reverse") order.reverse();
    if (sequence === "center")
        order.sort((a, b) => Math.abs(a - (count - 1) / 2) - Math.abs(b - (count - 1) / 2) || a - b);
    const ranks = [];
    order.forEach((index, rank) => {
        ranks[index] = rank;
    });
    return ranks;
}

export function motionTimeline(config, count = 4, closing = false) {
    const c = normalizeMotionConfig(config);
    const opening = !closing;
    const duration = opening ? c.openDuration : c.closeDuration;
    const delay = opening ? c.openDelay : 0;
    const productDelay = productStartDelay(c, closing);
    const phases = [
        {
            key: "siblings",
            start: opening ? 0 : (duration * c.gridReturnDelay) / 100,
            end: opening
                ? c.siblingsFade + 40
                : (duration * c.gridReturnDelay) / 100 + c.gridReturnDuration + 4 * c.gridReturnStagger,
        },
        { key: "surface", start: delay, end: delay + duration },
        {
            key: "content",
            start: opening ? c.contentDelay : 0,
            end: opening ? c.contentDelay + c.contentDuration : Math.round(duration * 0.45),
        },
        // A large catalogue must not make the last product wait several seconds.
        {
            key: "products",
            start: productDelay,
            end: productDelay + c.productDuration + Math.min(5, Math.max(0, count - 1)) * c.stagger,
        },
    ];
    return { phases, total: Math.max(...phases.map((p) => p.end)), count, closing };
}

// Latest request wins; no overlapping DOM transitions. Invalid requests leave
// the requested state unchanged. Replay deliberately waits for each phase.
export function createMotionController({ isValid, transition, onBusy, onIdle, onError }) {
    let current = null,
        desired = null,
        busy = false;
    let task = Promise.resolve();
    function request(id) {
        if (id !== null && !isValid(id)) return task;
        desired = id;
        if (busy || desired === current) return task;
        busy = true;
        onBusy?.(true);
        task = (async () => {
            try {
                while (desired !== current) {
                    const next = desired;
                    await transition(current, next);
                    current = next;
                }
            } catch (error) {
                desired = current;
                onError?.(error);
                throw error;
            } finally {
                busy = false;
                onBusy?.(false);
                onIdle?.(current);
            }
        })();
        return task;
    }
    return {
        request,
        whenIdle: () => task,
        snapshot: () => ({ current, desired, busy }),
        async replay(id) {
            if (!isValid(id)) return task;
            await request(null);
            return request(id);
        },
    };
}

let instanceSequence = 0;

export function initProductCategoryMotion(root, options = {}) {
    if (!root) throw new Error("Product Motion: a page root is required.");
    if (root.__productMotion) return root.__productMotion;
    const doc = root.ownerDocument,
        win = doc.defaultView;
    const grid = root.querySelector(options.gridSelector || ".featured-products");
    const results = root.querySelector(options.productsSelector || "[data-product-grid], .products-grid");
    if (!grid || !results) throw new Error("Product Motion: featured-products and products-grid must exist.");
    const cards = Array.from(grid.children).filter((card) => card.matches(".featured-card"));
    if (!cards.length) throw new Error("Product Motion: no featured cards were found.");
    const abort = new win.AbortController();
    const prefix = "pcm-" + ++instanceSequence;
    const reduce = win.matchMedia("(prefers-reduced-motion: reduce)");
    let config = normalizeMotionConfig(options.config);
    let active = null,
        lastSelected = null,
        disposed = false;
    const groups = new Set();
    let playback = { rate: 1, paused: false };
    let scrollRevision = 0;
    const sourceGridStyle = grid.getAttribute("style");
    const sourceGridId = grid.getAttribute("id");
    const originalProducts = Array.from(results.querySelectorAll(".product-card"));
    const initialProductVisibility = new Map(originalProducts.map((card) => [card, card.hidden]));
    const productMemberships = new Map(
        originalProducts.map((card) => [
            card,
            new Set((card.dataset.pcmCategories || card.dataset.pcmCategory || "").split(/\s+/)),
        ]),
    );
    const title = root.querySelector(
        options.catalogTitleSelector || "#all-products-title, #catalog-title, .catalog-head .section-heading",
    );
    const initialTitle = title?.textContent || "همه محصولات";
    const more = root.querySelector(".catalog-more");
    const initialMoreHidden = more?.hidden || false;
    const initialResultsBusy = results.getAttribute("aria-busy");
    const categoryInfo = new Map();
    const addedButtons = [];
    const buttonStates = new Map();

    function element(tag, className, text) {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function setHidden(node, hidden) {
        node.hidden = hidden;
    }
    function restoreStyle(node, original) {
        if (original === null) node.removeAttribute("style");
        else node.setAttribute("style", original);
    }
    function emit(name, detail) {
        const event = { ...detail };
        try {
            options.onEvent?.(name, event);
        } catch (_) {
            /* Observer errors must not interrupt layout cleanup. */
        }
        root.dispatchEvent(new win.CustomEvent("product-motion:" + name, { detail: event }));
    }
    function canAnimate() {
        return config.enabled && !reduce.matches;
    }
    function applyAppearance() {
        root.style.setProperty("--pcm-height", config.heroHeight + "px");
        root.style.setProperty("--pcm-radius", config.heroRadius + "px");
    }
    root.classList.add("pcm-root");
    results.classList.add("pcm-results");
    applyAppearance();

    const toolbar = element("div", "pcm-toolbar");
    const toolbarTitle = element("h2", "pcm-toolbar__title", "دسته‌بندی محصولات");
    const hint = element("span", "pcm-toolbar__hint", "دسته موردنظر را انتخاب کنید");
    const back = element("button", "pcm-back");
    const backIcon = element("i", "pcm-icon fa-solid fa-arrow-left");
    backIcon.setAttribute("aria-hidden", "true");
    back.type = "button";
    back.append(backIcon);
    back.hidden = true;
    back.setAttribute("aria-label", "برگشت به دسته‌بندی‌ها");
    back.setAttribute("title", "برگشت به دسته‌بندی‌ها");
    toolbar.append(toolbarTitle, hint, back);
    const stage = element("div", "pcm-stage");
    grid.parentNode.insertBefore(toolbar, grid);
    grid.parentNode.insertBefore(stage, grid);
    stage.append(grid);
    // A production page can keep its original vertical rhythm: the return
    // control occupies the expanded card only, never a new row above the grid.
    const overlayToolbar = options.toolbar === "overlay";
    if (overlayToolbar) {
        toolbar.classList.add("pcm-toolbar--overlay");
        toolbar.hidden = true;
        stage.append(toolbar);
    }

    const expanded = element("article", "pcm-expanded");
    expanded.id = prefix + "-expanded";
    expanded.hidden = true;
    const copy = element("div", "pcm-expanded__copy");
    const heading = element("h3", "pcm-expanded__title");
    heading.id = prefix + "-title";
    const description = element("p", "pcm-expanded__description site-prose");
    copy.append(heading, description);
    const visual = element("div", "pcm-expanded__visual");
    const image = element("img", "pcm-expanded__image");
    image.alt = "";
    visual.append(image);
    expanded.append(copy, visual);
    expanded.setAttribute("aria-labelledby", heading.id);
    stage.append(expanded);
    const empty = element("p", "pcm-empty", "محصولی برای این دسته ثبت نشده است.");
    empty.hidden = true;
    results.parentNode.insertBefore(empty, results.nextSibling);
    const status = element("p", "pcm-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    root.append(status);
    if (!grid.id) grid.id = prefix + "-grid";
    back.setAttribute("aria-controls", grid.id);

    cards.forEach((card, index) => {
        const inferred = Array.from(card.classList)
            .find((name) => name.startsWith("featured-card--"))
            ?.slice(15);
        const id = card.dataset.pcmCategory || card.dataset.category || inferred || "category-" + index;
        if (categoryInfo.has(id)) throw new Error("Product Motion: category IDs must be unique.");
        const sourceImage = card.querySelector(".featured-card__image, img");
        const sourceTitle = card.querySelector(".featured-card__title, h2, h3");
        const sourceDescription = card.querySelector(".featured-card__description");
        const metadata = options.categories?.find((category) => category.id === id) || {};
        categoryInfo.set(id, {
            id,
            card,
            sourceImage,
            sourceTitle,
            sourceDescription,
            title: metadata.title || sourceTitle?.textContent.trim() || id,
            description: metadata.description || sourceDescription?.textContent.trim() || "",
        });
        let button = card.querySelector("button.featured-card__select");
        if (!button) {
            button = element("button", "pcm-select");
            button.type = "button";
            card.append(button);
            addedButtons.push(button);
        }
        buttonStates.set(button, {
            expanded: button.getAttribute("aria-expanded"),
            controls: button.getAttribute("aria-controls"),
            label: button.getAttribute("aria-label"),
            key: button.getAttribute("data-pcm-select"),
        });
        button.dataset.pcmSelect = id;
        button.setAttribute("aria-label", "انتخاب " + categoryInfo.get(id).title);
        button.setAttribute("aria-controls", expanded.id);
        button.setAttribute("aria-expanded", "false");
    });

    function renderExpanded(info) {
        heading.textContent = info.title;
        description.textContent = info.description;
        image.src = info.sourceImage?.currentSrc || info.sourceImage?.src || "";
        image.alt = info.sourceImage?.alt || info.title;
        expanded.dataset.category = info.id;
    }

    function group(cfg) {
        const animations = [],
            promises = [];
        const animate = cfg.enabled && !reduce.matches;
        const object = {
            add(node, frames, duration, delay = 0, easing = MOTION_EASINGS[cfg.easing]) {
                if (!node || !animate || !node.animate) return;
                if (
                    node.matches(".pcm-image-ghost, .pcm-surface, .pcm-copy-ghost") &&
                    frames.some((frame) =>
                        ["left", "right", "top", "width", "height"].some((key) => frame[key] !== undefined),
                    )
                ) {
                    const initial = {
                        left: node.style.left,
                        right: node.style.right,
                        top: node.style.top,
                        width: node.style.width,
                        height: node.style.height,
                    };
                    node.style.transformOrigin = initial.right && initial.right !== "auto" ? "100% 0" : "0 0";
                    node.style.willChange = "transform";
                    frames = compositorFrames(frames, initial);
                }
                const effect = node.animate(frames, { duration, delay, easing, fill: "both" });
                effect.playbackRate = playback.rate;
                if (playback.paused) effect.pause?.();
                animations.push(effect);
                promises.push(effect.finished.catch(() => {}));
            },
            setPlayback() {
                for (const effect of animations) {
                    if (effect.playState === "finished" || effect.playState === "idle") continue;
                    if (effect.updatePlaybackRate) effect.updatePlaybackRate(playback.rate);
                    else effect.playbackRate = playback.rate;
                    if (playback.paused) effect.pause?.();
                    else effect.play?.();
                }
            },
            wait: () => Promise.all(promises),
            clear() {
                animations.forEach((effect) => effect.cancel());
                groups.delete(object);
            },
            cancel() {
                animations.forEach((effect) => effect.cancel());
            },
        };
        groups.add(object);
        return object;
    }

    function geometry(rect, base) {
        return {
            left: rect.left - base.left + "px",
            top: rect.top - base.top + "px",
            width: rect.width + "px",
            height: rect.height + "px",
        };
    }
    function paintedImageRect(source, reference = source) {
        const rect = source.getBoundingClientRect();
        if (!reference?.naturalWidth || !reference.naturalHeight) return rect;
        // Featured/expanded images both use contain at center. Moving their
        // actual painted bounds keeps the bitmap's natural aspect ratio intact.
        const scale = Math.min(rect.width / reference.naturalWidth, rect.height / reference.naturalHeight);
        const width = reference.naturalWidth * scale,
            height = reference.naturalHeight * scale;
        const left = rect.left + (rect.width - width) / 2,
            top = rect.top + (rect.height - height) / 2;
        return { left, top, right: left + width, bottom: top + height, width, height };
    }
    function surface(source, first, base) {
        const node = element("div", "pcm-surface");
        node.setAttribute("aria-hidden", "true");
        Object.assign(node.style, geometry(first, base));
        const background = win.getComputedStyle(source).backgroundColor;
        node.style.boxShadow = win.getComputedStyle(source).boxShadow;
        node.style.backgroundColor =
            !background || background === "transparent" || /,\s*0\)$/.test(background) ? "#f8faff" : background;
        stage.append(node);
        return node;
    }
    function imageGhost(source, first, base) {
        if (!source || first.width < 1 || first.height < 1) return null;
        const ghost = element("img", "pcm-image-ghost");
        ghost.src = source.currentSrc || source.src;
        ghost.alt = "";
        ghost.setAttribute("aria-hidden", "true");
        ghost.draggable = false;
        Object.assign(ghost.style, geometry(first, base));
        stage.append(ghost);
        return ghost;
    }
    function copyGhost(card, first, base) {
        const clone = card.cloneNode(true);
        clone.removeAttribute("id");
        clone.removeAttribute("style");
        clone.classList.remove("pcm-source-hidden", "pcm-morphing");
        clone.classList.add("pcm-copy-ghost");
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true;
        clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
        clone.querySelectorAll("img, button").forEach((node) => node.remove());
        // Existing page rules may position featured cards with stronger CSS
        // selectors. Geometry belongs to this temporary animation layer.
        Object.assign(clone.style, geometry(first, base), {
            position: "absolute",
            transform: "none",
            transition: "none",
        });
        stage.append(clone);
        return clone;
    }
    function categoryScrollTarget() {
        const target = options.scrollTarget?.(stage);
        return Number.isFinite(target) ? target : win.scrollY + stage.getBoundingClientRect().top - 20;
    }
    function scrollToPosition(target, duration, cfg) {
        if (!cfg.autoScroll) return Promise.resolve();
        const start = win.scrollY,
            revision = ++scrollRevision;
        target = Math.max(0, target);
        if (Math.abs(start - target) < 2) return Promise.resolve();
        // The page uses scroll-behavior:smooth for native anchors. Each frame
        // here must be immediate so a second browser scroll does not lag behind.
        const moveTo = (top) => win.scrollTo({ left: win.scrollX || 0, top, behavior: "instant" });
        if (!cfg.enabled || reduce.matches) {
            moveTo(target);
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            let previous,
                elapsed = 0;
            const tick = (now) => {
                if (revision !== scrollRevision) return resolve();
                if (previous !== undefined && !playback.paused) elapsed += Math.max(0, now - previous) * playback.rate;
                previous = now;
                const t = Math.min(1, elapsed / Math.max(1, duration));
                moveTo(start + (target - start) * (1 - Math.pow(1 - t, 3)));
                if (t === 1) resolve();
                else win.requestAnimationFrame(tick);
            };
            win.requestAnimationFrame(tick);
        });
    }

    async function changeProducts(id, cfg, closing = false) {
        const delay = productStartDelay(cfg, closing);
        const outgoingDuration = Math.min(120, delay);
        const outgoing = group(cfg);
        outgoing.add(
            results,
            [{ opacity: 1 }, { opacity: 0, transform: "translateY(6px)" }],
            outgoingDuration,
            0,
            "ease",
        );
        await outgoing.wait();
        let visibleCount;
        try {
            if (options.onFilter) visibleCount = await options.onFilter(id);
            else {
                originalProducts.forEach((card) => {
                    card.hidden =
                        initialProductVisibility.get(card) || Boolean(id && !productMemberships.get(card).has(id));
                });
                visibleCount = originalProducts.filter((card) => !card.hidden).length;
            }
            empty.textContent = "محصولی برای این دسته ثبت نشده است.";
            empty.hidden = Number(visibleCount) !== 0;
        } catch (error) {
            empty.textContent = "نمایش محصولات انجام نشد. دوباره این دسته را انتخاب کنید.";
            empty.hidden = false;
            emit("error", { message: error.message });
        } finally {
            outgoing.clear();
        }
        if (title) title.textContent = id ? "محصولات مرتبط · " + categoryInfo.get(id).title : initialTitle;
        if (more && !options.onFilter) more.hidden = id ? true : initialMoreHidden;
        const visible = (
            options.onFilter ? Array.from(results.querySelectorAll(".product-card")) : originalProducts
        ).filter((card) => !card.hidden);
        const ranks = entryRanks(visible.length, cfg.sequence);
        const incoming = group(cfg);
        incoming.add(
            results,
            [{ opacity: 0 }, { opacity: 1 }],
            Math.min(300, cfg.productDuration),
            Math.max(0, delay - outgoingDuration),
        );
        const entryFrames = productEntryFrames(cfg);
        visible.forEach((card, index) =>
            incoming.add(
                card,
                entryFrames,
                cfg.productDuration,
                Math.max(0, delay - outgoingDuration) + Math.min(5, ranks[index]) * cfg.stagger,
            ),
        );
        await incoming.wait();
        incoming.clear();
        return visible.length;
    }

    async function open(id) {
        const cfg = { ...config },
            info = categoryInfo.get(id);
        lastSelected = id;
        active = id;
        root.dataset.pcmState = "opening";
        const base = stage.getBoundingClientRect(),
            first = info.card.getBoundingClientRect();
        const gridHeight = grid.getBoundingClientRect().height;
        const firstImage = info.sourceImage ? paintedImageRect(info.sourceImage) : null;
        const sourceImageStyle = info.sourceImage?.getAttribute("style") ?? null;
        renderExpanded(info);
        const shell = surface(info.card, first, base);
        const oldCopy = copyGhost(info.card, first, base);
        const photo = cfg.sharedImage && firstImage ? imageGhost(info.sourceImage, firstImage, base) : null;
        stage.style.height = gridHeight + "px";
        Object.assign(grid.style, {
            position: "absolute",
            left: "0",
            top: "0",
            width: "100%",
            height: gridHeight + "px",
        });
        grid.inert = true;
        info.card.classList.add("pcm-source-hidden");
        info.card.querySelector("[data-pcm-select]").setAttribute("aria-expanded", "true");
        expanded.hidden = false;
        const expandedBackground = win.getComputedStyle(expanded).backgroundColor;
        const expandedShadow = win.getComputedStyle(expanded).boxShadow;
        expanded.classList.add("pcm-morphing");
        hint.hidden = true;
        const last = expanded.getBoundingClientRect(),
            lastImage = paintedImageRect(image, info.sourceImage);
        if (photo) image.style.visibility = "hidden";
        const motion = group(cfg);
        const corner = cfg.opening === "top-right" ? cornerStretchPlan(first, last, base, cfg) : null;
        if (corner)
            motion.add(
                stage,
                corner.frames.map((frame, index) => ({
                    height: (index === corner.frames.length - 1 ? last.height : gridHeight) + "px",
                    offset: frame.offset,
                    easing: frame.easing,
                })),
                cfg.openDuration,
                cfg.openDelay,
                "linear",
            );
        else
            motion.add(
                stage,
                [{ height: gridHeight + "px" }, { height: last.height + "px" }],
                cfg.openDuration,
                cfg.openDelay,
            );
        if (corner) {
            const sourceRadius = win.getComputedStyle(info.card).borderRadius;
            Object.assign(shell.style, rightGeometry(first, base), { left: "auto", transformOrigin: "top right" });
            const frames = corner.frames.map((frame, index) => ({
                ...frame,
                borderRadius: index === corner.frames.length - 1 ? cfg.heroRadius + "px" : sourceRadius,
                backgroundColor: index === corner.frames.length - 1 ? expandedBackground : shell.style.backgroundColor,
                boxShadow: index === corner.frames.length - 1 ? expandedShadow : shell.style.boxShadow,
            }));
            motion.add(shell, frames, cfg.openDuration, cfg.openDelay, "linear");
            Object.assign(oldCopy.style, rightGeometry(first, base), { left: "auto" });
            motion.add(
                oldCopy,
                corner.frames.map((frame, index) => ({
                    ...rightGeometry(index === 0 ? first : corner.anchor, base),
                    offset: frame.offset,
                    easing: frame.easing,
                })),
                cfg.openDuration,
                cfg.openDelay,
                "linear",
            );
            const crop =
                "inset(0px 0px " +
                Math.max(0, last.height - first.height) +
                "px " +
                Math.max(0, last.width - first.width) +
                "px round " +
                cfg.heroRadius +
                "px)";
            motion.add(
                expanded,
                corner.frames.map((frame, index) => ({
                    clipPath:
                        index === corner.frames.length - 1
                            ? "inset(0px 0px 0px 0px round " + cfg.heroRadius + "px)"
                            : crop,
                    opacity: index === corner.frames.length - 1 ? 1 : 0,
                    offset: frame.offset,
                    easing: frame.easing,
                })),
                cfg.openDuration,
                cfg.openDelay,
                "linear",
            );
        } else
            motion.add(
                shell,
                [
                    {
                        ...geometry(first, base),
                        borderRadius: win.getComputedStyle(info.card).borderRadius,
                        backgroundColor: shell.style.backgroundColor,
                        boxShadow: shell.style.boxShadow,
                    },
                    {
                        ...geometry(last, base),
                        borderRadius: cfg.heroRadius + "px",
                        backgroundColor: expandedBackground,
                        boxShadow: expandedShadow,
                    },
                ],
                cfg.openDuration,
                cfg.openDelay,
            );
        motion.add(
            oldCopy,
            [{ opacity: 1 }, { opacity: 0, ...(!corner ? { transform: "translateY(-5px)" } : {}) }],
            Math.min(cfg.siblingsFade, Math.max(60, cfg.contentDelay)),
            0,
            "ease",
        );
        if (photo && corner) {
            const anchorImage = {
                width: firstImage.width,
                height: firstImage.height,
                right: firstImage.right + corner.anchor.right - first.right,
                top: firstImage.top + corner.anchor.top - first.top,
            };
            Object.assign(photo.style, rightGeometry(firstImage, base), { left: "auto", transformOrigin: "top right" });
            motion.add(
                photo,
                corner.frames.map((frame, index) => ({
                    ...rightGeometry(
                        index === 0 ? firstImage : index === corner.frames.length - 1 ? lastImage : anchorImage,
                        base,
                    ),
                    offset: frame.offset,
                    easing: frame.easing,
                })),
                cfg.openDuration,
                cfg.openDelay,
                "linear",
            );
        } else if (photo)
            motion.add(photo, [geometry(firstImage, base), geometry(lastImage, base)], cfg.openDuration, cfg.openDelay);
        else
            motion.add(
                visual,
                [
                    { opacity: 0, transform: "translateX(-16px)" },
                    { opacity: 1, transform: "none" },
                ],
                cfg.contentDuration,
                cfg.contentDelay,
            );
        cards
            .filter((card) => card !== info.card)
            .forEach((card, index) =>
                motion.add(
                    card,
                    [{ opacity: 1 }, { opacity: 0, transform: "translateY(8px)" }],
                    cfg.siblingsFade,
                    Math.min(40, index * 10),
                    "ease",
                ),
            );
        motion.add(
            copy,
            [
                { opacity: 0, transform: "translateY(12px)" },
                { opacity: 1, transform: "none" },
            ],
            cfg.contentDuration,
            cfg.contentDelay,
        );
        emit("start", {
            categoryId: id,
            closing: false,
            config: cfg,
            timeline: motionTimeline(cfg, 4),
            reduced: !canAnimate(),
        });
        const productsTask = changeProducts(id, cfg);
        try {
            await Promise.all([
                motion.wait(),
                scrollToPosition(categoryScrollTarget(), cfg.openDuration + cfg.openDelay, cfg),
            ]);
        } finally {
            grid.hidden = true;
            grid.inert = false;
            restoreStyle(grid, sourceGridStyle);
            info.card.classList.remove("pcm-source-hidden");
            expanded.classList.remove("pcm-morphing");
            image.style.removeProperty("visibility");
            if (info.sourceImage) restoreStyle(info.sourceImage, sourceImageStyle);
            stage.style.removeProperty("height");
            shell.remove();
            oldCopy.remove();
            photo?.remove();
            motion.clear();
        }
        const count = await productsTask;
        root.dataset.pcmState = "selected";
        status.textContent = info.title + " انتخاب شد؛ " + count + " محصول مرتبط نمایش داده می‌شود.";
        emit("change", { categoryId: id, count, state: "selected" });
    }

    async function close(id) {
        const cfg = { ...config },
            info = categoryInfo.get(id);
        const landingDuration = cfg.closeDuration;
        const curve = MOTION_EASINGS[cfg.closeEasing];
        root.dataset.pcmState = "closing";
        const base = stage.getBoundingClientRect(),
            first = expanded.getBoundingClientRect();
        const firstImage = paintedImageRect(image, info.sourceImage);
        const shell = surface(expanded, first, base),
            oldCopy = copyGhost(expanded, first, base);
        const photo = cfg.sharedImage ? imageGhost(image, firstImage, base) : null;
        expanded.classList.add("pcm-morphing");
        stage.style.height = first.height + "px";
        Object.assign(expanded.style, {
            position: "absolute",
            left: "0",
            top: "0",
            width: "100%",
            height: first.height + "px",
            visibility: "hidden",
        });
        grid.hidden = false;
        grid.inert = true;
        const finalHeight = grid.getBoundingClientRect().height,
            last = info.card.getBoundingClientRect();
        const lastImage = info.sourceImage ? paintedImageRect(info.sourceImage) : null;
        // Hide the whole destination until the moving surface has landed.
        // Swap the moving image for the fully opaque card at the endpoint.
        info.card.classList.add("pcm-source-hidden");
        const travel = group(cfg),
            peers = group(cfg);
        const corner =
            cfg.closing === "corner"
                ? cornerStretchPlan(first, last, base, { ...cfg, easing: cfg.closeEasing }, true)
                : null;
        const frames = corner ? corner.frames : [rightGeometry(first, base), rightGeometry(last, base)];
        const targetStyle = win.getComputedStyle(info.card);
        const targetRadius = targetStyle.borderRadius;
        Object.assign(shell.style, rightGeometry(first, base), { left: "auto", transformOrigin: "top right" });
        travel.add(
            shell,
            frames.map((frame, index) => ({
                ...frame,
                borderRadius: index === frames.length - 1 ? targetRadius : cfg.heroRadius + "px",
                backgroundColor:
                    index === frames.length - 1 ? targetStyle.backgroundColor : shell.style.backgroundColor,
                boxShadow: index === frames.length - 1 ? targetStyle.boxShadow : shell.style.boxShadow,
            })),
            landingDuration,
            0,
            corner ? "linear" : curve,
        );
        travel.add(stage, [{ height: first.height + "px" }, { height: finalHeight + "px" }], landingDuration, 0, curve);
        // Keep text at its original size; clip and fade it as the surface shrinks.
        Object.assign(oldCopy.style, rightGeometry(first, base), { left: "auto" });
        travel.add(
            oldCopy,
            frames.map((frame) => ({ right: frame.right, top: frame.top, offset: frame.offset, easing: frame.easing })),
            landingDuration,
            0,
            corner ? "linear" : curve,
        );
        travel.add(
            oldCopy,
            [
                { opacity: 1, clipPath: "inset(0px)" },
                {
                    opacity: 0,
                    clipPath:
                        "inset(0px 0px " +
                        Math.max(0, first.height - last.height) +
                        "px " +
                        Math.max(0, first.width - last.width) +
                        "px)",
                },
            ],
            Math.round(landingDuration * 0.45),
            0,
            "ease-out",
        );
        if (photo && lastImage) {
            Object.assign(photo.style, rightGeometry(firstImage, base), { left: "auto", transformOrigin: "top right" });
            let imageFrames = [rightGeometry(firstImage, base), rightGeometry(lastImage, base)];
            if (corner) {
                const anchorImage = {
                    width: lastImage.width,
                    height: lastImage.height,
                    right: lastImage.right + corner.anchor.right - last.right,
                    top: lastImage.top + corner.anchor.top - last.top,
                };
                imageFrames = corner.frames.map((frame, index) => ({
                    ...rightGeometry(
                        index === 0 ? firstImage : index === corner.frames.length - 1 ? lastImage : anchorImage,
                        base,
                    ),
                    offset: frame.offset,
                    easing: frame.easing,
                }));
            }
            travel.add(photo, imageFrames, landingDuration, 0, corner ? "linear" : curve);
        }
        cards
            .filter((card) => card !== info.card)
            .forEach((card, index) =>
                peers.add(
                    card,
                    [
                        { opacity: 0, transform: "translateY(8px)" },
                        { opacity: 1, transform: "none" },
                    ],
                    cfg.gridReturnDuration,
                    (cfg.closeDuration * cfg.gridReturnDelay) / 100 + index * cfg.gridReturnStagger,
                    curve,
                ),
            );
        emit("start", {
            categoryId: id,
            closing: true,
            config: cfg,
            timeline: motionTimeline(cfg, 8, true),
            reduced: !canAnimate(),
        });
        const productsTask = changeProducts(null, cfg, true);
        try {
            await Promise.all([travel.wait(), scrollToPosition(categoryScrollTarget(), landingDuration, cfg)]);
            // Commit the destination and remove its temporary layers together,
            // without a second opacity animation after the image has landed.
            stage.style.height = finalHeight + "px";
            info.card.classList.remove("pcm-source-hidden");
            shell.remove();
            photo?.remove();
            oldCopy.remove();
            emit("landed", { categoryId: id, closing: true });
            await peers.wait();
        } finally {
            expanded.hidden = true;
            expanded.removeAttribute("style");
            expanded.classList.remove("pcm-morphing");
            grid.inert = false;
            info.card.classList.remove("pcm-source-hidden");
            info.card.querySelector("[data-pcm-select]").setAttribute("aria-expanded", "false");
            stage.style.removeProperty("height");
            shell.remove();
            photo?.remove();
            oldCopy.remove();
            travel.clear();
            peers.clear();
        }
        const count = await productsTask;
        hint.hidden = false;
        active = null;
        root.dataset.pcmState = "all";
        status.textContent = "همه دسته‌بندی‌ها و محصولات نمایش داده شدند.";
        emit("change", { categoryId: null, count, state: "all" });
    }

    const controller = createMotionController({
        isValid: (id) => categoryInfo.has(id),
        transition: async (from, to) => {
            if (from !== null) await close(from);
            if (to !== null) await open(to);
        },
        onBusy: (busy) => {
            if (busy) {
                back.hidden = true;
                if (overlayToolbar) toolbar.hidden = true;
            }
            stage.setAttribute("aria-busy", String(busy));
            results.setAttribute("aria-busy", String(busy));
            emit("busy", { busy });
        },
        onError: (error) => emit("error", { message: error.message }),
        onIdle: (id) => {
            applyAppearance();
            back.hidden = id === null || disposed;
            if (overlayToolbar) toolbar.hidden = back.hidden;
            const currentFocus = doc.activeElement;
            const restore = currentFocus === doc.body || currentFocus === back || grid.contains(currentFocus);
            const target = id ? back : categoryInfo.get(lastSelected)?.card.querySelector("[data-pcm-select]");
            if (restore && target && !disposed) target.focus({ preventScroll: true });
            emit("idle", { categoryId: id, reduced: !canAnimate() });
        },
    });
    function select(id) {
        return disposed ? Promise.resolve() : controller.request(id);
    }
    const eventOptions = { signal: abort.signal };
    grid.addEventListener(
        "click",
        (event) => {
            const button = event.target.closest("[data-pcm-select]");
            if (button && grid.contains(button)) select(button.dataset.pcmSelect).catch(() => {});
        },
        eventOptions,
    );
    back.addEventListener("click", () => select(null).catch(() => {}), eventOptions);
    doc.addEventListener(
        "keydown",
        (event) => {
            if (event.key !== "Escape" || event.defaultPrevented || doc.querySelector("dialog[open]")) return;
            if (options.shouldHandleEscape && !options.shouldHandleEscape(event)) return;
            if (controller.snapshot().desired !== null) {
                event.preventDefault();
                select(null).catch(() => {});
            }
        },
        eventOptions,
    );
    const interruptGeometry = () => {
        scrollRevision++;
        groups.forEach((item) => item.cancel());
    };
    win.addEventListener("resize", interruptGeometry, eventOptions);
    reduce.addEventListener("change", interruptGeometry, eventOptions);
    const stopUserScroll = (event) => {
        if (
            event.type === "keydown" &&
            !["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp", " "].includes(event.key)
        )
            return;
        scrollRevision++;
    };
    win.addEventListener("wheel", stopUserScroll, { ...eventOptions, passive: true });
    win.addEventListener("touchstart", stopUserScroll, { ...eventOptions, passive: true });
    win.addEventListener("keydown", stopUserScroll, eventOptions);
    root.dataset.pcmState = "all";

    const api = {
        select,
        replay: (id) =>
            disposed
                ? Promise.resolve()
                : controller.replay(id || active || lastSelected || categoryInfo.keys().next().value),
        whenIdle: () => controller.whenIdle(),
        getState: () => ({ ...controller.snapshot(), reduced: reduce.matches }),
        getConfig: () => ({ ...config }),
        getPlayback: () => ({ ...playback }),
        setPlayback(next = {}) {
            const source = next && typeof next === "object" ? next : {};
            const rate = source.rate;
            playback = {
                rate: Number.isFinite(rate) && rate >= 0.1 && rate <= 4 ? rate : playback.rate,
                paused: typeof source.paused === "boolean" ? source.paused : playback.paused,
            };
            groups.forEach((item) => item.setPlayback());
            emit("playback", { ...playback });
            return { ...playback };
        },
        updateConfig(next) {
            config = normalizeMotionConfig(next);
            if (!controller.snapshot().busy) applyAppearance();
            emit("config", { config: { ...config } });
            return { ...config };
        },
        getCategories: () => Array.from(categoryInfo.values()).map(({ id, title }) => ({ id, title })),
        async destroy() {
            playback.paused = false;
            groups.forEach((item) => item.setPlayback());
            await controller.request(null).catch(() => {});
            disposed = true;
            abort.abort();
            scrollRevision++;
            groups.forEach((item) => item.cancel());
            originalProducts.forEach((card) => {
                card.hidden = initialProductVisibility.get(card);
            });
            if (title) title.textContent = initialTitle;
            if (more) more.hidden = initialMoreHidden;
            addedButtons.forEach((button) => button.remove());
            for (const [button, state] of buttonStates) {
                for (const [name, value] of [
                    ["aria-expanded", state.expanded],
                    ["aria-controls", state.controls],
                    ["aria-label", state.label],
                    ["data-pcm-select", state.key],
                ]) {
                    if (value === null) button.removeAttribute(name);
                    else button.setAttribute(name, value);
                }
            }
            stage.parentNode.insertBefore(grid, stage);
            if (sourceGridId === null) grid.removeAttribute("id");
            else grid.setAttribute("id", sourceGridId);
            toolbar.remove();
            stage.remove();
            empty.remove();
            status.remove();
            root.classList.remove("pcm-root");
            results.classList.remove("pcm-results");
            if (initialResultsBusy === null) results.removeAttribute("aria-busy");
            else results.setAttribute("aria-busy", initialResultsBusy);
            for (const name of ["--pcm-height", "--pcm-radius"]) root.style.removeProperty(name);
            delete root.dataset.pcmState;
            delete root.__productMotion;
        },
    };
    root.__productMotion = api;
    return api;
}
