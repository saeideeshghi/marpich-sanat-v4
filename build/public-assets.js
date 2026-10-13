import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { prepareCertificatePhotos } from "./certificate-assets.js";
import { prepareGalleryPhoto } from "./gallery-assets.js";

// Build a disposable public directory. Existing repositories may keep artwork
// in root/assets; native public assets take priority, including new process SVGs.
// Never move or delete the owner's source artwork, and never duplicate it in git.
export function preparePublicAssets(root) {
    // Independent dev servers/builds must not delete one another's public tree.
    const destination = resolve(root, `.cache/static-public-${process.pid}`);
    if (!relative(resolve(root), destination).startsWith(`.cache${sep}`))
        throw new Error("Public asset output must remain inside the project cache");
    rmSync(destination, { recursive: true, force: true, maxRetries: 3 });
    mkdirSync(destination, { recursive: true });
    for (const name of ["assets", "fonts"]) {
        const source = resolve(root, name);
        if (existsSync(source)) cpSync(source, resolve(destination, name), { recursive: true, dereference: true });
    }
    const nativePublic = resolve(root, "public");
    if (existsSync(nativePublic)) cpSync(nativePublic, destination, { recursive: true, dereference: true });
    prepareCertificatePhotos(destination);
    prepareGalleryPhoto(destination);
    return destination;
}
