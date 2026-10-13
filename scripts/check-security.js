import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, request as httpRequest } from "node:http";
import { resolve } from "node:path";
import { escapeHtml, validateContentUrl, renderComponent } from "../build/components.js";
import { normalizePattern } from "../src/js/customizer/pattern-model.js";
import { isValidSvgPath } from "../src/js/utils/svg-path.js";
import { pages } from "../build/pages.js";
import { renderPage } from "../build/html-partials.js";
import { templateCustomizer } from "../build/customizer.js";
import { htmlPartials } from "../build/html-partials.js";
import { isAuthToken, retryAfterSeconds } from "../src/js/services/auth-response.js";

const root = resolve(import.meta.dirname, "..");
for (const value of [undefined, null, {}, [], Infinity, NaN, -1, "invalid"])
    assert.equal(retryAfterSeconds(value), 60, "Malformed cooldowns must not break the countdown");
assert.equal(retryAfterSeconds("120"), 120);
assert.equal(retryAfterSeconds(0), 0);
assert.equal(retryAfterSeconds(1e9), 86400, "Countdown remains bounded");
const now = Date.parse("2026-10-12T12:00:00Z");
assert.equal(retryAfterSeconds("Mon, 12 Oct 2026 12:02:00 GMT", now), 120);
assert.equal(retryAfterSeconds("Mon, 12 Oct 2026 11:59:00 GMT", now), 0);
for (const value of [null, {}, [], 123, "", "  ", "a".repeat(4097)]) assert(!isAuthToken(value));
assert(isAuthToken("opaque-server-token"));
const productionHtml = htmlPartials(root);
productionHtml.configResolved({ command: "build" });
const protectedHtml = productionHtml.transformIndexHtml.handler(readFileSync(resolve(root, "index.html"), "utf8"), {
    filename: resolve(root, "index.html"),
});
assert(protectedHtml.includes('http-equiv="Content-Security-Policy"'));
assert(!protectedHtml.includes("frame-ancestors"), "Embedding protection requires HTTP headers, not a meta policy");
assert(protectedHtml.indexOf('http-equiv="Content-Security-Policy"') < protectedHtml.indexOf('rel="stylesheet"'));
for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>",
    "//evil.example",
    "java\nscript:alert(1)",
    "https://name:password@example.com/",
    "https://example.com\\@evil.example",
])
    assert.throws(() => validateContentUrl(url), `Unsafe URL must fail: ${url}`);
for (const url of [
    "product-details.html",
    "/assets/file.pdf",
    "https://example.com/file.pdf",
    "#consultation",
    "mailto:info@example.com",
    "tel:+9821",
])
    assert.equal(validateContentUrl(url), url);
assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
const data = JSON.parse(readFileSync(resolve(root, "src/data/pages/products.json")));
const injected = renderComponent("product-cards", [{ ...data.products[0], title: "<script>alert(1)</script>" }], root);
assert(!injected.includes("<script>"));
assert(injected.includes("&lt;script&gt;"));
for (const path of ["M0 0 tc0.2,0,0.4-0.2,0", "M0 0C1 2", "M0 0,", "L0 0", "M0 0A2 2 0 2 0 4 4"])
    assert.equal(isValidSvgPath(path), false, path);
for (const path of ["M0 0L1 1Z", "M1e-3 -.5c1 2 3 4 5 6z", "M0 0A2 2 0 014 4", "M0 0 1 2 3 4"])
    assert.equal(isValidSvgPath(path), true, path);
