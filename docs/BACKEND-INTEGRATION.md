# راهنمای اتصال Backend مارپیچ صنعت

این سند قرارداد اتصال به همین سورس را توضیح می‌دهد. مسیرهای CMS و درخواست‌ها در بخش‌های پیشنهادی هنوز پیاده‌سازی نشده‌اند. فقط قرارداد پنج عملیات auth در Frontend موجود است. پیشنهاد اجرایی، ASP.NET Core MVC/Razor با رندر سمت سرور و APIهای هم‌دامنه برای فرم‌ها و Auth است؛ نسخهٔ Framework و پایگاه داده با تیم Backend تعیین شود.

## ۱۰. روش پیشنهادی مهاجرت

صفحات عمومی با Razor از دیتابیس رندر شوند؛ فایل‌های CSS و JS فعلی برای نمایش و تعامل باقی بمانند. این روش به همین ساختار چندصفحه‌ای نزدیک است و مسیرها، SEO، خطای 404 و لینک محتوای واقعی را در اختیار Backend قرار می‌دهد.

| مرحله             | کار مشخص                                                     | معیار تحویل                                   |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------- |
| ۱. پوسته          | Build معمولی Vite، انتقال Assetها، Layout و Partialهای مشترک | Home و About با همان ظاهر در ASP.NET باز شوند |
| ۲. محتوای خواندنی | یک Product و یک Project با slug، ViewModel و روابط           | صفحهٔ جزئیات واقعی و 404 برای slug نامعتبر    |
| ۳. درخواست        | Consultation و RFQ، ذخیره و پاسخ دارای requestId             | درخواست واقعی در پنل مدیر دیده شود            |
| ۴. Auth           | Session، OTP، Register و Password Reset با سرویس واقعی       | ورود و خروج واقعی و خطاهای قابل‌نمایش         |
| ۵. CMS و جستجو    | فهرست‌ها، فیلتر، Pagination، محتوا و Media                   | URL فیلتر قابل اشتراک و مدیریت محتوای صفحات   |
| ۶. انتشار         | لینک‌های نهایی، SEO، Assetهای کامل و کنترل ریسپانسیو         | محیط Staging تأیید و سپس Production منتشر شود |

پروژهٔ Frontend فعلی را مرجع طراحی نگه دارید. ابتدا یک صفحهٔ کامل را با Assetهای ساخته‌شده منتقل کنید و پس از تطبیق ظاهر، بقیه را تبدیل کنید. بازنویسی هم‌زمان CSS و مدل محتوا در مرحلهٔ اول، تشخیص علت اختلاف ظاهر را سخت می‌کند.

## ۱۱. نگاشت HTML به Razor

| فایل فعلی                                     | مقصد پیشنهادی                                              |
| --------------------------------------------- | ---------------------------------------------------------- |
| src/components/header.html                    | Views/Shared/_Header.cshtml                                |
| src/components/mobile-menu.html               | Views/Shared/_MobileMenu.cshtml                            |
| src/components/footer.html                    | Views/Shared/_Footer.cshtml                                |
| src/components/auth-modal.html                | Views/Shared/_AuthModal.cshtml                             |
| consultation.html و catalog-consultation.html | Partial یا ViewComponent با ViewModel مخصوص فرم            |
| product-card.html                             | _ProductCard.cshtml با ProductCardViewModel                |
| faq و testimonial templateها                  | Partialهای حلقه‌ای با ID یکتا                              |
| فایل‌های HTML ریشه                            | View هر Controller؛ Layout مشترک Head و Footer را نگه دارد |

_Layout.cshtml شامل lang="fa"، dir="rtl"، Metadata، Header، Menu، Auth، RenderBody و فایل‌های صفحه است. body[data-page] را از نام داخلی صفحه مقداردهی کنید؛ مثلاً About با about و صفحهٔ اصلی با home. مقدار activeNav را براساس registry فعلی یا مدل Navigation حفظ کنید.

مثال پوستهٔ سادهٔ About؛ Model و AssetResolver در این مثال قرارداد پیشنهادی‌اند و باید در Backend نوشته شوند:

