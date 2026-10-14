# انتشار V4 در Repository جدید

نام پیشنهادی این بسته `saeideeshghi/marpich-sanat-v4` است. اگر نام دیگری انتخاب می‌کنی، همان نام را در دستور `github:setup` وارد کن. تنظیم مقصد و مسیر Pages از یک فایل، `github-pages.json`، خوانده می‌شود؛ در GitHub Actions نام واقعی مخزن مبنای مسیر سایت است.

## رفع نمایش سایت بدون CSS در مخزن فعلی

سورس این پروژه برای ترکیب کامپوننت‌ها، Tailwind و واردکردن CSS به Build با Vite نیاز دارد. انتخاب `Deploy from a branch → main → / (root)` سورس پردازش‌نشده را منتشر می‌کند؛ برای این پروژه Source باید **GitHub Actions** باشد.

اگر در Actions هم `Deploy Marpich Sanat to GitHub Pages` و هم `pages build and deployment` با مرحلهٔ `Build with Jekyll` اجرا می‌شوند، انتشار از Branch هنوز فعال است. این دو می‌توانند یکدیگر را جایگزین کنند؛ سبزبودن Workflow پروژه به‌تنهایی کافی نیست. ابتدا Source را روی **GitHub Actions** قرار بده، سپس Workflow پروژه را از **Run workflow → main → Run workflow** اجرا کن یا نسخهٔ تازه را Push کن. در این حالت نیازی به ساخت Workflow تازه نیست.

1. ZIP اصلاح‌شده را کامل استخراج کن و فایل‌هایش را در ریشهٔ همان پوشهٔ متصل به مخزن جدید، کنار `package.json`، جایگزین کن. پوشهٔ `.github` و فایل `.github/workflows/pages.yml` هم باید کپی شوند. تصاویر و فونت‌های موجود را با همان مسیرها حفظ کن.
2. در GitHub وارد **Settings → Pages → Build and deployment → Source** شو و **GitHub Actions** را انتخاب کن.
3. در ترمینال همان پوشه `npm run publish:github` را اجرا کن.
4. در تب **Actions** منتظر موفق‌شدن Build و Deploy باش؛ URL نهایی را از **Settings → Pages** باز کن. سپس `Ctrl+F5` بزن.

Workflow این بسته خروجی `dist` را با Base نام واقعی مخزن منتشر می‌کند. `build:pages` لینک‌های CSS تمام صفحه‌ها و دو ابزار، استایل‌های چانک‌های مشترک و فایل‌های JS را بررسی می‌کند؛ اگر فایل یا لینک لازم مفقود باشد، انتشار متوقف می‌شود. برای اجرای محلی همین خروجی:

```powershell
npm run build:pages
npm run preview:pages
```

URL دارای نام مخزن را که Vite چاپ می‌کند باز کن؛ مثلاً `http://localhost:4173/marpich-sanat-v4/index.html`.

## ۱. ساخت مخزن خالی در GitHub

1. وارد حساب `saeideeshghi` شو و صفحهٔ <https://github.com/new> را باز کن.
2. Owner را `saeideeshghi` و Repository name را `marpich-sanat-v4` قرار بده.
3. Visibility را **Public** انتخاب کن.
4. گزینه‌های افزودن README، gitignore و License را فعال نکن. این فایل‌ها از پروژهٔ محلی ارسال می‌شوند.
5. **Create repository** را بزن. اگر نام از قبل وجود دارد، یک نام آزاد انتخاب کن و آن را در مرحلهٔ تنظیم مقصد جایگزین کن.

## ۲. آماده‌کردن پوشهٔ جدا روی ویندوز

1. یک پوشهٔ جدید با نام `marpich-sanat-v4` روی Desktop بساز.
2. محتویات ZIP را مستقیم در آن استخراج کن؛ `package.json` باید در ریشهٔ این پوشه باشد.
3. پوشه‌های واقعی تصاویر و فونت‌ها را از پروژهٔ قبلی، با حفظ مسیرهایشان، کپی کن: `assets`، `fonts` و محتویات `public`. هنگام کپی `public`، فایل‌های موجود را Merge کن. `docs` را هم می‌توانی با همان مسیر قبلی کپی کنی.
4. پوشهٔ `.git` پروژهٔ قبلی را کپی نکن. تاریخچه و Origin پروژهٔ جدید جدا ساخته می‌شوند.
5. `node_modules`، `dist`، `.cache` و ZIPهای قبلی لازم نیست کپی شوند؛ وابستگی‌ها و خروجی Build دوباره ساخته می‌شوند. `.gitignore` این خروجی‌ها را از Commit کنار می‌گذارد، ولی تصاویر و فونت‌های منبع را حفظ می‌کند.

Git و Node.js باید نصب باشند؛ حداقل Node این پروژه `22.12.0` است و Node 24 فعلی‌ات مناسب است. ترمینال VS Code را روی **PowerShell** باز کن:

