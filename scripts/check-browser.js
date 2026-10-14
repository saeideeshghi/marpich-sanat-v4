import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { pages } from "../build/pages.js";
import { normalizeMotionConfig, motionTimeline } from "../src/js/components/product-category-motion.js";
const approvedMotion = normalizeMotionConfig(
    JSON.parse(readFileSync(new URL("../src/data/product-motion/config.json", import.meta.url), "utf8")).motion,
);

const base = process.env.SITE_URL || "http://127.0.0.1:4174/";
const cdp = process.env.CDP_URL || "http://127.0.0.1:9223";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
        ws.addEventListener("open", resolve, { once: true });
        ws.addEventListener("error", reject, { once: true });
    });
    let sequence = 0;
    const pending = new Map();
    const events = [];
    ws.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id) {
            const task = pending.get(message.id);
            pending.delete(message.id);
            if (!task) return;
            clearTimeout(task.timer);
            message.error ? task.reject(Error(JSON.stringify(message.error))) : task.resolve(message.result);
        } else events.push(message);
    });
    return {
        ws,
        events,
        call: (method, params = {}) =>
            new Promise((resolve, reject) => {
                const id = ++sequence,
                    timer = setTimeout(() => {
                        pending.delete(id);
                        reject(Error(`CDP timeout: ${method}`));
                    }, 30000);
                pending.set(id, { resolve, reject, timer });
                ws.send(JSON.stringify({ id, method, params }));
            }),
    };
}
const version = await (await fetch(`${cdp}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const { browserContextId } = await browser.call("Target.createBrowserContext");
const { targetId } = await browser.call("Target.createTarget", { url: "about:blank", browserContextId });
const targets = await (await fetch(`${cdp}/json/list`)).json();
const page = await connect(targets.find((target) => target.id === targetId).webSocketDebuggerUrl);
const { call } = page;
const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
};
const report = { base, date: new Date().toISOString(), pages: [], features: {} };
async function waitFor(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await delay(100);
    }
    throw Error(`Browser condition did not resolve: ${expression}`);
}
async function navigate(filename, width) {
    page.events.length = 0;
    await call("Emulation.setDeviceMetricsOverride", {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 640,
    });
    await call("Page.navigate", { url: new URL(filename, base).href });
    await waitFor("document.readyState==='complete' && document.body?.dataset.siteReady==='true'");
    await evaluate("document.fonts.ready");
    await delay(700);
}
async function hover(selector) {
    const point = await evaluate(
        `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({behavior:'instant',block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`,
    );
    await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await delay(350);
}
try {
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Log.enable");
    await call("Network.enable");
    await call("Network.setCacheDisabled", { cacheDisabled: true });
    for (const width of [1500, 390])
        for (const definition of pages) {
            await navigate(definition.file, width);
            const data = await evaluate(
                `({page:document.body.dataset.page,overflow:document.documentElement.scrollWidth-innerWidth,images:[...document.images].filter(i=>i.getAttribute('src') && i.getClientRects().length && i.loading!=='lazy' && i.complete && i.naturalWidth===0).map(i=>i.src),font:getComputedStyle(document.body).fontFamily,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),load:performance.getEntriesByType('navigation')[0].loadEventEnd})`,
            );
            assert.equal(data.page, definition.name);
            assert(data.overflow <= 1, `${definition.file}: horizontal overflow`);
            assert.equal(data.images.length, 0, `${definition.file}: missing eager images ${data.images.join(",")}`);
            const errors = page.events.filter(
                (e) =>
                    e.method === "Runtime.exceptionThrown" ||
                    (e.method === "Log.entryAdded" && ["warning", "error"].includes(e.params.entry.level)),
            );
            assert.equal(errors.length, 0, `${definition.file}: console ${JSON.stringify(errors)}`);
            report.pages.push({ file: definition.file, width, ...data, errors: 0 });
            console.log(`PASS ${definition.file} @ ${width}`);
        }
    for (const path of [
        "__audit-missing.html",
        "assets/__audit-missing.css",
        ".env",
        ".git/config",
        "__customizer/settings",
    ])
        assert.equal(
            (await fetch(new URL(path, base))).status,
            404,
            `Missing/private route must not return the home page: ${path}`,
        );
    report.features.missingAndPrivateRoutes = true;
    await navigate("about.html", 390);
    const originalImageAttributes = await evaluate(
        "Object.fromEntries(['src','srcset','sizes','width','height'].map(name=>[name,document.querySelector('.about-team-media__image').getAttribute(name)]))",
    );
    await evaluate(
        "window.dispatchEvent(new CustomEvent('site:image-preview',{detail:[{breakpoint:'all',source:'/assets/images/about/why-marpich.png'}]}))",
    );
    await waitFor(
        "document.querySelector('.about-team-media__image').complete && document.querySelector('.about-team-media__image').naturalWidth>0",
    );
    assert(
        await evaluate(
            "!document.querySelector('.about-team-media__image').hasAttribute('srcset') && !document.querySelector('.about-team-media__image').hasAttribute('width')",
        ),
        "Custom images must not keep the approved photo's source set or aspect ratio",
    );
    await evaluate("window.dispatchEvent(new CustomEvent('site:image-preview',{detail:[]}))");
    assert.deepEqual(
        await evaluate(
            "Object.fromEntries(['src','srcset','sizes','width','height'].map(name=>[name,document.querySelector('.about-team-media__image').getAttribute(name)]))",
        ),
        originalImageAttributes,
        "Restoring the approved photo restores its responsive sources and dimensions",
    );
    report.features.customImageResponsiveSources = true;
    await navigate("index.html", 1500);
    assert.equal(
        await evaluate("getComputedStyle(document.querySelector('.home-products-actions')).justifyContent"),
        "center",
    );
    await hover(".home-products-grid .site-card__image");
    assert(
        await evaluate(
            "(()=>{const r=document.querySelector('.home-products-grid .site-card__image').getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2).classList.contains('site-card-link')})()",
        ),
    );
    report.features.cardLinks = true;
    for (const filename of [
        "products.html",
        "air-handling.html",
        "product-details.html",
        "industry-textile.html",
        "projects.html",
        "project-details.html",
        "industries.html",
        "articles.html",
    ]) {
        for (const width of [766, 767, 900, 1024, 1025]) {
            await navigate(filename, width);
            const alignment = await evaluate(`(() => {
                const content = document.querySelector('.catalog-consultation__content');
                const field = content.querySelector('.catalog-consultation__field');
                const fieldRight = field.getBoundingClientRect().right;
                const texts = [...content.querySelectorAll(':scope > h2, :scope > p')].map(element => {
                    const style = getComputedStyle(element);
                    return {
                        right: element.getBoundingClientRect().right - parseFloat(style.paddingRight),
                        align: style.textAlign,
                        last: style.textAlignLast,
                    };
                });
                const form = content.querySelector('form').getBoundingClientRect();
                const box = content.getBoundingClientRect();
                return {
                    fieldRight, texts,
                    accentRight: content.querySelector('.catalog-consultation__accent').getBoundingClientRect().right,
                    centerOffset: (form.left + form.right - box.left - box.right) / 2,
                    overflow: document.documentElement.scrollWidth - innerWidth,
                };
            })()`);
            assert(alignment.overflow <= 1, `${filename} at ${width}px: horizontal overflow`);
            if (width < 767 || width > 1024) continue;
            assert(Math.abs(alignment.centerOffset) < 0.1, `${filename}: consultation form stays centered`);
            for (const text of alignment.texts) {
                assert.equal(text.align, "right", `${filename}: consultation text alignment`);
                assert.equal(text.last, "right", `${filename}: consultation last line alignment`);
                assert(
                    Math.abs(text.right - alignment.fieldRight) < 0.1,
                    `${filename}: text and input share their right edge`,
                );
            }
            assert(
                Math.abs(alignment.accentRight - alignment.fieldRight) < 0.1,
                `${filename}: accent shares the text edge`,
            );
        }
    }
    report.features.catalogConsultationAlignment = true;
    for (const width of [320, 390, 639, 640, 767, 1024, 1179, 1180, 1920, 2560]) {
        await navigate("contact.html", width);
        const hero = await evaluate(`(() => {
            const size = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
            return {
                eyebrow: size('.contact-hero .site-hero__eyebrow'),
                title: size('.contact-hero .site-hero__title'),
                description: size('.contact-hero .site-hero__description'),
                overflow: document.documentElement.scrollWidth - innerWidth,
            };
        })()`);
        const desktop = width >= 1180;
        assert.equal(hero.eyebrow, desktop ? 28 : 20, `Contact hero eyebrow at ${width}px`);
        assert.equal(hero.title, desktop ? 42 : width >= 640 ? 38 : 25, `Contact hero title at ${width}px`);
        assert.equal(hero.description, desktop ? 22 : 18, `Contact hero description at ${width}px`);
        assert(hero.overflow <= 1, `Contact page has no horizontal overflow at ${width}px`);
    }
    await evaluate(
        "document.querySelector('.contact-cooperation').scrollIntoView({behavior:'instant',block:'center'})",
    );
    await waitFor(
        "[...document.querySelectorAll('img.contact-cooperation__icon')].length===2 && [...document.querySelectorAll('img.contact-cooperation__icon')].every(image => image.complete && image.naturalWidth>0)",
    );
    const cooperationIcons = await evaluate(
        "[...document.querySelectorAll('img.contact-cooperation__icon')].map(image => new URL(image.currentSrc).pathname.split('/').pop())",
    );
    assert.deepEqual(cooperationIcons, ["fluent_people.svg", "healthicons_construction-worker-.svg"]);
    report.features.contactHeroAndCooperationIcons = true;
    await navigate("product-details.html", 1180);
    const productPosition = await evaluate(
        "(()=>{const box=document.querySelector('.product-details__summary'),content=document.querySelector('.product-details__content');return {shift:new DOMMatrix(getComputedStyle(box).transform).m42,gap:content.getBoundingClientRect().top-box.getBoundingClientRect().bottom,expectedGap:parseFloat(getComputedStyle(content).marginTop)}})()",
    );
    assert.equal(productPosition.shift, -210, "Move the summary box itself on desktop");
    assert(
        Math.abs(productPosition.gap - productPosition.expectedGap) < 0.05,
        "Keep the normal spacing after the moved box",
    );
    assert.equal(
        await evaluate("getComputedStyle(document.querySelector('.product-details__summary')).marginBottom"),
        "-210px",
    );
    await call("Emulation.setDeviceMetricsOverride", {
        width: 1179,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await delay(100);
    assert.equal(
        await evaluate(
            "new DOMMatrix(getComputedStyle(document.querySelector('.product-details__summary')).transform).m42",
        ),
        -176,
        "Tablet keeps its existing box position",
    );
    assert.notEqual(
        await evaluate("getComputedStyle(document.querySelector('.product-details__summary')).marginBottom"),
        "-210px",
    );
    await evaluate("document.querySelector('[data-product-document]').click()");
    assert.equal(await evaluate("document.querySelector('[data-product-document-status]').hidden"), false);
    report.features.details = true;
    await navigate("project-details.html", 1181);
    assert.equal(
        await evaluate(
            "parseFloat(getComputedStyle(document.querySelector('.project-details__summary')).marginTop) + parseFloat(getComputedStyle(document.body).getPropertyValue('--hero-summary-overlap'))",
        ),
        -15,
    );
    await call("Emulation.setDeviceMetricsOverride", {
        width: 1180,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await delay(100);
    assert.equal(
        await evaluate(
            "parseFloat(getComputedStyle(document.querySelector('.project-details__summary')).marginTop) + parseFloat(getComputedStyle(document.body).getPropertyValue('--hero-summary-overlap'))",
        ),
        0,
    );
    report.features.projectSpacing = true;
    for (const filename of ["articles.html", "industries.html"]) {
        await navigate(filename, 1500);
        const button = filename === "articles.html" ? ".articles-load-more > button" : ".catalog-more__button";
        if (filename === "articles.html")
            assert.equal(
                await evaluate(
                    "getComputedStyle(document.querySelector('.articles-search__filter:not(.is-active)')).backgroundColor",
                ),
                "rgba(0, 0, 0, 0)",
            );
        assert.equal(
            await evaluate(
                `getComputedStyle(document.querySelector('${button} .site-text-link__label')).textDecorationLine`,
            ),
            "none",
        );
        await hover(button);
        assert.equal(
            await evaluate(
                `getComputedStyle(document.querySelector('${button} .site-text-link__label')).textDecorationLine`,
            ),
            "underline",
        );
    }
    report.features.filtersAndHover = true;
    for (const width of [1500, 390]) {
        await navigate("products.html", width);
        assert.deepEqual(
            await evaluate("document.querySelector('[data-products-page]').__productMotion.getConfig()"),
            approvedMotion,
            "Apply the approved exported settings",
        );
        const motion = await evaluate(
            `(async()=>{const root=document.querySelector('[data-products-page]'),api=root.__productMotion,id=root.querySelector('[data-pcm-select]').dataset.pcmSelect;const back=root.querySelector(".pcm-back"),gaps=[],widths=[];let visibleWhileBusy=false;let running=true,previous=performance.now();function frame(t){if(api.getState().busy&&back.getClientRects().length)visibleWhileBusy=true;widths.push(root.querySelector(".pcm-stage").getBoundingClientRect().width);gaps.push(t-previous);previous=t;if(running)requestAnimationFrame(frame)}requestAnimationFrame(frame);const started=performance.now();const opening=api.select(id),openingBackHidden=back.getClientRects().length===0;await opening;const selectedBackVisible=back.getClientRects().length>0;const open=performance.now()-started;const stage=root.querySelector('.pcm-stage'),expanded=root.querySelector('.pcm-expanded');const openHeight=stage.getBoundingClientRect().height;const expandedHeight=expanded.getBoundingClientRect().height;let landedHeight,landedOpacity,landedGhosts;root.addEventListener('product-motion:landed',()=>{landedHeight=stage.getBoundingClientRect().height;landedOpacity=getComputedStyle(root.querySelector("[data-pcm-select]").closest(".featured-card")).opacity;landedGhosts=root.querySelectorAll(".pcm-image-ghost,.pcm-surface,.pcm-copy-ghost").length},{once:true});const closing=performance.now();const returning=api.select(null),closingBackHidden=back.getClientRects().length===0;await returning;running=false;return {openingBackHidden,selectedBackVisible,closingBackHidden,finalBackHidden:back.getClientRects().length===0,visibleWhileBusy,open,close:performance.now()-closing,openHeight,expandedHeight,landedHeight,landedOpacity,landedGhosts,widthChange:Math.max(...widths)-Math.min(...widths),finalHeight:stage.getBoundingClientRect().height,state:api.getState(),maxGap:Math.max(...gaps)};})()`,
        );
        assert(motion.openingBackHidden, "Return control is absent during opening");
        assert(motion.selectedBackVisible, "Return control appears after the complete transition");
        assert(motion.closingBackHidden && motion.finalBackHidden, "Return control hides when returning starts");
        assert(!motion.visibleWhileBusy, "No return control flashes during animated frames");
        assert(Math.abs(motion.openHeight - motion.expandedHeight) < 1);
        assert(Math.abs(motion.landedHeight - motion.finalHeight) < 1, "No height jump at return handoff");
        assert(motion.widthChange < 0.5, "No width jump from a transient scrollbar");
        assert.equal(motion.landedOpacity, "1", "The returned card is opaque at landing");
        assert.equal(motion.landedGhosts, 0, "No overlapping image or surface after landing");
        assert.equal(motion.state.current, null);
        assert.equal(motion.state.busy, false);
        assert(
            motion.open < motionTimeline(approvedMotion, 6).total + 800 &&
                motion.close < motionTimeline(approvedMotion, 6, true).total + 800,
            "Animations respect the approved timeline and finish without getting stuck",
        );
        report.features[`motion${width}`] = motion;
        await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        assert(await evaluate("document.querySelector('[data-products-page]').__productMotion.getState().reduced"));
        await evaluate(
            "(async()=>{const r=document.querySelector('[data-products-page]'),a=r.__productMotion;await a.select(r.querySelector('[data-pcm-select]').dataset.pcmSelect);await a.select(null);})()",
        );
        await call("Emulation.setEmulatedMedia", { features: [] });
    }
    // Backend auth: no CSRF means no request; with a server token, verify the
    // real submitted contract against a synthetic HTTP response, not a UI flag.
    await navigate("index.html", 1500);
    const authRequests = [];
    let authResponse = { ok: true, user: { id: "browser-contract-test" } };
    await call("Fetch.enable", { patterns: [{ urlPattern: "*/api/auth/*", requestStage: "Request" }] });
    page.ws.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.method !== "Fetch.requestPaused") return;
        const { request, requestId } = message.params;
        authRequests.push(request);
        call("Fetch.fulfillRequest", {
            requestId,
            responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify(authResponse)).toString("base64"),
        }).catch(console.error);
    });
    const login = `(()=>{document.querySelector('[data-auth-open="login"]').click();const f=document.querySelector('[data-auth-form="login"]');f.elements.identifier.value='user@example.com';f.elements.password.value='Example!234567';f.requestSubmit();})()`;
    await evaluate(login);
    await delay(250);
    assert.equal(authRequests.length, 0, "Do not transmit credentials without CSRF");
    await evaluate(
        "(()=>{const meta=document.createElement('meta');meta.name='csrf-token';meta.content='browser-contract-token';document.head.append(meta);window.__authSuccess=false;document.addEventListener('auth:success',()=>window.__authSuccess=true,{once:true});})()",
    );
    await evaluate(login);
    await waitFor("window.__authSuccess===true");
    assert.equal(authRequests.length, 1);
    assert.equal(authRequests[0].method, "POST");
    assert.equal(new URL(authRequests[0].url).origin, new URL(base).origin);
    assert.equal(
        Object.entries(authRequests[0].headers).find(([name]) => name.toLowerCase() === "x-csrf-token")?.[1],
        "browser-contract-token",
    );
    assert.equal(JSON.parse(authRequests[0].postData).identifier, "user@example.com");
    report.features.authContract = true;
    authResponse = { ok: true, challengeId: {}, retryAfter: 60 };
    await evaluate(
        "(()=>{document.querySelector('[data-auth-view=\"forgot\"]').click();const f=document.querySelector('[data-auth-form=\"forgot\"]');f.elements.identifier.value='user@example.com';f.requestSubmit()})()",
    );
    await waitFor("document.querySelector('[data-auth-modal]').getAttribute('aria-busy')==='false'");
    assert.equal(await evaluate("document.querySelector('[data-auth-modal]').dataset.view"), "forgot");
    assert(await evaluate("!document.querySelector('[data-auth-status]').hidden"), "Reject malformed server tokens");
    authResponse = { ok: true, challengeId: "opaque-server-challenge", retryAfter: "invalid" };
    await evaluate("document.querySelector('[data-auth-form=\"forgot\"]').requestSubmit()");
    await waitFor("document.querySelector('[data-auth-modal]').dataset.view==='otp'");
    assert(
        await evaluate("!document.querySelector('[data-resend]').textContent.includes('NaN')"),
        "Malformed server cooldowns do not corrupt the countdown",
    );
    report.features.authMalformedResponses = true;
    const paste = await evaluate(`(async () => {
        const input = document.querySelector('[data-otp-digit]');
        input.focus();
        const clipboard = new DataTransfer();
        clipboard.setData('text/plain', '۱۲۳۴۵۶');
        const event = new ClipboardEvent('paste', {clipboardData:clipboard, bubbles:true, cancelable:true});
        const accepted = input.dispatchEvent(event);
        await Promise.resolve();
        input.value = '9۱۲۳۴۵۶';
        input.dispatchEvent(new InputEvent('input', {inputType:'insertFromPaste', data:'۱۲۳۴۵۶', bubbles:true}));
        return {accepted, code:[...document.querySelectorAll('[data-otp-digit]')].map(input => input.value).join('')};
    })()`);
    assert(paste.accepted, "OTP fields allow the browser's native paste");
    assert.equal(paste.code, "123456", "Persian OTP paste distributes all six digits");
    await evaluate(
        "document.querySelectorAll('[data-otp-digit]').forEach(input=>input.value='');document.querySelector('[data-otp-digit]').focus()",
    );
    await call("Input.insertText", { text: "١٢٣٤٥٦" });
    assert.equal(
        await evaluate("[...document.querySelectorAll('[data-otp-digit]')].map(input=>input.value).join('')"),
        "123456",
        "Native Arabic SMS/autofill input is normalized",
    );
    report.features.otpNativePasteAndAutofill = true;
    await call("Fetch.disable");
    await navigate("contact.html", 390);
    const upload = await evaluate(
        `(()=>{const input=document.querySelector('[data-file-input]'),label=document.querySelector('[data-file-label]');const set=(name)=>{const dt=new DataTransfer();dt.items.add(new File(['test'],name));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))};set('unsafe.exe');const rejected=input.files.length===0;set('<img onerror=alert(1)>.pdf');return {rejected,text:label.textContent,markup:label.querySelector('img')!==null}})()`,
    );
    assert(upload.rejected);
    assert.equal(upload.text, "<img onerror=alert(1)>.pdf");
    assert.equal(upload.markup, false);
    await evaluate("document.querySelector('[data-menu-open]').click()");
    assert(await evaluate("document.querySelector('[data-mobile-menu]').getAttribute('aria-hidden')==='false'"));
    await evaluate("document.querySelector('[data-mobile-menu] [data-auth-open]').click()");
    assert(
        await evaluate(
            "document.querySelector('[data-mobile-menu]').getAttribute('aria-hidden')==='true'&&document.querySelector('[data-auth-modal]').open&&!document.querySelector('[data-auth-modal]').inert",
        ),
        "Mobile menu hands focus and background control to the auth modal",
    );
    await evaluate("document.querySelector('[data-auth-modal]').close()");
    await delay(100);
    assert(
        await evaluate(
            "!document.body.classList.contains('auth-open')&&!document.body.classList.contains('menu-open')",
        ),
    );
    report.features.uploadAndMobileModal = true;
    mkdirSync(".cache", { recursive: true });
    writeFileSync(".cache/browser-verification.json", JSON.stringify(report, null, 2) + "\n");
    console.log(
        "PASS: 24 page/viewports; native card links, responsive spacing, filter/hover states, desktop/mobile motion, reduced motion, document fallback and protected auth contract.",
    );
} finally {
    page.ws.close();
    await browser.call("Target.disposeBrowserContext", { browserContextId });
    browser.ws.close();
}
