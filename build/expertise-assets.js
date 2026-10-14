import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const exports = {
    "assessment-consulting.svg": { id: "2402", x: 50, y: 6, width: 1271, photoWidth: 1311, mirror: true },
    "engineering-design.svg": { id: "2421", x: 11, y: 6, width: 1310, photoWidth: 1311 },
    "advanced-manufacturing.svg": { id: "2405", x: 10, y: 0, width: 1308, photoWidth: 1321, mirror: true },
    "site-project-management.svg": { id: "2439", x: 11, y: 6, width: 1310, photoWidth: 1311 },
    "testing-commissioning.svg": { id: "2448", x: 10, y: 6, width: 1311, photoWidth: 1311 },
};

// Remove the exported card's shadow, rounded path and transparent gutters from
// the disposable SVG copy. Keep the original photo pixels and pattern transform;
// CSS owns the single shared clipping frame for the photograph and its gradient.
export function expertisePhoto(source, filename) {
    const item = exports[filename];
    if (
        !item ||
        !source.includes(`viewBox="0 0 ${item.id === "2405" ? 1321 : 1331} ${item.id === "2405" ? 303 : 323}"`)
    )
        return source;
    const pattern = source.match(new RegExp(`<pattern\\b[^>]*\\bid="pattern0_1_${item.id}"[^>]*>[\\s\\S]*?</pattern>`));
    const image = source.match(new RegExp(`<image\\b[^>]*\\bid="image0_1_${item.id}"[^>]*\\/>`));
    if (!pattern || !image || !/data:image\/(?:png|jpeg);base64,/.test(image[0])) return source;
    const photoX = item.id === "2405" ? 0 : 10;
    const rectangle = `<rect x="${photoX}" y="${item.y}" width="${item.photoWidth}" height="303" fill="url(#pattern0_1_${item.id})"/>`;
    // These two SVG exports face opposite to the supplied PNGs. Keep the page's
    // existing photo direction, including its separate CSS mirror for assessment.
    const artwork = item.mirror
        ? `<g transform="translate(${2 * item.x + item.width} 0) scale(-1 1)">${rectangle}</g>`
        : rectangle;
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" data-expertise-photo="true" width="${item.width}" height="303" viewBox="${item.x} ${item.y} ${item.width} 303">\n` +
        `${artwork}\n` +
        `<defs>\n${pattern[0]}\n${image[0]}\n</defs>\n</svg>\n`
    );
}

export function prepareExpertisePhotos(publicRoot) {
    for (const filename of Object.keys(exports)) {
        const path = resolve(publicRoot, "assets/images/expertise", filename);
        if (!existsSync(path)) continue;
        const source = readFileSync(path, "utf8");
        const photo = expertisePhoto(source, filename);
        if (photo !== source) writeFileSync(path, photo);
    }
}
