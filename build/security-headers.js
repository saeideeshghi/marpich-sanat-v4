// Apply the same policy in the actual backend/web server. Vite preview headers
// validate the public build locally; a static frontend cannot enforce cookies,
// CSRF validation, rate limits or file scanning on behalf of a backend.
export const backendHeaders = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
    ].join("; "),
};

// Static hosts can enforce CSP through HTML. Frame embedding protection still
// requires the response header; frame-ancestors is unsupported in a meta tag.
export const publicContentSecurityPolicy = backendHeaders["Content-Security-Policy"]
    .split("; ")
    .filter((directive) => !directive.startsWith("frame-ancestors "))
    .join("; ");