```cshtml
<body class="about-page" data-page="about">
    <partial name="_Header" model="Model.Navigation" />
    <partial name="_MobileMenu" model="Model.Navigation" />
    @RenderBody()
    <partial name="_Footer" model="Model.Footer" />
    <partial name="_AuthModal" />
</body>
```

برای پرهیز از تکرار body، این ساختار در Layout قرار می‌گیرد و View فقط محتوای داخل صفحه را می‌نویسد. نام همهٔ Classها، data-*های رفتاری، نام فیلد فرم و IDهای وابسته به aria را حفظ کنید. هر کامپوننت تکراری، مثل FAQ، ID اختصاصی دریافت کند.

متن معمولی را با خروجی Escapeشدهٔ Razor رندر کنید. برای Rich Text، HTML را در Backend با Allowlist پاک‌سازی کنید؛ Html.Raw برای متن ورودی بدون Sanitization مناسب نیست. URL تصویر، دانلود و لینک نیز جدا از Escape متن اعتبارسنجی شود.

## ۱۲. اتصال Vite و Manifest به ASP.NET

برای Backend از npm run build استفاده کنید؛ build:pages برای پیشوند مخزن GitHub است. خروجی Manifest در dist/.vite/manifest.json قرار دارد. Registry فعلی entryهای HTML مثل about.html و products.html را ثبت می‌کند؛ قبل از خواندن Manifest، وجود کلید همان صفحه را کنترل کنید.

۱. محتوای assets، fonts و سایر فایل‌های عمومی خروجی را با همان مسیرها به wwwroot منتقل کنید. نسخهٔ Manifest را کنار برنامه و دور از ویرایش کاربر نگه دارید.

۲. AssetResolver برای صفحه، file و css ورودی و css تمام imports آن را بازگشتی بخواند؛ فایل CSS هر چانک مشترک نیز لازم است. نام Hash فایل‌ها را در View ثابت ننویسید.

۳. CSSهای صفحه و وابستگی‌ها را بدون تکرار درج کنید. لینک ثابت assets/customizer/template-overrides.css را پس از آن‌ها قرار دهید تا Overrideها حفظ شوند. سپس script نوع module برای file ورودی اضافه شود. modulepreload برای imports اختیاری است.

۴. Assetها و Manifest را در یک Release منتقل کنید؛ HTML یا Manifest جدید کنار فایل‌های قبلیِ حذف‌شده می‌تواند 404 بسازد. در زمان Deploy، قابلیت نمایش خطا یا بررسی نبود entry را در AssetResolver قرار دهید.

CSS اولیه در نسخهٔ فعلی دو لینک مستقیم در head دارد: src/css/main.css و src/css/entries/<page>.css. نام و ترتیب CSSهای هش‌دار را از HTML ساخته‌شدهٔ همان صفحه و Manifest واقعی استخراج کنید؛ تنها دنبال‌کردن importهای JS برای جمع‌آوری CSS کافی نیست. لینک‌های CSS را در head بگذارید و بارگذاری آن‌ها را به JavaScript نسپارید.

```cshtml
@foreach (var css in Model.PageAssets.Css)
{
    <link rel="stylesheet" href="@Url.Content("~/" + css)" />
}
<link id="mps-template-overrides"
      rel="stylesheet"
      href="@Url.Content("~/assets/customizer/template-overrides.css")?v=@Model.TemplateRevision" />
<script type="module" src="@Url.Content("~/" + Model.PageAssets.Script)"></script>
```

این قطعه، ایدهٔ رندر Assetهای حل‌شده را نشان می‌دهد؛ PageAssets باید از Manifest واقعی ساخته شود. چند Import از CSS یک صفحه را با حدس‌زدن نام main.css جایگزین نکنید. ظاهر اشتباه با وجود JS سالم می‌تواند از جاافتادن CSS چانک مشترک یا بارگذاری Overrideها در ترتیب نادرست باشد.

اگر Dev Backend و Vite روی Origin جدا اجرا می‌شوند، Origin مجاز و Proxy فایل‌های استاتیک را مشخص کنید. برای شروع ساده‌تر، Build Frontend را در Staging ASP.NET سرو کنید و بعد HMR را اضافه کنید.

## ۱۳. داده و مدل CMS پیشنهادی

