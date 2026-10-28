import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { allPages } from "../build/pages.js";
import { browserClient, delay } from "./browser-client.js";
const client = await browserClient();
const { evaluate, navigate, waitFor, call } = client;
const report = { date: new Date().toISOString(), base: client.base, pages: [], features: {} };
try {
    const widths = process.env.PAGE_WIDTHS ? process.env.PAGE_WIDTHS.split(",").map(Number) : [1500, 390];
    for (const width of widths)
        for (const page of allPages) {
            await navigate(page.file, width);
            const data = await evaluate(String.raw`(() => {
            const lang=document.documentElement.lang;
            const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
            const untranslated=[];
            while(walker.nextNode()){
                const n=walker.currentNode,p=n.parentElement;
                if(p.closest('script,style,[lang="fa"],[lang="ar"]'))continue;
                if(lang==='en'&&/[\u0600-\u06ff]/.test(n.textContent)&&p.getClientRects().length&&getComputedStyle(p).visibility!=='hidden')untranslated.push(n.textContent.trim());
            }
            return { lang, direction:getComputedStyle(document.body).direction, page:document.body.dataset.page,
                overflow:document.documentElement.scrollWidth-innerWidth, bodyFont:getComputedStyle(document.body).fontFamily,
                titleFont:getComputedStyle(document.querySelector('h1')).fontFamily, untranslated,
                dialogDirection:getComputedStyle(document.querySelector('[data-auth-modal]')).direction,
                images:[...document.images].filter(i=>i.getAttribute('src')&&i.getClientRects().length&&i.loading!=='lazy'&&i.complete&&!i.naturalWidth).map(i=>i.src),
                links:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>/^\/(?:en\/|ar\/)?[\w-]+\.html/.test(h)),
                css:[...document.styleSheets].map(s=>s.href).filter(Boolean),
                badge:[...document.querySelectorAll('[data-language-toggle]')].map(e=>e.textContent.trim()),
                current:[...document.querySelectorAll('[data-language-option][aria-current]')].map(e=>e.dataset.languageOption)
            };
        })()`);
            const locale = page.locale || "fa";
            assert.equal(data.lang, locale, page.file);
            assert.equal(data.direction, locale === "en" ? "ltr" : "rtl", page.file);
            assert.equal(data.page, page.sourceName || page.name, page.file);
            assert(data.overflow <= 1, page.file + " at " + width + ": overflow " + data.overflow);
            assert.deepEqual(data.images, [], page.file + ": missing images");
            assert.deepEqual(data.untranslated, [], page.file + ": Persian copy in English");
            if (locale === "en") {
                assert(data.bodyFont.includes("D-DIN"), "English body font");
                assert(data.titleFont.includes("Montserrat"), "English heading font");
                assert.equal(data.dialogDirection, "ltr", "English dialog text direction");
                assert(
                    data.css.every((url) => !url.includes("Peyda")),
                    "English font selection",
                );
            } else assert(data.bodyFont.includes("Peyda"), "Keep existing Persian/Arabic family");
            for (const href of data.links)
                assert(
                    href.startsWith("/" + (locale === "fa" ? "" : locale + "/")),
                    page.file + ": cross-language internal link " + href,
                );
            assert(
                data.badge.every((label) => label.includes(locale.toUpperCase())),
                "Current language badge: " + page.file,
            );
            assert(
                data.current.every((code) => code === locale),
                "Current language selection: " + page.file,
            );
            const errors = client.events.filter(
                (e) =>
                    e.method === "Runtime.exceptionThrown" ||
                    (e.method === "Log.entryAdded" && ["error", "warning"].includes(e.params.entry.level)),
            );
            assert.equal(errors.length, 0, page.file + ": console " + JSON.stringify(errors));
            report.pages.push({ file: page.file, width, ...data });
            if (
                ["en/index.html", "ar/index.html", "en/contact.html", "ar/products.html", "en/articles.html"].includes(
                    page.file,
                )
            )
                await client.screenshot(page.file.replace(".html", "").replace("/", "-") + "-" + width);
            console.log("PASS " + page.file + " @ " + width);
        }
    for (const locale of ["en", "ar"]) {
        await navigate(locale + "/articles.html");
        const result = await evaluate(
            String.raw`(()=>{const q=document.querySelector('[data-articles-query]');q.value='__no_article_matches__';document.querySelector('[data-articles-search]').requestSubmit();return {count:[...document.querySelectorAll('[data-article-card]')].filter(e=>!e.hidden).length,status:document.querySelector('[data-articles-search-status]').textContent,empty:!document.querySelector('[data-articles-empty]').hidden}})()`,
        );
        assert.equal(result.count, 0);
        assert(result.empty);
        assert(locale === "en" ? /0.*articles/i.test(result.status) : /٠/.test(result.status), result.status);
        await navigate(locale + "/products.html", 390);
        const motion = await evaluate(
            String.raw`(async()=>{const r=document.querySelector('[data-products-page]'),a=r.__productMotion;await a.select(r.querySelector('[data-pcm-select]').dataset.pcmSelect);const text=r.querySelector('.pcm-expanded').textContent;await a.select(null);return {text,state:a.getState(),overflow:document.documentElement.scrollWidth-innerWidth}})()`,
        );
        assert.equal(motion.state.busy, false);
        assert.equal(motion.state.current, null);
        assert(motion.overflow <= 1);
        if (locale === "en") assert(!/[\u0600-\u06ff]/.test(motion.text), "Expanded category is English");
        await navigate(locale + "/contact.html", 390);
        const upload = await evaluate(
            String.raw`(()=>{const i=document.querySelector('[data-file-input]'),dt=new DataTransfer();dt.items.add(new File(['test'],'unsafe.exe'));i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));return {count:i.files.length,text:document.querySelector('[data-file-label]').textContent}})()`,
        );
        assert.equal(upload.count, 0);
        if (locale === "en") assert(!/[\u0600-\u06ff]/.test(upload.text));
        await evaluate(
            "document.querySelector('[data-menu-open]').click();document.querySelector('[data-mobile-menu] [data-auth-open]').click()",
        );
        assert(
            await evaluate(
                "document.querySelector('[data-auth-modal]').open&&document.querySelector('[data-mobile-menu]').getAttribute('aria-hidden')==='true'",
            ),
        );
        await evaluate("document.querySelector('[data-auth-modal]').close()");
        await navigate(locale + "/product-details.html#technical");
        const destination = locale === "en" ? "ar" : "en";
        await evaluate(
            "document.querySelector('[data-language-toggle]').click();document.querySelector('[data-language-option=\"" +
                destination +
                "\"]').click()",
        );
        await waitFor(
            "document.documentElement.lang==='" + destination + "'&&document.body?.dataset.siteReady==='true'",
        );
        assert(
            await evaluate(
                "location.pathname==='/'+'" + destination + "'+'/product-details.html'&&location.hash==='#technical'",
            ),
        );
        report.features[locale] = {
            articleSearch: true,
            categoryMotion: true,
            uploadValidation: true,
            mobileModal: true,
            samePageLanguageSwitch: true,
        };
    }
    writeFileSync(
        ".cache/browser-locales" + (process.env.PAGE_WIDTHS ? "-breakpoints" : "") + ".json",
        JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
        "PASS: " +
            report.pages.length +
            " page/viewports, localized fonts/navigation, search, category motion, upload validation and mobile dialogs.",
    );
} finally {
    await client.close();
}
