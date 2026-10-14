import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { resolve } from "node:path";

// Bitmap photographs exported inside SVG containers need not download the
// entire embedded camera image for a small card. Keep vector-only artwork,
// technical diagrams, custom external images and all original files intact.
export function isSvgPhoto(url, text) {
    return (
        /^\/assets\/images\/(?:about|articles|expertise|industries|projects)\//.test(url) &&
        !url.endsWith("/system-diagram.svg") &&
        (text.match(/<image\b/g) || []).length === 1 &&
        /(?:xlink:)?href=["']data:image\/(?:png|jpeg);base64,/.test(text) &&
        !/<text\b|<script\b|<foreignObject\b|\son[a-z]+\s*=/i.test(text)
    );
}

export async function responsiveSvgPhoto(source, url, metadata, publicRoot, cache) {
    const version = createHash("sha256").update(source).update("svg-photo-lossless-v1").digest("hex").slice(0, 12);
    const fullWidth = metadata.width;
    const maximum = Math.max(1920, fullWidth * 2);
    const widths = [...new Set([fullWidth, ...[480, 720, 960, 1440, 1920].filter((width) => width < maximum)])];
    const variants = [];
    for (const width of widths.sort((a, b) => a - b)) {
        const path = resolve(cache, `svg-${version}-${width}w.webp`);
        if (!existsSync(path)) {
            const bytes = await sharp(source, { density: (72 * width) / fullWidth, limitInputPixels: 40000000 })
                .resize({ width })
                .webp({ lossless: true, effort: 4 })
                .toBuffer();
            writeFileSync(path, bytes);
        }
        const candidate = `${url}.${version}.${width}w.webp`;
        writeFileSync(resolve(publicRoot, candidate.slice(1)), readFileSync(path));
        variants.push(`${candidate} ${width}w`);
    }
    // The original scalable export remains available for large/retina covers.
    variants.push(`${url} ${maximum}w`);
    return { src: `${url}.${version}.${fullWidth}w.webp`, srcset: variants.join(", ") };
}