این جدول طرح پیشنهادی دیتابیس است، نه مدل پیاده‌شده در بسته. برای هر محتوای منتشرشونده، Slug یکتا، وضعیت پیش‌نویس/انتشار، تاریخ و فیلدهای SEO نگه دارید؛ ViewModelهای Public را از Entity داخلی جدا کنید.

| مدل                               | فیلدهای اصلی و رابطه                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| SiteSettings                      | نام شرکت، تلفن‌ها، شبکه‌ها، Footer، Navigation و تنظیمات عمومی     |
| MediaAsset                        | مسیر عمومی، نوع، اندازه، Alt، عرض/ارتفاع و وضعیت تأیید             |
| ProductCategory                   | نام، slug، توضیح، Hero و ترتیب نمایش                               |
| Product                           | نام، slug، خلاصه، توضیح، تصاویر، Category، وضعیت و دیتاشیت         |
| ProductSpecification              | ProductId، گروه، نام، مقدار، واحد و ترتیب؛ ساختار جدول از داده     |
| Project                           | عنوان، slug، خلاصه، صنعت، مشتری، مکان، تاریخ، تصاویر و دستاوردها   |
| ProjectProduct                    | ProjectId، ProductId و ترتیب؛ رابطهٔ چندبه‌چند پروژه و محصول       |
| Industry                          | نام، slug، توضیح، تصویر، کاربردها و محتوا                          |
| ProductIndustry و ProjectIndustry | روابط مرتبط برای پیشنهاد محصول و پروژه در صفحهٔ صنعت               |
| Expertise                         | عنوان، slug، توضیحات، تصویر، خدمت‌ها و بخش‌های مرتبط               |
| Article و ArticleCategory         | عنوان، slug، خلاصه، متن پاک‌سازی‌شده، تصویر، دسته، نویسنده و تاریخ |
| Testimonial                       | نام، سمت/شرکت، متن، تصویر و ارتباط اختیاری با Project یا Industry  |
| FaqItem                           | پرسش، پاسخ، محدودهٔ صفحه و ترتیب                                   |
| AboutPage و TimelineItem          | متن‌ها، مدیریت، تصویر تیم، تاریخچه، گواهینامه و گالری              |
| ContactBranch                     | دفتر تهران، دفتر مشهد و کارخانه؛ آدرس، تلفن، نقشه و ترتیب          |
| ConsultationRequest               | نام، شرکت/تماس موجود، پیام، صفحهٔ مبدا، زمان، وضعیت و کد رهگیری    |
| RfqRequest و RequestAttachment    | دادهٔ RFQ، فایل اختیاری، وضعیت و اپراتور رسیدگی                    |
| TemplateVersion                   | تنظیمات تأییدشده، CSS تولیدی، Revision و سابقهٔ انتشار             |

از ابتدا Gallery یا Timeline را به جدول نامحدود Generic بدون قرارداد تبدیل نکنید. مدل ساده و روشن برای بخش‌های فعلی کافی است؛ بخش‌بندی پیشرفتهٔ Page Builder را پس از نیاز واقعی اضافه کنید.

برای Preview مدیر، پیش‌نویس را از مسیر جدا و دسترسی‌دار نشان دهید. Query عمومی فقط محتوای منتشرشده را برگرداند. در Viewهای لیستی تعداد نتایج و ترتیب ثابت تعریف شود. Table فنی و دستاوردهای پروژه در ViewModel داده‌ای قرار گیرند؛ CSS جدول فعلی حفظ شود.

## ۱۴. فرم‌های درخواست و قرارداد اتصال

سه شکل فرم در سورس وجود دارد و نام فیلدها یکسان نیست. Normalize داده را در Adapter یا DTO سرور انجام دهید؛ فیلدهایی را که در یک فرم نیستند بدون تغییر UI اجباری نکنید.

| فرم                                     | فیلدهای فعلی                                                                  | رویداد فعلی                                      | API پیشنهادی            |
| --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------- |
| Consultation مشترک Home/About/Expertise | name، email، description                                                      | consultation:submit؛ detail شامل form و formData | POST /api/consultations |
| Consultation کاتالوگ و صفحات دیگر       | fullName، company یا phone، message                                           | همان consultation:submit                         | POST /api/consultations |
| RFQ تماس                                | fullName، company، phone، email، branch، requestType، description، attachment | rfq:submit؛ detail شامل form و formData          | POST /api/rfq           |

