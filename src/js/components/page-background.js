// One static, document-sized artwork behind the site's light page surfaces.
// Each opaque surface reveals the same crop, so existing section colors stay
// intact and the pattern never covers cards, images, text or controls.
const instances = new WeakMap();

export function initPageBackground() {
    const body = document.body;
    if (!body?.dataset.page) return null;
    if (instances.has(body)) return instances.get(body);

    const lightSurface = (host) => {
        const color = getComputedStyle(host).backgroundColor;
        if (!/^rgba?\(/.test(color)) return false;
        const channels = color.match(/[\d.]+/g).map(Number);
        return channels.slice(0, 3).every((value) => value >= 230) && (channels.length === 3 || channels[3] >= 0.99);
    };
    const candidates = document.querySelectorAll(
        'main, .about-page, .contact-page, .industries-page, .articles-page, .projects-page, .industry-textile, body[data-page="home"] main > section',
    );
    const hosts = [...new Set([body, ...candidates])].filter((host) => host === body || lightSurface(host));
    const entries = hosts.map((host) => {
        const hadClass = host.classList.contains("site-page-background-host");
        host.classList.add("site-page-background-host");
        const layer = document.createElement("div");
        layer.className = "site-page-background-layer";
        layer.setAttribute("aria-hidden", "true");
        host.prepend(layer);
        return { host, layer, hadClass };
    });

    let frame = 0;
    let active = true;
    let motionBusy = false;
    const products = document.querySelector("[data-products-page]");
    const measure = () => {
        const page = body.getBoundingClientRect();
        // Absolute decoration must not feed back into scrollHeight and keep
        // the page tall after a category closes or an accordion collapses.
        const height = Math.max(page.height, document.documentElement.clientHeight);
        // Read all geometry before writing styles; avoid one layout flush per
        // surface. Product transitions defer this work until their final size.
        const updates = entries.map(({ host, layer }) => {
            const box = host.getBoundingClientRect();
            const parent = layer.offsetParent;
            const origin = parent?.getBoundingClientRect() || {
                left: -window.scrollX,
                top: -window.scrollY,
            };
            // Keep the host's original positioning; compensate for the actual
            // containing block instead of making every section relative.
            return {
                layer,
                styles: {
                    left: `${box.left - origin.left - (parent?.clientLeft || 0)}px`,
                    top: `${box.top - origin.top - (parent?.clientTop || 0)}px`,
                    width: `${box.width}px`,
                    height: `${host === body ? height : box.height}px`,
                    backgroundSize: `${page.width}px ${height}px`,
                    backgroundPosition: `${page.left - box.left}px ${page.top - box.top}px`,
                },
            };
        });
        for (const { layer, styles } of updates) {
            for (const [name, value] of Object.entries(styles)) {
                if (layer.style[name] !== value) layer.style[name] = value;
            }
        }
    };
    const refresh = () => {
        if (!active || motionBusy || frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (active) measure();
        });
    };
    const observer = new ResizeObserver(refresh);
    hosts.forEach((host) => observer.observe(host));
    window.addEventListener("resize", refresh, { passive: true });
    const onMotionBusy = (event) => {
        motionBusy = Boolean(event.detail?.busy);
        if (motionBusy) {
            cancelAnimationFrame(frame);
            frame = 0;
        } else refresh();
    };
    products?.addEventListener("product-motion:busy", onMotionBusy);
    const api = {
        refresh,
        destroy() {
            active = false;
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("resize", refresh);
            products?.removeEventListener("product-motion:busy", onMotionBusy);
            for (const { host, layer, hadClass } of entries) {
                layer.remove();
                if (!hadClass) host.classList.remove("site-page-background-host");
            }
            instances.delete(body);
        },
    };
    instances.set(body, api);
    measure();
    return api;
}