```powershell
cd "$env:USERPROFILE\Desktop\marpich-sanat-v4"
git --version
node --version
npm --version
```

## ۳. تنظیم مقصد؛ فقط یک بار

```powershell
npm run github:setup -- --repo saeideeshghi/marpich-sanat-v4
git remote -v
```

این دستور Git محلی و branch `main` را در پوشهٔ جدید ایجاد می‌کند، Origin را تنظیم می‌کند و نام مقصد را در `github-pages.json` می‌نویسد. اگر پوشه از قبل به مخزن دیگری وصل باشد، متوقف می‌شود؛ پروژهٔ قبلی را تغییر نمی‌دهد. ساخت Repository در خود GitHub همچنان همان مرحلهٔ ۱ است.

خروجی `git remote -v` باید برای Fetch و Push به این آدرس اشاره کند:

```text
https://github.com/saeideeshghi/marpich-sanat-v4.git
```

برای نام متفاوت، مثلاً `marpich-sanat-final`، فقط دستور تنظیم اولیه را این‌طور اجرا کن:

```powershell
npm run github:setup -- --repo saeideeshghi/marpich-sanat-final
```

## ۴. فعال‌کردن GitHub Pages

در مخزن جدید وارد **Settings → Pages → Build and deployment → Source** شو و **GitHub Actions** را انتخاب کن. Workflow لازم داخل `.github/workflows/pages.yml` این بسته آماده است؛ نیازی به ساخت یک Workflow اضافی نیست.

اگر تنظیم Pages قبل از اولین Push در دسترس نبود، ابتدا مرحلهٔ ۵ را انجام بده، سپس Source را تنظیم کن و Workflow را طبق مرحلهٔ ۶ دوباره اجرا کن.

## ۵. ارسال اولیهٔ پروژه

در همان پوشه اجرا کن:

```powershell
npm run publish:github
```

همین دستور به‌ترتیب این کارها را انجام می‌دهد:

- تطبیق Origin با مقصد ثبت‌شده و بررسی ریشهٔ Git؛
- پاکسازی فقط مسیرهای منسوخِ فهرست `scripts/legacy-files.json`؛
- نصب با `npm ci`، بررسی سورس و Build مخصوص Pages؛
- `git add`، ساخت Commit در صورت وجود تغییر و Push روی `main`؛
- در دفعات بعد، `pull --rebase` و بررسی دوباره اگر کد تغییر کرده باشد.

در مخزن خالی، اولین Push بدون Pull از branch ناموجود انجام می‌شود. انتشار معمولی tag جدید ایجاد نمی‌کند و tagهای قبلی را بازنویسی نمی‌کند. Force Push هم انجام نمی‌شود.

اگر Git پنجرهٔ ورود باز کرد، با حساب صاحب مخزن وارد شو. واردکردن رمز حساب در ترمینال روش احراز هویت HTTPS نیست؛ از ورود Git Credential Manager یا یک Token معتبر استفاده کن. Token را در سورس یا فایل تنظیمات پروژه قرار نده.

## ۶. دیدن نتیجه

1. تب **Actions** مخزن جدید را باز کن.
2. Workflow **Deploy Marpich Sanat to GitHub Pages** باید سبز شود. مرحلهٔ Build سورس را کنترل می‌کند و خروجی `dist` را برای Pages می‌فرستد.
3. در **Settings → Pages** آدرس سایت نمایش داده می‌شود. برای نام پیشنهادی:

```text
https://saeideeshghi.github.io/marpich-sanat-v4/index.html
```

برای نام دیگر، بخش `marpich-sanat-v4` در URL برابر نام همان مخزن است. مسیر فایل‌های JS، CSS، تصاویر و فونت‌ها نیز با نام جدید ساخته می‌شود.

اگر اولین Workflow قبل از فعال‌کردن Pages شکست خورد، پس از تنظیم Source به تب Actions برو، Workflow را انتخاب کن و **Run workflow → main → Run workflow** را بزن.

## ۷. آپدیت‌های بعدی؛ فقط یک دستور

فایل‌ها را در همین پوشهٔ جدید ویرایش و تنظیمات Customizer را ثبت کن، سپس:

```powershell
npm run publish:github
```

یا `PUSH-GITHUB.cmd` را دوبار کلیک کن. اسکریپت PowerShell و دستور npm از منطق یکسان و مقصد ثبت‌شده استفاده می‌کنند. هر Push موفق به `main`، Workflow را اجرا می‌کند و سایت این مخزن را با خروجی جدید به‌روزرسانی می‌کند. مخزن قبلی و سایت قبلی مقصد این دستور نیستند.

Tag فقط برای انتشار نسخهٔ مشخص لازم است؛ برای آپدیت روزانه لازم نیست:

```powershell
npm run publish:github -- --release-tag v4.0.1
```

## رفع خطاهای رایج

