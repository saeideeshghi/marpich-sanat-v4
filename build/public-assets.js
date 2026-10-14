import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, resolve, relative, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { prepareCertificatePhotos } from "./certificate-assets.js";
import { prepareGalleryPhoto } from "./gallery-assets.js";
import { prepareExpertisePhotos } from "./expertise-assets.js";

export const hasCredentialMaterial = (text) =>
    /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----|-----BEGIN PGP (?:PRIVATE KEY BLOCK)-----|(?:AKIA|ASIA)[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,}/.test(
        text,
    );

const activeSvg = (text) => {
    if (/<(?:[\w.-]+:)?(?:script|foreignObject)\b|<!DOCTYPE\b|\son[a-z]+\s*=/i.test(text)) return true;
    return [...text.matchAll(/\b(?:[\w.-]+:)?href\s*=\s*(["'])(.*?)\1/gs)].some(([, , value]) => {
        const decoded = value
            .replace(/&#(x[a-f\d]+|\d+);/gi, (_, code) => {
                const point = parseInt(
                    code[0].toLowerCase() === "x" ? code.slice(1) : code,
                    code[0].toLowerCase() === "x" ? 16 : 10,
                );
                return point <= 0x10ffff ? String.fromCodePoint(point) : "\ufffd";
            })
            .replace(/[\u0000-\u0020\u007f]/g, "");
        return /^(?:javascript:|vbscript:|data:text\/html)/i.test(decoded);
    });
};

// Git ignore rules do not stop Vite from copying local public files into dist.
// Fail before copying private configuration or links outside the asset tree.
export function assertPublicAssetTree(directory, root) {
    const inspect = (path) => {
        const name = basename(path);
        const stat = lstatSync(path);
        if (
            stat.isSymbolicLink() ||
            /^\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$/i.test(name) ||
            [".git", ".aws", ".codex", ".agents", ".cache", "node_modules"].includes(name.toLowerCase())
        )
            throw new Error(`Private or linked file cannot be published: ${relative(root, path)}`);
        if (stat.isDirectory()) {
            for (const entry of readdirSync(path)) inspect(resolve(path, entry));
        } else if (/\.(?:html|[cm]?js|json|md|css|svg|txt|ya?ml)$/i.test(name)) {
            const text = readFileSync(path, "utf8");
            if (hasCredentialMaterial(text))
                throw new Error(`Key material cannot be published: ${relative(root, path)}`);
            if (/\.svg$/i.test(name) && activeSvg(text))
                throw new Error(`Active SVG content cannot be published: ${relative(root, path)}`);
        }
    };
    inspect(directory);
}

const ownedPublicDirectories = new Map();

function assertCachePath(root, destination) {
    const cache = resolve(root, ".cache");
    for (const path of [cache, destination])
        if (existsSync(path) && lstatSync(path).isSymbolicLink())
            throw new Error("Public asset cache must not be a filesystem link");
}

export function cleanupPublicAssets(root, directory) {
    const destination = resolve(directory);
    if (ownedPublicDirectories.get(destination) !== resolve(root))
        throw new Error("Public asset cleanup must target this process's workspace cache");
    assertCachePath(root, destination);
    rmSync(destination, { recursive: true, force: true, maxRetries: 3 });
}

export const publicAssetLifecycle = (root, directory) => ({
    name: "marpich-public-asset-lifecycle",
    closeBundle: () => cleanupPublicAssets(root, directory),
});

// Build a disposable public directory. Existing repositories may keep artwork
// in root/assets; native public assets take priority, including new process SVGs.
// Never move or delete the owner's source artwork, and never duplicate it in git.
export function preparePublicAssets(root) {
    // Vite can prepare a new config before closing the previous one in the same
    // process. Each config owns a separate directory, including during restart.
    const destination = resolve(root, ".cache", `static-public-${process.pid}-${randomUUID()}`);
    assertCachePath(root, destination);
    if (!relative(resolve(root), destination).startsWith(`.cache${sep}`))
        throw new Error("Public asset output must remain inside the project cache");
    const sources = ["assets", "fonts", "public"].map((name) => resolve(root, name)).filter(existsSync);
    sources.forEach((source) => assertPublicAssetTree(source, root));
    if (existsSync(destination)) throw new Error("Public asset cache already exists");
    ownedPublicDirectories.set(destination, resolve(root));
    mkdirSync(destination, { recursive: true });
    for (const name of ["assets", "fonts"]) {
        const source = resolve(root, name);
        if (existsSync(source))
            cpSync(source, resolve(destination, name), {
                recursive: true,
                filter: (path) => basename(path) !== ".gitkeep",
            });
    }
    const nativePublic = resolve(root, "public");
    if (existsSync(nativePublic))
        cpSync(nativePublic, destination, { recursive: true, filter: (path) => basename(path) !== ".gitkeep" });
    prepareCertificatePhotos(destination);
    prepareGalleryPhoto(destination);
    prepareExpertisePhotos(destination);
    return destination;
}
