// Keep the pattern module and its artwork out of the initial interaction graph.
const scheduled = new WeakMap();

export function scheduleSitePatterns(load = () => import("./site-pattern.js")) {
    const body = document.body;
    if (scheduled.has(body)) return scheduled.get(body);
    let frame = 0,
        cancelled = false,
        pendingPreview = null;
    const rememberPreview = (event) => {
        pendingPreview = event.detail;
    };
    window.addEventListener("site:pattern-preview", rememberPreview);
    const start = () => {
        if (cancelled) return;
        Promise.resolve()
            .then(load)
            .then(({ initSitePatterns }) => {
                if (cancelled) return;
                window.removeEventListener("site:pattern-preview", rememberPreview);
                initSitePatterns();
                if (pendingPreview)
                    window.dispatchEvent(new CustomEvent("site:pattern-preview", { detail: pendingPreview }));
                pendingPreview = null;
            })
            .catch((error) => {
                window.removeEventListener("site:pattern-preview", rememberPreview);
                console.warn("Site pattern initialization failed.", error);
            });
    };
    // Start after the first paint; lazy footer data remains outside this path.
    frame = requestAnimationFrame(() => {
        frame = 0;
        start();
    });
    const cancel = () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        window.removeEventListener("site:pattern-preview", rememberPreview);
        scheduled.delete(body);
    };
    scheduled.set(body, cancel);
    return cancel;
}
