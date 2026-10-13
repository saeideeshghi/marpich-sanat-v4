// Edits actual shared SVG settings. The preview remains the real current page.
import { PATTERN_HELP } from "./pattern-help.js";
import { applyPatternPreset } from "./pattern-presets.js";
const fields = [
    [
        "جای پترن و وضوح",
        "profile",
        [
            ["width", "عرض (%)", 1, 500],
            ["height", "ارتفاع مبنا (px)", 1, 2400],
            ["x", "فاصله چپ (%)", -200, 200],
            ["y", "فاصله بالا (%)", -200, 200],
            ["rotation", "چرخش", -180, 180],
            ["scaleY", "کشش عمودی (%)", 1, 400],
            ["opacity", "وضوح (%)", 0, 100],
            ["flipX", "برعکس افقی", "boolean"],
            ["fillHost", "پوشاندن تمام ارتفاع", "boolean"],
            ["fadeLeft", "محو لبه چپ", 0, 100],
            ["fadeStart", "شروع محوشدن", 0, 100],
            ["fadeEnd", "پایان محوشدن", 0, 100],
            ["motion", "مقدار موج (%)", 0, 400],
            ["light", "مقدار نور (%)", 0, 300],
            ["motionSpeed", "سرعت این اندازه", 0, 10],
        ],
    ],
    [
        "انیمیشن این اندازه",
        "animation",
        [
            ["mode", "حالت", ["none", "wave", "light", "combined"]],
            ["speed", "سرعت", 0, 10],
            ["minStrokeWidth", "حداقل ضخامت پیکسلی (px)", 0, 2],
            ["amplitude", "دامنه موج", 0, 100],
            ["period", "دوره موج (ثانیه)", 0.05, 600],
            ["cycles", "تعداد موج", 0.1, 10],
            ["phaseStep", "فاصله فاز مسیرها", 0, 10],
            ["direction", "جهت موج", [1, -1]],
            ["lightPeriod", "دوره نور", 0.05, 600],
            ["lightPause", "مکث نور", 0, 120],
            ["lightWidth", "عرض نور", 1, 2000],
            ["lightIntensity", "شدت نور", 0, 300],
            ["lightColor", "رنگ نور", "color"],
            ["coreColor", "رنگ مرکز نور", "color"],
            ["lightDirection", "جهت نور", [1, -1]],
            ["easing", "حرکت", ["linear", "smooth"]],
            ["glow", "درخشش", 0, 30],
            ["pulse", "ضربان (%)", 0, 100],
            ["pulsePeriod", "دوره ضربان", 0.05, 600],
            ["entrance", "ورود", ["none", "fade", "reveal"]],
            ["entranceDuration", "زمان ورود", 0.05, 600],
            ["entranceDelay", "تأخیر ورود", 0, 60],
            ["respectReducedMotion", "رعایت کاهش حرکت دستگاه", "boolean"],
        ],
    ],
    [
        "مسیر انتخاب‌شده",
        "line",
        [
            ["visible", "نمایش مسیر", "boolean"],
            ["opacity", "وضوح مسیر (%)", 0, 100],
            ["thickness", "ضخامت", 0, 40],
            ["x", "جابجایی افقی", -2000, 2000],
            ["y", "جابجایی عمودی", -2000, 2000],
            ["rotation", "چرخش مسیر", -180, 180],
            ["scaleX", "کشش افقی (%)", 1, 400],
            ["scaleY", "کشش عمودی (%)", 1, 400],
            ["gradientAngle", "چرخش گرادینت", -180, 180],
            ["gradientScale", "اندازه گرادینت (%)", 1, 400],
            ["gradientShift", "جابجایی گرادینت", -200, 200],
            ["wave", "موج مسیر (%)", 0, 300],
            ["speed", "سرعت مسیر", 0, 10],
            ["phase", "فاز (درجه)", -180, 180],
            ["delay", "تأخیر", 0, 60],
            ["light", "نور مسیر (%)", 0, 300],
        ],
    ],
];
const labels = {
    none: "خاموش",
    wave: "موج",
    light: "نور",
    combined: "موج و نور",
    linear: "یکنواخت",
    smooth: "نرم",
    fade: "محو",
    reveal: "نمایان‌شدن",
    1: "جلو",
    "-1": "عقب",
};
export function createPatternEditor({ container, getConfig, commit, preview, setWidth, getWidth, locate, message }) {
    let kind = "footer",
        profile = "mobile",
        lineIndex = 0,
        paused = false,
        signature = "";
    const controls = [];
    container.innerHTML = `
        <p class="mps-help">پترن‌ها روی همهٔ صفحه‌ها مشترک‌اند؛ هندسه، مسیرها و انیمیشن هر اندازه مستقل است. حرکت پیوسته را خود مرورگر اجرا می‌کند؛ نیازی به تنظیم FPS نیست.</p>
        <div class="mps-scope-row">
            <label>پترن<select id="pattern-kind"><option value="footer">فوتر</option><option value="header">هدر</option></select></label>
            <label>اندازه<select id="pattern-profile"><option value="desktop">دسکتاپ</option><option value="tablet">تبلت</option><option value="mobile">موبایل</option></select></label>
        </div>
        <details class="mps-panel" open>
            <summary>رفع پرش و انتخاب تنظیمات</summary>
            <p class="mps-help">اول هدر/فوتر و اندازه را انتخاب کن. «حرکت ملایم» تنظیم آرام آماده را اعمال می‌کند؛ برای مرورگر کند، «فقط نور» تغییر شکل موج را خاموش می‌کند. هر دکمه فقط همین اندازه و همین پترن را تغییر می‌دهد و با Undo برمی‌گردد.</p>
            <div class="mps-selection-actions">
                <button type="button" id="pattern-preset-calm" class="mps-link">حرکت ملایم</button>
                <button type="button" id="pattern-preset-light" class="mps-link">نسخه سبک · فقط نور</button>
            </div>
            <p class="mps-help">با زوم ۱۰۰٪ بررسی کن. برای خطوط محو و بریده: «حداقل ضخامت پیکسلی» را ۱ یا ۱٫۲ بگذار. برای حرکت آرام‌تر: سرعت ۰٫۵، دوره موج ۳۰ تا ۳۶ ثانیه، دوره نور ۱۸ تا ۲۴ ثانیه؛ درخشش و ضربان صفر. ضخامت پیکسلی با ضخامت مسیر SVG فرق دارد.</p>
            <p class="mps-help">برای شروع و تکرار بدون مکث: «مکث نور» و «تأخیر ورود» صفر، ورود «بدون ورود» و تأخیر هر مسیر صفر باشد. نور تکرارشونده از داخل طرح شروع می‌شود؛ هر دو حالت حرکت یکنواخت و نرم در مرز چرخه ادامه دارند.</p>
            <p id="pattern-motion-status" class="mps-help" role="status" aria-live="polite"></p>
        </details>
        <div class="mps-selection-actions" style="margin-top:12px"><button id="pattern-locate" class="mps-link">رفتن به پترن</button><button id="pattern-pause" class="mps-link">مکث انیمیشن</button></div>
        <label class="mps-help">مسیر SVG<select id="pattern-line"></select></label>
        <div id="pattern-fields"></div><div id="pattern-stops"></div>
        <label class="mps-help">وارد کردن JSON پترن<input id="pattern-import" type="file" accept=".json"></label>
    `;
    const $ = (id) => container.querySelector("#" + id),
        config = () => getConfig().patterns?.[kind],
        p = () => config()?.profiles[profile];
    const object = (type) =>
        type === "profile"
            ? p()
            : type === "animation"
              ? { ...config().animation, ...p().animation }
              : config().artworks[p().artwork].lines[lineIndex];
    const change = (type, key, value) => {
        try {
            const next = structuredClone(getConfig()),
                pattern = next.patterns[kind],
                part = pattern.profiles[profile];
            const dest =
                type === "profile"
                    ? part
                    : type === "animation"
                      ? (part.animation ||= {})
                      : pattern.artworks[part.artwork].lines[lineIndex];
            dest[key] = value;
            commit(next, `pattern:${kind}:${profile}:${type}:${lineIndex}:${key}`);
            preview(paused);
            render();
        } catch (error) {
            message(error.message, true);
        }
    };
    for (const [title, type, definitions] of fields) {
        const panel = document.createElement("details");
        panel.className = "mps-panel";
        panel.open = type === "profile";
        const summary = document.createElement("summary");
        summary.textContent = title;
        const grid = document.createElement("div");
        grid.className = "mps-panel__fields";
        panel.append(summary, grid);
        $("pattern-fields").append(panel);
        for (const [key, label, spec, minmax] of definitions) {
            const field = document.createElement("label");
            field.className = "mps-field";
            const text = document.createElement("span");
            text.className = "mps-field__label";
            text.textContent = label;
            field.append(text);
            let input;
            if (Array.isArray(spec)) {
                input = document.createElement("select");
                for (const value of spec) {
                    const o = document.createElement("option");
                    o.value = value;
                    o.textContent = labels[value] || value;
                    input.append(o);
                }
            } else {
                input = document.createElement("input");
                input.type = spec === "boolean" ? "checkbox" : spec === "color" ? "color" : "number";
                if (input.type === "number") {
                    input.min = spec;
                    input.max = minmax;
                    input.step =
                        Number.isInteger(spec) &&
                        ![
                            "speed",
                            "motionSpeed",
                            "thickness",
                            "phase",
                            "gradientAngle",
                            "rotation",
                            "x",
                            "y",
                            "opacity",
                        ].includes(key)
                            ? "1"
                            : "0.1";
                    if (key === "minStrokeWidth") input.step = "0.05";
                }
            }
            input.id = `pattern-${type}-${key}`;
            field.append(input);
            const help = document.createElement("small");
            help.className = "mps-pattern-help";
            help.id = `${input.id}-help`;
            help.textContent = PATTERN_HELP[type][key];
            input.setAttribute("aria-describedby", help.id);
            field.append(help);
            grid.append(field);
            controls.push({ type, key, input });
            input.addEventListener(input.type === "number" ? "input" : "change", () => {
                if (input.type === "number" && !input.value) return;
                change(
                    type,
                    key,
                    input.type === "checkbox"
                        ? input.checked
                        : input.type === "number" || ["direction", "lightDirection"].includes(key)
                          ? Number(input.value)
                          : input.value,
                );
            });
        }
    }
    const chooseProfile = () => {
        profile = $("pattern-profile").value;
        lineIndex = 0;
        signature = "";
        setWidth(profile === "desktop" ? 1440 : profile === "tablet" ? 820 : 390, profile);
        render();
        locate(kind);
    };
    $("pattern-kind").addEventListener("change", () => {
        kind = $("pattern-kind").value;
        lineIndex = 0;
        signature = "";
        render();
        locate(kind);
    });
    $("pattern-profile").addEventListener("change", chooseProfile);
    $("pattern-line").addEventListener("change", () => {
        lineIndex = Number($("pattern-line").value);
        signature = "";
        render();
    });
    $("pattern-locate").addEventListener("click", () => locate(kind));
    for (const preset of ["calm", "light"]) {
        $("pattern-preset-" + preset).addEventListener("click", () => {
            try {
                const next = structuredClone(getConfig());
                applyPatternPreset(next.patterns[kind], profile, preset);
                commit(next);
                preview(paused);
                render();
                $("pattern-animation-minStrokeWidth").closest("details").open = true;
                message("تنظیم آماده روی همین پترن و اندازه اعمال شد؛ با Undo قابل برگشت است.");
            } catch (error) {
                message(error.message, true);
            }
        });
    }
    $("pattern-pause").addEventListener("click", () => {
        paused = !paused;
        $("pattern-pause").textContent = paused ? "پخش انیمیشن" : "مکث انیمیشن";
        preview(paused);
    });
    $("pattern-import").addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            if (file.size > 1500000) throw Error("فایل بیش از حد بزرگ است.");
            const next = structuredClone(getConfig());
            next.patterns[kind] = JSON.parse(await file.text());
            commit(next);
            signature = "";
            render();
            preview(paused);
        } catch (error) {
            message(error.message, true);
        }
        event.target.value = "";
    });
    function render() {
        if (!config()) return;
        $("pattern-kind").value = kind;
        $("pattern-profile").value = profile;
        let guide = $("pattern-profile-help");
        if (!guide) {
            guide = document.createElement("p");
            guide.id = "pattern-profile-help";
            guide.className = "mps-help";
            container.querySelector(".mps-scope-row").after(guide);
            for (const id of ["pattern-kind", "pattern-profile", "pattern-line", "pattern-import"])
                $(id).setAttribute("aria-describedby", guide.id);
        }
        const breakpoint = kind === "header" ? 640 : config().breakpoint;
        guide.textContent = `تنظیمات ${kind === "header" ? "هدر" : "فوتر"} در همهٔ صفحه‌ها مشترک است. موبایل: عرض کمتر از ${breakpoint}px؛ تبلت: ${breakpoint} تا ۱۱۷۹؛ دسکتاپ: ۱۱۸۰ به بالا. «مسیر SVG» فقط یکی از خطوط طرح را برای ویرایش انتخاب می‌کند. JSON، تنظیمات همین پترن را جایگزین می‌کند. برای ارتفاع خودِ هیرو یا هدر از تب استایل استفاده کن.`;
        const lines = config().artworks[p().artwork].lines;
        if (lineIndex >= lines.length) lineIndex = 0;
        if ($("pattern-line").options.length !== lines.length) {
            $("pattern-line").replaceChildren();
            lines.forEach((line, index) => {
                const o = document.createElement("option");
                o.value = index;
                o.textContent = line.name || `مسیر ${index + 1}`;
                $("pattern-line").append(o);
            });
        }
        $("pattern-line").value = lineIndex;
        for (const { type, key, input } of controls) {
            if (input === document.activeElement) continue;
            const value =
                object(type)?.[key] ?? (key === "fillHost" ? kind === "footer" && profile === "mobile" : false);
            if (input.type === "checkbox") input.checked = Boolean(value);
            else input.value = value;
        }
        const line = object("line"),
            nextSignature = `${kind}:${profile}:${lineIndex}:${line.stops.length}`;
        const motion = object("animation");
        const rate = motion.speed * p().motionSpeed * line.speed;
        const seconds = (value) => (rate > 0 ? `${(value / rate).toFixed(1)} ثانیه` : "متوقف");
        const wave = ["wave", "combined"].includes(motion.mode) && line.wave > 0;
        const light = ["light", "combined"].includes(motion.mode) && line.light > 0;
        $("pattern-motion-status").textContent =
            `مدت واقعی مسیر انتخاب‌شده با همهٔ ضریب‌های سرعت: موج ${wave ? seconds(motion.period) : "خاموش"}؛ نور ${light ? seconds(motion.lightPeriod + motion.lightPause) : "خاموش"}. زوم پیش‌نمایش این زمان‌ها را عوض نمی‌کند.`;
        if (signature !== nextSignature) {
            signature = nextSignature;
            $("pattern-stops").replaceChildren();
            const title = document.createElement("p");
            title.className = "mps-help";
            title.textContent = "رنگ‌های گرادینت این مسیر";
            $("pattern-stops").append(title);
            line.stops.forEach((stop, index) => {
                const row = document.createElement("div");
                row.className = "mps-pattern-stop";
                for (const [key, type, min, max, step] of [
                    ["color", "color"],
                    ["offset", "number", 0, 100, 1],
                    ["opacity", "number", 0, 1, 0.01],
                ]) {
                    const input = document.createElement("input");
                    input.type = type;
                    input.value = stop[key];
                    const label = document.createElement("label");
                    label.className = "mps-pattern-stop__field";
                    const text = document.createElement("span");
                    text.textContent = key === "color" ? "رنگ" : key === "offset" ? "جای رنگ (%)" : "وضوح رنگ (۰ تا ۱)";
                    input.id = `pattern-stop-${index}-${key}`;
                    const help = document.createElement("small");
                    help.id = `${input.id}-help`;
                    help.className = "mps-pattern-help";
                    help.textContent = PATTERN_HELP.stops[key];
                    input.setAttribute("aria-describedby", help.id);
                    if (type === "number") {
                        input.min = min;
                        input.max = max;
                        input.step = step;
                    }
                    input.dataset.stop = index;
                    input.dataset.key = key;
                    input.addEventListener(type === "color" ? "change" : "input", () => {
                        try {
                            if (!input.value) return;
                            const next = structuredClone(getConfig()),
                                pat = next.patterns[kind],
                                stops = pat.artworks[pat.profiles[profile].artwork].lines[lineIndex].stops;
                            stops[index][key] = type === "color" ? input.value : Number(input.value);
                            commit(next, `stop:${kind}:${profile}:${lineIndex}:${index}:${key}`);
                            preview(paused);
                        } catch (error) {
                            message(error.message, true);
                        }
                    });
                    label.append(text, input, help);
                    row.append(label);
                }
                $("pattern-stops").append(row);
            });
        } else
            for (const input of $("pattern-stops").querySelectorAll("input"))
                if (input !== document.activeElement)
                    input.value = line.stops[Number(input.dataset.stop)][input.dataset.key];
    }
    return {
        render,
        open() {
            const width = getWidth();
            profile =
                width >= 1180
                    ? "desktop"
                    : width >= (kind === "header" ? 640 : config().breakpoint)
                      ? "tablet"
                      : "mobile";
            signature = "";
            render();
            locate(kind);
        },
        get paused() {
            return paused;
        },
    };
}
