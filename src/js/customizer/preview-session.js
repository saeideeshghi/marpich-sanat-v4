import { normalizeConfig, compileCSS } from "./model.js";
import { imageSourceRules } from "./image-source.js";
import { pages } from "../../../build/pages.js";

const parameter = "mps-preview";
const lifetime = 6 * 60 * 60 * 1000;
const prefix = (base) => `marpich-preview:${base}:`;
const validId = (id) => typeof id === "string" && /^[\da-f-]{36}$/.test(id);

// A snapshot stays in this browser; the URL contains only an opaque identifier.
export function savePreviewSnapshot(config, base, previousId) {
    const id = validId(previousId) ? previousId : crypto.randomUUID();
    const keyPrefix = prefix(base);
    const candidates = [];
    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key.startsWith(keyPrefix)) continue;
        let expires = 0;
        try {
            expires = JSON.parse(localStorage.getItem(key)).expires || 0;
        } catch {
            /* Remove malformed snapshots. */
        }
        candidates.push({ key, expires });
    }
    const active = candidates
        .filter((item) => item.expires > Date.now() && item.key !== keyPrefix + id)
        .sort((a, b) => b.expires - a.expires)
        .slice(0, 4);
    const keep = new Set(active.map((item) => item.key));
    for (const item of candidates)
        if (!keep.has(item.key) && item.key !== keyPrefix + id) localStorage.removeItem(item.key);
    localStorage.setItem(
        keyPrefix + id,
        JSON.stringify({ expires: Date.now() + lifetime, config: normalizeConfig(config) }),
    );
    return id;
}

export function previewURL(page, id, base, origin = location.origin) {
    const url = new URL(base + page.file, origin);
    url.searchParams.set(parameter, id);
    return url;
}

export function initDraftPreview(base) {
    const id = new URL(location.href).searchParams.get(parameter);
    if (!validId(id)) return;
    const key = prefix(base) + id;
    const savedLink = document.getElementById("mps-template-overrides");
    const style = document.createElement("style");
    style.id = "mps-standalone-preview";
    document.head.append(style);
    const banner = document.createElement("aside");
    banner.className = "mps-draft-banner";
    banner.setAttribute("aria-label", "وضعیت پیش‌نمایش");
    Object.assign(banner.style, {
        position: "fixed",
        bottom: "12px",
        right: "12px",
        zIndex: "2147483647",
        maxWidth: "calc(100vw - 24px)",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: "8px",
        background: "#0f172b",
        color: "#fff",
        boxShadow: "0 4px 16px #0003",
        font: "12px/1.8 Peyda,Tahoma,sans-serif",
        direction: "rtl",
    });
    const caption = document.createElement("span");
    const exit = document.createElement("button");
    exit.type = "button";
    exit.textContent = "خروج از پیش‌نمایش";
    Object.assign(exit.style, { color: "#79b6ed", cursor: "pointer", flexShrink: "0" });
    exit.addEventListener("click", () => {
        const url = new URL(location.href);
        url.searchParams.delete(parameter);
        location.replace(url.href);
    });
    banner.append(caption, exit);
    document.body.append(banner);
    const apply = () => {
        try {
            const snapshot = JSON.parse(localStorage.getItem(key));
            if (!snapshot || snapshot.expires <= Date.now()) throw new Error("expired");
            const config = normalizeConfig(snapshot.config);
            style.textContent = compileCSS(config);
            if (savedLink) savedLink.disabled = true;
            window.dispatchEvent(new Event("site:styles-preview"));
            window.dispatchEvent(new CustomEvent("site:image-preview", { detail: imageSourceRules(config.rules) }));
            if (config.patterns)
                window.dispatchEvent(new CustomEvent("site:pattern-preview", { detail: config.patterns }));
            caption.textContent = "پیش‌نمایش تغییرات · هنوز در قالب ثبت نشده";
        } catch {
            window.dispatchEvent(new Event("site:styles-preview"));
            window.dispatchEvent(new CustomEvent("site:image-preview"));
            style.textContent = "";
            if (savedLink) savedLink.disabled = false;
            caption.textContent = "پیش‌نمایش منقضی شده؛ از کاستومایزر دوباره باز کن";
        }
    };
    if (document.body.dataset.siteReady === "true") apply();
    else document.addEventListener("site:ready", apply, { once: true });
    window.addEventListener("storage", (event) => {
        if (event.key === key) apply();
    });
    // Carry the draft through site navigation, while preserving query/hash state.
    const allowedPaths = new Set(pages.map((page) => new URL(base + page.file, location.origin).pathname));
    for (const link of document.querySelectorAll("a[href]:not([download])")) {
        const raw = link.getAttribute("href");
        if (!raw || raw.startsWith("#")) continue;
        const url = new URL(link.href, location.href);
        if (url.origin === location.origin && allowedPaths.has(url.pathname)) {
            url.searchParams.set(parameter, id);
            link.href = url.href;
        }
    }
}
