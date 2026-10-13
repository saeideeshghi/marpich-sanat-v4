import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import sharp from "sharp";
import woff2 from "wawoff2";

const digest = (data) => createHash("sha256").update(data).digest("hex");
function files(directory) {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
    });
}

// Work only on the disposable public copy. Cache by bytes, so changing an
// owner's image/font always invalidates the derived asset on the next build.
export async function optimizePublicAssets(root, publicRoot) {
    const cache = resolve(root, ".cache/asset-encoding-v1");
    mkdirSync(cache, { recursive: true });
    const imageMap = {},
        responsiveMap = {},
        savings = { original: 0, optimized: 0, fonts: 0, images: 0, embedded: 0 };
    async function encode(bytes, kind, width = 0) {
        const path = resolve(cache, `${digest(bytes)}${width ? `-${width}w-q92` : ""}.${kind}`);
        if (existsSync(path)) return readFileSync(path);
        const output =
            kind === "woff2"
                ? Buffer.from(await woff2.compress(bytes))
                : await sharp(bytes, { limitInputPixels: 40000000 })
                      .resize(width ? { width, withoutEnlargement: true } : undefined)
                      .webp(width ? { quality: 92, alphaQuality: 100, effort: 5 } : { lossless: true, effort: 4 })
                      .toBuffer();
        writeFileSync(path, output);
        return output;
    }
    for (const path of files(publicRoot)) {
        const source = readFileSync(path);
        if (/\.ttf$/i.test(path)) {
            if (existsSync(path.replace(/\.ttf$/i, ".woff2"))) continue;
            const encoded = await encode(source, "woff2");
            writeFileSync(path.replace(/\.ttf$/i, ".woff2"), encoded);
            savings.fonts++;
            savings.original += source.length;
            savings.optimized += encoded.length;
        } else if (/\.(?:png|jpe?g)$/i.test(path) && source.length > 16000) {
            const metadata = await sharp(source).metadata();
            // Keep EXIF orientation/ICC-sensitive or animated custom assets
            // intact. Built-in photos have neither; WebP preserves their pixels.
            if (metadata.orientation || metadata.icc || metadata.pages > 1) continue;
            const encoded = await encode(source, "webp");
            if (encoded.length >= source.length) continue;
            writeFileSync(`${path}.webp`, encoded);
            const url = `/${relative(publicRoot, path).replaceAll("\\", "/")}`;
            imageMap[url] = `${url}.webp`;
            // Responsive photographic copies preserve alpha and the untouched,
            // full-resolution fallback. Technical product drawings stay lossless.
            const hero = url === "/assets/images/hero/hero-engineers.png";
            const photo =
                /\/(?:expertise\/(?:expertise-\d+|assessment-consulting|engineering-design|advanced-manufacturing|site-project-management|testing-commissioning)|projects\/project-\d+|articles\/article-\d+|about\/why-marpich)\.png$/.test(
                    url,
                );
            if ((hero && metadata.width > 960) || (photo && metadata.width > 480)) {
                const variants = [];
                const version = digest(Buffer.from(`${digest(source)}:responsive-q92-v1`)).slice(0, 12);
                for (const width of (hero ? [960, 1440, 1920] : [480, 960, 1440]).filter(
                    (width) => width < metadata.width,
                )) {
                    const resized = await encode(source, "webp", width);
                    const variant = `${url}.${version}.${width}w.webp`;
                    writeFileSync(`${path}.${version}.${width}w.webp`, resized);
                    variants.push(`${variant} ${width}w`);
                }
                if (photo) {
                    const full = `${url}.${version}.${metadata.width}w.webp`;
                    writeFileSync(
                        `${path}.${version}.${metadata.width}w.webp`,
                        await encode(source, "webp", metadata.width),
                    );
                    variants.push(`${full} ${metadata.width}w`);
                } else variants.push(`${url}.webp ${metadata.width}w`);
                responsiveMap[url] = variants.join(", ");
            }
            savings.images++;
            savings.original += source.length;
            savings.optimized += encoded.length;
        } else if (/\.svg$/i.test(path)) {
            let svg = source.toString("utf8");
            for (const match of [...svg.matchAll(/data:image\/(?:png|jpeg);base64,([a-z\d+/=\s]+)(?=["'])/gi)]) {
                const bitmap = Buffer.from(match[1].replace(/\s/g, ""), "base64");
                if (bitmap.length < 16000) continue;
                const metadata = await sharp(bitmap).metadata();
                if (metadata.orientation || metadata.icc || metadata.pages > 1) continue;
                const encoded = await encode(bitmap, "webp");
                if (encoded.length >= bitmap.length) continue;
                svg = svg.replace(match[0], `data:image/webp;base64,${encoded.toString("base64")}`);
                savings.embedded++;
                savings.original += bitmap.length;
                savings.optimized += encoded.length;
            }
            if (svg !== source.toString("utf8")) writeFileSync(path, svg);
        }
    }
    const assets = resolve(publicRoot, "assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(resolve(assets, "image-manifest.json"), JSON.stringify(imageMap, null, 2) + "\n");
    return { imageMap, responsiveMap, savings };
}

export function optimizedImages(imageMap, responsiveMap = {}) {
    return {
        name: "marpich-optimized-images",
        transformIndexHtml: {
            order: "pre",
            handler(html) {
                html = html.replace(/<img\b[^>]*>/g, (tag) => {
                    const url = tag.match(/\bsrc=(['"])(.*?)\1/)?.[2];
                    if (!responsiveMap[url] || /\bsrcset=/.test(tag)) return tag;
                    const hero = /\bhero-image\b/.test(tag);
                    const why = url === "/assets/images/about/why-marpich.png";
                    const service = /\bexpertise-page__media-image\b/.test(tag);
                    // Full-width summaries may reuse a listing photograph.
                    // Only substitute sources when its rendered role is known.
                    if (
                        !hero &&
                        !why &&
                        !service &&
                        !/\b(?:site-card__image|article-card__image)\b|\/articles\/article-/.test(tag)
                    )
                        return tag;
                    const sizes = hero
                        ? "(max-width: 1179px) 960px, (max-width: 1599px) 65vw, 1100px"
                        : why
                          ? "(max-width: 1179px) 100vw, 700px"
                          : service
                            ? "(max-width: 1179px) 100vw, 1320px"
                            : "(max-width: 639px) calc(100vw - 32px), (max-width: 1179px) 50vw, 440px";
                    return tag.replace(/\s*\/?>(?=$)/, ` srcset="${responsiveMap[url]}" sizes="${sizes}" />`);
                });
                return html.replace(/\b(src|poster)=(['"])(.*?)\2/g, (tag, attr, quote, url) =>
                    imageMap[url] ? `${attr}=${quote}${imageMap[url]}${quote}` : tag,
                );
            },
        },
    };
}