در فرم محصولات، فیلد دوم phone است؛ در بیشتر فرم‌های دیگر company است. قرارداد پیشنهادی Consultation می‌تواند fullName، email، phone، company، message و sourcePage داشته باشد؛ فقط فیلدهای واقعاً موجود هر فرم را ارسال کنید. name را به fullName و description را به message نگاشت کنید. sourcePage را برای گزارش ثبت کنید و برای تصمیم امنیتی قابل‌اعتماد فرض نکنید.

branch فعلی tehran و mashhad است. requestType شامل consultation، rfq، partnership و support است؛ کلیک همکاری گزینه‌های employment و installer-partnership را هم اضافه می‌کند. کارخانه کارت اطلاعات تماس است و در Dropdown فعلی گزینهٔ branch جدا ندارد.

ثبت موفق باید بعد از ذخیرهٔ قطعی، پاسخ واقعی بدهد:

```json
{
    "ok": true,
    "requestId": "REQ-2026-00125",
    "message": "درخواست ثبت شد."
}
```

برای Validation پاسخ 400 یا 422 با خطاهای فیلدی، برای حجم غیرمجاز 413، برای تعداد تلاش زیاد 429 و برای خطای سرویس 5xx در نظر بگیرید. انتخاب استاندارد نهایی با تیم Backend است؛ Adapter باید آن را به پیام فارسی و وضعیت مشخص فرم تبدیل کند.

رویداد Cancelable را پیش از اولین await با preventDefault تصاحب کنید، وگرنه پیام «سرویس فعال نیست» هم اجرا می‌شود. مثال زیر اسکلت اتصال است و در سورس فعال نشده؛ سرویس API و UI خطا باید طبق قرارداد نهایی نوشته شوند:

```javascript
const endpoints = {
    "consultation:submit": "/api/consultations",
    "rfq:submit": "/api/rfq",
};

for (const [eventName, endpoint] of Object.entries(endpoints)) {
    document.addEventListener(eventName, (event) => {
        event.preventDefault(); // Must run synchronously.
        void submitRequest(endpoint, eventName, event.detail);
    });
}

async function submitRequest(endpoint, eventName, { form, formData }) {
    if (form.dataset.submitting === "true") return;
    const status =
        form.querySelector("[data-form-status], [data-pending-status]") ||
        Object.assign(document.createElement("p"), { role: "status" });
    if (!status.isConnected) form.append(status);
    status.hidden = false;
    status.classList.remove("hidden");
    const submit = form.querySelector("[type=submit]");
    const wasDisabled = submit?.disabled;
    form.dataset.submitting = "true";
    if (submit) submit.disabled = true;
    status.textContent = "در حال ثبت…";

    if (eventName === "consultation:submit") {
        if (formData.has("name")) {
            formData.set("fullName", formData.get("name"));
            formData.delete("name");
        }
        if (formData.has("description")) {
            formData.set("message", formData.get("description"));
            formData.delete("description");
        }
    }
    formData.set("sourcePage", document.body.dataset.page || "");
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: csrf ? { "X-CSRF-TOKEN": csrf } : {},
            body: formData, // Let the browser set the multipart boundary.
            signal: AbortSignal.timeout(15000),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.ok !== true || !data.requestId)
            throw new Error(data?.message || "ثبت انجام نشد؛ دوباره تلاش کنید.");
        status.textContent = `ثبت شد؛ کد رهگیری: ${data.requestId}`;
    } catch (error) {
        status.textContent =
            error.name === "TimeoutError"
                ? "زمان پاسخ تمام شد؛ وضعیت ثبت را پیش از ارسال مجدد بررسی کنید."
                : error.message || "ارتباط برقرار نشد.";
    } finally {
        delete form.dataset.submitting;
        if (submit) submit.disabled = wasDisabled;
    }
}
```

برای جلوگیری از ثبت دو درخواست در Retry شبکه، IdempotencyKey برای هر تلاش منطقی تعریف کنید و سمت سرور تکرار همان کلید را به همان requestId برگردانید. اعلان به اپراتور می‌تواند بعد از Commit دیتابیس اجرا شود؛ خرابی ایمیل یا SMS نباید باعث گزارش شکست یک درخواست ذخیره‌شده و ثبت مجدد شود.

