import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const exports = {
    "certificate-iso.svg": "720",
    "certificate-ce.svg": "725",
};

// These two Figma exports contain a whole card: shadow, caption outlines and
// an embedded certificate photo. Render only that original photo in our HTML
// card. Unrecognised/custom artwork stays unchanged; source files are untouched.
export function certificatePhoto(source, filename) {
    const id = exports[filename];
    if (!id || !source.includes('filter="url(#filter0_d_13_' + id + ')"')) return source;
    const image = source.match(new RegExp('<image\\b[^>]*\\bid="image0_13_' + id + '"[^>]*\\/>'));
    if (!image || !/data:image\/(?:png|jpeg);base64,/.test(image[0])) return source;
    const width = Number(image[0].match(/\bwidth="([\d.]+)"/)?.[1]);
    const height = Number(image[0].match(/\bheight="([\d.]+)"/)?.[1]);
    if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return source;
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' +
        width +
        '" height="' +
        height +
        '" viewBox="0 0 ' +
        width +
        " " +
        height +
        '">\n' +
        image[0] +
        "\n</svg>\n"
    );
}

export function prepareCertificatePhotos(publicRoot) {
    for (const filename of Object.keys(exports)) {
        const path = resolve(publicRoot, "assets/images/about", filename);
        if (!existsSync(path)) continue;
        const source = readFileSync(path, "utf8");
        const photo = certificatePhoto(source, filename);
        if (photo !== source) writeFileSync(path, photo);
    }
}
