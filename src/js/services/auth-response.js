// Normalize server cooldowns before they reach the UI's countdown timer.
// Retry-After accepts seconds or an HTTP date; JSON responses use seconds.
export function retryAfterSeconds(value, now = Date.now()) {
    const numeric = typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value.trim()));
    const seconds = numeric ? Number(value) : typeof value === "string" ? (Date.parse(value) - now) / 1000 : NaN;
    return Number.isFinite(seconds) && (!numeric || seconds >= 0)
        ? Math.min(86400, Math.max(0, Math.ceil(seconds)))
        : 60;
}

export function isAuthToken(value) {
    return typeof value === "string" && value.trim().length > 0 && value.length <= 4096;
}