آپلود RFQ در Frontend اختیاری است و pdf، dwg، doc و docx تا 20 MiB را می‌پذیرد. Backend نیز اندازه و نوع فایل را بررسی کند، نام ذخیره را خودش بسازد و فایل را با نام ارسالی کاربر در wwwroot عمومی ذخیره نکند. دسترسی دانلود پیوست فقط برای صاحب درخواست یا اپراتور مجاز باشد. برای ارسال Multipart، نام property فایل DTO باید attachment باشد یا Binding آن صریح تنظیم شود.

## ۱۵. Auth و Session موجود در Frontend

auth-api.js درخواست‌ها را به Base پیش‌فرض /api/auth با POST JSON و credentials برابر same-origin می‌فرستد. برای اتصال واقعی، قبل از Build این مقادیر تنظیم شوند:

```dotenv
VITE_AUTH_MODE=api
VITE_AUTH_API_BASE=/api/auth
```

VITE_ها در Bundle مرورگر قرار می‌گیرند؛ کلید سرویس SMS و سایر Secretها باید فقط در Backend باشند. حالت Preview فقط در Dev و با OTP برابر 123456 فعال است؛ Production چنین ورود آزمایشی ندارد.

| مسیر موجود در Adapter         | Payload فعلی                                     | پاسخ موفق مورد انتظار                                          |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| POST /api/auth/login          | identifier، password، remember                   | ok: true؛ user اختیاری؛ Session Cookie واقعی                   |
| POST /api/auth/register       | fullName، identifier، password، confirmPassword  | ok: true، challengeId و retryAfter                             |
| POST /api/auth/request-code   | identifier، purpose و گاهی challengeId           | ok: true، challengeId و retryAfter                             |
| POST /api/auth/verify-code    | identifier، challengeId، purpose، code، remember | ok: true؛ برای reset حتماً resetToken؛ برای ورود Session واقعی |
| POST /api/auth/reset-password | resetToken و password                            | ok: true؛ Token یک‌بارمصرف باطل شود                            |

purpose یکی از login، register یا reset است. OTP شش‌رقمی است. Backend باید Challenge را به identifier و purpose متصل کند، انقضا و سقف تلاش داشته باشد و پیامک/ایمیل واقعی بفرستد. پاسخ 429 همراه Retry-After از UI پشتیبانی می‌شود؛ سایر خطاها از message خوانده می‌شوند.

ورود را روی Cookie با HttpOnly، Secure و سیاست مناسب SameSite نگه دارید و از سازوکار استاندارد Identity یا سرویس Auth تیم استفاده کنید. در درخواست‌های تغییردهندهٔ داده با Cookie، Antiforgery سمت سرور لازم است. نام Header را با Adapter یکسان کنید:

```csharp
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
});
```

توکن معتبر باید توسط Backend تولید و در meta با name برابر csrf-token رندر شود؛ صرف اضافه‌کردن یک رشته به Meta امنیت ایجاد نمی‌کند. Backend درخواست‌ها را با همان توکن اعتبارسنجی کند. پاسخ خطا نیز بدون افشای وجود حساب مشخص باشد.

logout و خواندن وضعیت کاربر در Adapter فعلی وجود ندارند؛ POST /api/auth/logout و GET /api/auth/me و UI متناسب باید جداگانه اضافه شوند. فرانت‌اند فعلی توکن Session را در localStorage ذخیره نمی‌کند. auth:success بعد از پاسخ واقعی برای به‌روزرسانی UI منتشر می‌شود؛ View یا Header هنوز باید وضعیت کاربر را از سرویس معتبر بگیرد.

## ۱۶. جستجو، فیلتر و Pagination

catalog:search از فرم جستجوی کاتالوگ منتشر می‌شود؛ detail یک Object تخت از فیلدهای فرم است، نه detail.formData. Listener باید همان لحظه preventDefault کند. انتخاب Select و حذف Chip در وضعیت فعلی فقط UI را تغییر می‌دهد و درخواست سروری ایجاد نمی‌کند.