const pattern = JSON.parse(readFileSync(resolve(root, "src/data/patterns/site-pattern.json")));
const bad = structuredClone(pattern);
bad.lines[0].d = "M0 0 tc0.2,0,0.4-0.2,0";
assert.throws(() => normalizePattern(bad), "Malformed path must fail before saving or rendering");
const oversized = structuredClone(pattern);
oversized.lines[0].d = "M0 0 C1e100 1 2 2 3 3";
assert.throws(() => normalizePattern(oversized), "Reject coordinates that exhaust curve subdivision");
const excessive = structuredClone(pattern);
excessive.animation.cycles = 10000;
assert.throws(() => normalizePattern(excessive), "Reject cycles beyond the editor's supported range");
for (const page of pages) {
    const html = renderPage(readFileSync(resolve(root, page.file), "utf8"), page.file, root);
    assert(!/\son(?:click|load|error|submit|mouseover)\s*=/i.test(html), `${page.file}: inline executable event`);
    assert(!/\b(?:href|src)\s*=\s*["']\s*(?:javascript|vbscript):/i.test(html), `${page.file}: executable URL`);
    assert(!/jquery/i.test(html), `${page.file}: unexpected legacy library`);
}
const auth = readFileSync(resolve(root, "src/js/services/auth-api.js"), "utf8");
assert(!/localStorage|sessionStorage/.test(auth), "Auth credentials must not enter browser storage");
// Look for actual key material, printing only filenames on failure.
const sourceFiles = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
for (const directory of ["src", "build", "scripts", "docs", ".github"])
    sourceFiles.push(
        ...readdirSync(resolve(root, directory), { recursive: true }).map((name) => `${directory}/${name}`),
    );
for (const name of sourceFiles) {
    if (!/\.(?:html|[cm]?js|json|md|css|ya?ml)$/.test(name)) continue;
    const content = readFileSync(resolve(root, name), "utf8");
    assert(
        !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}/.test(content),
        `Key material in ${name}`,
    );
}
const fixture = mkdtempSync(resolve(tmpdir(), "marpich-security-"));
try {
    for (const file of [
        "src/data/customizer/settings.json",
        "src/data/patterns/site-pattern.json",
        "src/data/patterns/footer-pattern.json",
        "src/css/template-overrides.css",
    ]) {
        const target = resolve(fixture, file);
        mkdirSync(resolve(target, ".."), { recursive: true });
        copyFileSync(resolve(root, file), target);
    }
    const plugin = templateCustomizer(fixture, "/");
    let middleware;
    plugin.configureServer({
        middlewares: {
            use(handler) {
                middleware = handler;
            },
        },
        ws: { send() {} },
    });
    async function request(method, headers = {}, chunks = [], peer = "127.0.0.1") {
        let text = "";
        const response = {
            statusCode: 200,
            setHeader() {},
            end(value) {
                text = value;
            },
        };
        const req = {
            url: "/__customizer/settings",
            method,
            headers: { host: "localhost:5174", ...headers },
            socket: { remoteAddress: peer },
            async *[Symbol.asyncIterator]() {
                yield* chunks;
            },
        };
        await middleware(req, response, () => assert.fail("Expected settings route"));
        return { status: response.statusCode, data: JSON.parse(text) };
    }
    const initial = (await request("GET")).data;
    const server = createServer((req, res) => {
        Promise.resolve(
            middleware(req, res, () => {
                res.statusCode = 404;
                res.end();
            }),
        ).catch(() => {
            res.statusCode = 500;
            res.end();
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const status = await new Promise((resolve, reject) => {
            const req = httpRequest(
                {
                    hostname: "127.0.0.1",
                    port: server.address().port,
                    path: "/__customizer/settings",
                    headers: { Host: "attacker.example:5174" },
                },
                (res) => {
                    res.resume();
                    res.on("end", () => resolve(res.statusCode));
                },
            );
            req.on("error", reject);
            req.end();
        });
        assert.equal(status, 403, "A real HTTP request with a forged Host must not read the token");
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
    assert.equal(
        (await request("GET", { host: "127.0.0.1:5174" }, [], "192.168.1.4")).status,
        403,
        "A remote client cannot forge a loopback Host",
    );
    assert.equal(
        (await request("GET", { host: "attacker.example:5174" })).status,
        403,
        "Reject DNS-rebound hosts before exposing a write token",
    );
    assert.equal(
        (await request("GET", { origin: "http://localhost:9999" })).status,
        403,
        "Reject token reads from another origin",
    );
    assert.equal(
        (await request("GET", { origin: "https://localhost:5174" })).status,
        403,
        "Scheme is part of the origin",
    );
    const bytes = Buffer.from(JSON.stringify({ revision: initial.revision, config: initial.config }));
    const headers = {
        "x-marpich-customizer": initial.token,
        "content-type": "application/json",
        origin: "http://localhost:5174",
    };
    assert.equal((await request("POST", { ...headers, origin: "https://evil.example" }, [bytes])).status, 403);
    assert.equal((await request("POST", { ...headers, "x-marpich-customizer": "invalid" }, [bytes])).status, 403);
    assert.equal((await request("POST", headers, [Buffer.alloc(2097153)])).status, 413);
    const boundary = bytes.findIndex((byte) => byte >= 192) + 1;
    assert(boundary > 0, "The real configuration contains Persian text");
    const saved = await request("POST", headers, [bytes.subarray(0, boundary), bytes.subarray(boundary)]);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.config, initial.config, "Split UTF-8 must preserve the exact saved settings");
} finally {
    rmSync(fixture, { recursive: true, force: true });
}
console.log(
    "PASS: content escaping, public URLs, malformed SVG rejection, native pages and credential storage boundaries.",
);
