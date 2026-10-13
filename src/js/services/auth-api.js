/* API boundary: UI never stores passwords, OTPs, or session tokens in browser storage.
 * Preview is development-only. Production needs VITE_AUTH_MODE=api and server endpoints.
 * See README.md for the request/response contract.
 */
import { isAuthToken, retryAfterSeconds } from "./auth-response.js";

export const isAuthPreview = import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE !== "api";
const apiEnabled = import.meta.env.MODE === "backend" || import.meta.env.VITE_AUTH_MODE === "api";
const baseURL = (import.meta.env.VITE_AUTH_API_BASE || "/api/auth").replace(/\/$/, "");

export class AuthError extends Error {
    constructor(message, retryAfter = 0) {
        super(message);
        this.name = "AuthError";
        this.retryAfter = retryAfter;
    }
}

function previewResponse(action, payload) {
    if (["request-code", "register"].includes(action)) {
        return { challengeId: "preview-only", retryAfter: 60 };
    }
    if (action === "verify-code") {
        if (payload.code !== "123456") throw new AuthError("کد واردشده صحیح نیست. کد پیش‌نمایش ۱۲۳۴۵۶ است.");
        return { preview: true, resetToken: payload.purpose === "reset" ? "preview-only" : undefined };
    }
    return { preview: true };
}

async function request(action, payload, signal) {
    if (isAuthPreview) return previewResponse(action, payload);
    if (!apiEnabled) throw new AuthError("این سرویس هنوز فعال نشده است؛ لطفاً از راه‌های تماس با ما استفاده کنید.");

    // Credentials are submitted only to the backend that served this page.
    // Use a same-origin reverse proxy when the auth service is separate.
    const endpoint = new URL(`${baseURL}/${action}`, location.href);
    if (endpoint.origin !== location.origin || endpoint.username || endpoint.password)
        throw new AuthError("نشانی سرویس ورود باید متعلق به همین سایت باشد.");

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    if (!csrfToken?.trim())
        throw new AuthError("امکان ارسال درخواست فعلاً فراهم نیست؛ لطفاً کمی بعد دوباره تلاش کنید.");
    let response;
    try {
        response = await fetch(endpoint.href, {
            method: "POST",
            credentials: "same-origin",
            redirect: "error",
            headers: {
                "Content-Type": "application/json",
                ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}),
            },
            body: JSON.stringify(payload),
            signal,
        });
    } catch (error) {
        if (error.name === "AbortError") throw error;
        throw new AuthError("ارتباط برقرار نشد؛ اتصال اینترنت را بررسی و دوباره تلاش کنید.");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) {
        const retryAfter = retryAfterSeconds(response.headers.get("Retry-After"));
        if (response.status === 429)
            throw new AuthError("تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.", retryAfter);
        if (response.status >= 500) throw new AuthError("سرویس موقتاً در دسترس نیست؛ دوباره تلاش کنید.");
        throw new AuthError(
            typeof data?.message === "string" && data.message.trim()
                ? data.message.slice(0, 300)
                : "اطلاعات واردشده صحیح نیست یا درخواست منقضی شده است.",
        );
    }
    if (!data || Array.isArray(data) || data.ok !== true)
        throw new AuthError("پاسخ سرویس قابل تأیید نیست؛ دوباره تلاش کنید.");
    if (["request-code", "register"].includes(action) && !isAuthToken(data.challengeId)) {
        throw new AuthError("کد تأیید صادر نشد؛ دوباره تلاش کنید.");
    }
    if (action === "verify-code" && payload.purpose === "reset" && !isAuthToken(data.resetToken)) {
        throw new AuthError("تأیید بازیابی انجام نشد؛ دوباره کد دریافت کنید.");
    }
    return { ...data, retryAfter: retryAfterSeconds(data.retryAfter) };
}

export const authAPI = {
    login: (payload, signal) => request("login", payload, signal),
    register: (payload, signal) => request("register", payload, signal),
    requestCode: (payload, signal) => request("request-code", payload, signal),
    verifyCode: (payload, signal) => request("verify-code", payload, signal),
    resetPassword: (payload, signal) => request("reset-password", payload, signal),
};