| صفحه    | کلیدهای فعلی فیلتر                                     |
| ------- | ------------------------------------------------------ |
| محصولات | query، category، material، dimensions، pressure        |
| هواساز  | query، category، material، dimensions، pressure        |
| صنایع   | query، industry، application، projectType، sensitivity |

برای نسخهٔ Razor، Form GET و URL دارای QueryString پیشنهاد می‌شود؛ مثلاً /products?category=fans&material=galvanized&page=2. فیلترها و page در URL بمانند تا Refresh، Back و اشتراک لینک نتیجهٔ یکسان داشته باشند. اندازهٔ صفحه و Sort در Backend محدود و معتبر شوند.

API پیشنهادی فهرست‌ها، مانند GET /api/products یا GET /api/projects، در صورت نیاز به AJAX باید items، totalCount، page و pageSize را برگرداند. SSR برای شروع نیاز به API مجزای هر فهرست ندارد؛ Controller همان Query Service را مصرف می‌کند. QueryService باید normalization فارسی/عربی، وضعیت انتشار و فیلترهای مجاز را اعمال کند.

جستجوی articles.js اکنون فقط کارت‌های موجود در DOM را فیلتر می‌کند. رویداد articles:search در این نسخه تعریف نشده و Load More تنها پیام نمایشی دارد. برای جستجوی سروری، این Module باید به دادهٔ واقعی یا مسیر GET متصل شود؛ افزودن کارت‌های جدید بعد از init بدون اصلاح فهرست داخلی cards، به‌تنهایی کافی نیست.

## ۱۷. انتقال تصویر، گالری و تنظیمات قالب به CMS

در مرحلهٔ اول، settings.json و پترن‌ها فایل‌های نسخه‌شدهٔ Frontend بمانند و با Build منتشر شوند. ابزار Customizer Dev را به‌عنوان پنل Admin عمومی روی Production در نظر نگیرید؛ Endpoint آن در Build استاتیک وجود ندارد.

برای حفظ رفتار فعلی تصویر About در Razor، script JSON با ID برابر mps-image-sources را فقط در صفحهٔ About تولید کنید. دادهٔ آن لیست تنظیمات منبعِ تصویر با breakpoint و در صورت نیاز range است:

```html
<script id="mps-image-sources" type="application/json">
    [
        { "breakpoint": "desktop", "source": "/assets/images/about/team-desktop.webp" },
        { "breakpoint": "tablet", "source": "/assets/images/about/team-tablet.webp" },
        { "breakpoint": "mobile", "source": "/assets/images/about/team-mobile.webp" }
    ]
</script>
```

اندازه‌ها و برش از template-overrides.css می‌آیند؛ JSON بالا فقط منبع تصویر را تعیین می‌کند. JSON را با Serializer امن رندر کنید، نه با چسباندن رشتهٔ ورودی کاربر داخل script. تصویر اولیه و کلاس about-team-media__image برای Fallback حفظ شوند.

در مرحلهٔ دوم، CMS می‌تواند MediaAsset جدا برای Desktop/Tablet/Mobile، تنظیم قاب و TemplateVersion داشته باشد. ورودی‌ها با همان قراردادهای Frontend اعتبارسنجی شوند، Preview از Publish جدا باشد و Revision برای تداخل ویرایش کنترل شود. پس از تأیید، CSS و JSON منتشرشده را به‌صورت هماهنگ و Cache-versioned عرضه کنید.

گالری About در نسخهٔ فعلی یک SVG ترکیبی است، نه Grid تصاویر با Modal. Zoom این تحویل روی همان Asset انجام می‌شود. اگر گالری واقعی لازم است، مدل GalleryItem، مسیر/Modal نمایش و لینک «مشاهده تصاویر» باید جدا ساخته شوند؛ لینک فعلی Placeholder است.

## ۱۸. پنل مدیریت مورد نیاز