| خطا یا نشانه                                              | اقدام                                                                                                                                                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Origin must match` یا `already points to another origin` | پوشهٔ تازه بساز و ZIP را بدون `.git` قبلی استخراج کن. مقصد را با `github:setup` تنظیم کن.                                                                                                                                  |
| `Repository not found`                                    | وجود مخزن، نام Owner/Repo و حسابی که با آن وارد Git شده‌ای را بررسی کن.                                                                                                                                                    |
| `Author identity unknown`                                 | در همین پوشه `git config user.name "Saeid"` و `git config user.email "YOUR_GITHUB_EMAIL"` را اجرا کن؛ جای عبارت ایمیل، ایمیل واقعی حساب GitHub خودت را بگذار. سپس دستور انتشار را دوباره بزن.                              |
| Rebase conflict                                           | `git status` را ببین، تضادهای اعلام‌شده را حل کن، فایل‌ها را با `git add` ثبت کن و `git rebase --continue` بزن. پس از اتمام دوباره منتشر کن.                                                                               |
| خطای Check یا Build                                       | همان خطای بالاتر را رفع کن. اسکریپت بعد از شکست بررسی‌ها Push نمی‌کند.                                                                                                                                                     |
| `missing approved customizer CSS` در ویندوز               | فایل‌های `build/customizer.js` و `scripts/check-platform.js` نسخهٔ اصلاح‌شده را در همین پروژه جایگزین کن و دوباره `npm run publish:github` بزن. این خطا از اختلاف جداکنندهٔ مسیر Windows و Vite بود؛ بررسی CSS را حذف نکن. |
| خطای Configure/Deploy Pages                               | Source باید GitHub Actions باشد؛ سپس Workflow را دوباره اجرا کن.                                                                                                                                                           |
| سایت بدون CSS یا بدون هدر و منو                           | فایل `.github/workflows/pages.yml` را از ZIP کامل کپی کن، Source را GitHub Actions قرار بده و دوباره منتشر کن. خروجی `dist` باید Deploy شود.                                                                               |
| سایت بدون تصویر                                           | تصاویر را با مسیرهای قبلی در `assets` یا `public/assets` کپی کن و دوباره منتشر کن. `npm run check:assets` مسیرهای مفقود را نشان می‌دهد.                                                                                    |
| 404 بلافاصله پس از Push                                   | نتیجهٔ Actions و مرحلهٔ Deploy را بررسی کن؛ URL نهایی را از Settings → Pages بردار.                                                                                                                                        |

## منابع

- [ساخت Repository در GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [تنظیم GitHub Actions برای Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [مسیر Base و انتشار Vite روی Pages](https://vite.dev/guide/static-deploy.html#github-pages)

## انتقال مخزن از V3 به V4

برای انتقال پوشهٔ متصل به مخزن قبلی، دستور زیر مقصد جدید را تنظیم و مقصد قبلی را با نام `previous-origin` حفظ می‌کند. این مرحله برای مخزنی که از قبل به V4 متصل است لازم نیست:

```powershell
npm run github:setup -- --repo saeideeshghi/marpich-sanat-v4 --replace-origin
npm run publish:github -- --release-tag v4.0.0
```

## ثبت نسخه‌های بعدی

تغییرات روزانه با Commit ثبت می‌شوند. برای نسخهٔ قابل ارجاع، نسخهٔ `package.json` و نسخهٔ ریشهٔ `package-lock.json` را هماهنگ کن، تغییرات را در `CHANGELOG.md` بنویس و با یک Tag تازه منتشر کن. اصلاح باگ مانند این تغییر، نسخهٔ `4.0.1` می‌گیرد؛ قابلیت جدید سازگار، `4.1.0` و تغییر ناسازگار، `5.0.0`.

```powershell
npm run publish:github -- --release-tag v4.0.1
```

در GitHub از **Releases → Draft a new release** همان Tag را انتخاب و توضیحات نسخه را ثبت کن. Tagهای منتشرشده را جابه‌جا یا بازنویسی نکن؛ هر اصلاح بعدی نسخهٔ تازه می‌گیرد. برای بازگشت سایت به نسخه‌ای قبلی، تغییر را با یک Commit بازگردان تا سابقهٔ نسخه‌ها حفظ شود.

## فایل‌های قابل ثبت در Git

`.gitignore` باید داخل مخزن باشد تا همهٔ اعضا قواعد یکسان داشته باشند. `.env.example` فقط نمونهٔ بدون اطلاعات محرمانه است و ثبت می‌شود. فایل واقعی `.env` و انواع `.env.*`، کلیدهای خصوصی، `node_modules`، `dist`، `.cache` و فایل‌های فشردهٔ محلی نادیده گرفته می‌شوند؛ GitHub Actions خروجی سایت را جداگانه می‌سازد و منتشر می‌کند. قواعد Ignore فایل‌هایی را که قبلاً ثبت شده‌اند از سابقه حذف نمی‌کنند.
