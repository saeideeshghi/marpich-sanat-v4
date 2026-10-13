// Only badges whose natural slot wraps occupy a full row. Measuring after
// removing the promotion avoids a narrow/full-row ResizeObserver feedback loop.
const badgeSelector = ".site-card__media-tag, .site-card__meta-tag, .site-card__status-tag";
const initializedParents = new WeakSet();

function textLineCount(badge) {
    const walker = document.createTreeWalker(badge, NodeFilter.SHOW_TEXT);
    const rows = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
            if (rect.width < 1 || rect.height < 1) continue;
            const center = rect.y + rect.height / 2;
            if (!rows.some((row) => Math.abs(row - center) < 2)) rows.push(center);
        }
    }
    return rows.length;
}

export function initBadgeRows(scope = document) {
    const groups = new Map();
    scope.querySelectorAll(`main :is(${badgeSelector})`).forEach((badge) => {
        const parent = badge.parentElement;
        if (initializedParents.has(parent)) return;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(badge);
    });
    if (!groups.size) return;
    const signatures = new Map();
    const pending = new Map();
    let frame = 0;
    const signatureFor = (parent) => {
        const badges = groups.get(parent);
        const parentStyle = getComputedStyle(parent);
        return [
            parent.clientWidth,
            parentStyle.display,
            parentStyle.gridTemplateColumns,
            parentStyle.gap,
            parentStyle.paddingInline,
            ...badges.map((badge) => {
                const style = getComputedStyle(badge);
                return `${style.fontFamily}|${style.fontSize}|${style.lineHeight}`;
            }),
        ].join(";");
    };
    const refresh = (requests) => {
        const changed = [];
        for (const [parent, force] of requests) {
            const signature = signatureFor(parent);
            if (!force && signatures.get(parent) === signature) continue;
            signatures.set(parent, signature);
            changed.push(groups.get(parent));
        }
        // Remove all promotions, read all lines, then write all results. A
        // large catalogue needs one layout flush instead of one per badge row.
        changed.forEach((badges) => badges.forEach((badge) => badge.removeAttribute("data-badge-wrapped")));
        const measurements = changed.map((badges) => badges.map((badge) => textLineCount(badge) > 1));
        changed.forEach((badges, index) =>
            badges.forEach((badge, i) => badge.toggleAttribute("data-badge-wrapped", measurements[index][i])),
        );
    };
    const schedule = (parent, force = false) => {
        if (!groups.has(parent)) return;
        pending.set(parent, force || pending.get(parent) || false);
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            refresh(pending);
            pending.clear();
        });
    };
    const resize = new ResizeObserver((entries) => {
        entries.forEach(({ target }) => schedule(groups.has(target) ? target : target.parentElement));
    });
    const mutation = new MutationObserver((entries) => {
        const parents = new Set(
            entries.map(({ target }) => {
                const element = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
                return element.closest(badgeSelector)?.parentElement || element;
            }),
        );
        parents.forEach((parent) => {
            if (groups.has(parent)) schedule(parent, true);
        });
    });
    groups.forEach((badges, parent) => {
        initializedParents.add(parent);
        resize.observe(parent);
        badges.forEach((badge) => {
            resize.observe(badge);
            mutation.observe(badge, { childList: true, characterData: true, subtree: true });
        });
    });
    refresh(new Map([...groups.keys()].map((parent) => [parent, true])));
    const refreshFonts = () => groups.forEach((_, parent) => schedule(parent, true));
    document.fonts.ready.then(refreshFonts);
    document.fonts.addEventListener("loadingdone", refreshFonts);
}