| ماژول مدیر | قابلیت حداقلی                                                        |
| ---------- | -------------------------------------------------------------------- |
| محتوا      | CRUD محصولات، پروژه‌ها، صنایع، تخصص‌ها، مقاله‌ها و صفحهٔ درباره ما   |
| رسانه      | Upload تصویر و دیتاشیت، Alt، جایگزینی فایل و مدیریت اندازه‌های About |
| تماس       | ویرایش دفترها/کارخانه و راه‌های ارتباطی                              |
| درخواست‌ها | وضعیت جدید/درحال‌بررسی/بسته، یادداشت داخلی، اپراتور و فایل پیوست     |
| حساب‌ها    | نقش Admin/Editor/Operator و کنترل دسترسی هر عملیات                   |
| انتشار     | Preview پیش‌نویس، Publish، Revision و تاریخچهٔ تغییر                 |
| قالب       | در صورت نیاز مرحلهٔ دوم؛ ذخیرهٔ امن تنظیمات و انتشار هماهنگ          |

نام Roleها پیشنهاد است. مجوزها باید سمت سرور بررسی شوند؛ مخفی‌کردن یک دکمه در UI مجوز دسترسی ایجاد نمی‌کند. دادهٔ درخواست و پیوست از محتوای عمومی CMS جدا نگه داشته شود.

## ۱۹. انتشار، آزمون پذیرش و ترتیب تحویل

GitHub Pages فقط Frontend استاتیک این پروژه را اجرا می‌کند. ASP.NET Core و دیتابیس به میزبان Backend نیاز دارند. در مرحلهٔ اتصال، Frontend و API روی دامنهٔ یکسان یا تنظیم مشخص Reverse Proxy منتشر شوند؛ cross-origin بدون تغییر Adapter و قرارداد Cookie به‌صورت خودکار کار نمی‌کند.

| کنترل              | نتیجهٔ مورد انتظار                                                       |
| ------------------ | ------------------------------------------------------------------------ |
| Asset و Manifest   | CSS/JS/Image/Font بدون 404؛ چانک مشترک و Overrideها حاضر باشند           |
| About و Customizer | تصویر و اندازهٔ مستقل هر دستگاه، ذخیره، بازخوانی، Export و Fallback درست |
| صفحات جزئیات       | slug واقعی، SEO درست، 404 معتبر و روابط محصول/پروژه                      |
| فرم                | Validation واقعی، ثبت در DB، requestId، جلوگیری از تکرار و خطای شبکه     |
| فایل               | نوع/اندازه در سرور، ذخیرهٔ غیرعمومی و Download مجاز                      |
| Auth               | OTP واقعی، انقضا، 429، Session، Reset، CSRF و Logout                     |
| فهرست‌ها           | فیلتر URL، Pagination، نتایج صفر و Back/Refresh هماهنگ                   |
| ریسپانسیو          | 320، 390، 639/640، 820، 1179/1180 و 1440px؛ متن فارسی بلند               |
| محتوا              | حذف مقصدهای #، لینک دانلود واقعی و صفحهٔ جزئیات مقاله                    |
| Admin              | دسترسی Role، Audit تغییر و انتشار پیش‌نویس                               |

تیم Backend ابتدا Architecture را بخواند، سپس پوسته و یک ProductDetails واقعی را تحویل دهد. بعد Consultation/RFQ را وصل کند تا مسیر تجاری سایت فعال شود؛ سپس Auth و CMS کامل‌تر را انجام دهد. پیاده‌سازی Backend، دیتابیس و اتصال API در این تحویل انجام نشده؛ این سند مشخصات و مسیر اجرایی آن است.

## ۲۰. منابع فنی

مرجع ساختار، نام فیلدها، eventها و فایل‌ها، سورس همین بسته است. نگاشت MVC، مدیریت Asset، اعتبارسنجی و دریافت فایل براساس مستندات رسمی زیر تنظیم شده‌اند؛ نمونه‌کدهای این راهنما باید با تنظیمات پروژهٔ Backend تطبیق داده شوند.

- [Layout در ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/mvc/views/layout?view=aspnetcore-10.0)
- [اتصال Vite به Backend و Manifest](https://vite.dev/guide/backend-integration.html)
- [Antiforgery در ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0)
- [Model Validation در ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/mvc/models/validation?view=aspnetcore-10.0)
- [دریافت فایل در ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/mvc/models/file-uploads?view=aspnetcore-10.0)
- [فایل‌های استاتیک در ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/static-files?view=aspnetcore-10.0)
- [روابط چندبه‌چند EF Core](https://learn.microsoft.com/en-us/ef/core/modeling/relationships/many-to-many)
