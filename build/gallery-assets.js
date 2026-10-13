import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// The known Figma gallery export includes a shadow and transparent vertical
// gutters. Crop its SVG viewport to the photograph; embedded pixels and the
// owner's source asset stay unchanged. Other/custom exports pass through.
export function galleryPhoto(source) {
    if (
        !source.includes('viewBox="0 0 1440 385"') ||
        !source.includes('filter="url(#filter0_d_13_846)"') ||
        !source.includes('height="364.939"') ||
        !source.includes('transform="matrix(-1 0 0 1 1445.89 6)"')
    )
        return source;
    return source
        .replace('height="385"', 'height="364.939"')
        .replace('viewBox="0 0 1440 385"', 'viewBox="0 6 1440 364.939"')
        .replace('filter="url(#filter0_d_13_846)"', "");
}

export function prepareGalleryPhoto(publicRoot) {
    const path = resolve(publicRoot, "assets/images/about/gallery.svg");
    if (!existsSync(path)) return;
    const source = readFileSync(path, "utf8");
    const photo = galleryPhoto(source);
    if (photo !== source) writeFileSync(path, photo);
}
