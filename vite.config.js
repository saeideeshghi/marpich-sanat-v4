import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { htmlPartials } from "./build/html-partials.js";
import { allPages as pages } from "./build/pages.js";
import { localizedRuntime } from "./build/localization.js";
import { localeOutput } from "./build/locale-output.js";
import { preparePublicAssets, publicAssetLifecycle } from "./build/public-assets.js";
import { publicAssetBase } from "./build/public-asset-base.js";
import { templateCustomizer } from "./build/customizer.js";
import { designTokenReference } from "./build/design-tokens.js";
import { runtimePatterns } from "./build/pattern-runtime.js";
import { optimizePublicAssets, optimizedImages } from "./build/optimized-assets.js";
import { backendHeaders } from "./build/security-headers.js";
import { prepareIconFonts } from "./build/icon-fonts.js";

const root = import.meta.dirname;

export default defineConfig(async ({ mode, isPreview, command }) => {
    const base = "/";
    const preview = { host: "127.0.0.1", headers: mode === "backend" ? backendHeaders : {} };
    const outDir = mode === "backend" ? "dist/backend" : "dist";
    // Preview serves a completed build. It must not recopy/re-encode source
    // artwork or regenerate editable styles just to start an HTTP server.
    if (isPreview === true) return { appType: "mpa", base, preview, build: { outDir } };
    const publicDir = preparePublicAssets(root);
    const { imageMap, responsiveMap, imageDimensions } = await optimizePublicAssets(root, publicDir);
    const icons = await prepareIconFonts(root, publicDir, { subset: command === "build" });
    return {
        appType: "mpa",
        // Independent local and backend builds use the site root.
        base,
        server: {
            host: "127.0.0.1",
            fs: {
                deny: [
                    ".env",
                    ".env.*",
                    "*.{crt,pem,key,p12,pfx}",
                    "**/.git/**",
                    "**/.aws/**",
                    "**/.codex/**",
                    "**/.agents/**",
                    "**/.cache/**",
                ],
            },
            // Derived assets and browser profiles are never live source files.
            watch: { ignored: ["**/.cache/**", "**/dist/**"] },
        },
        preview,
        publicDir,
        resolve: { alias: { "@marpich/icons.css": icons.cssPath } },
        plugins: [
            publicAssetLifecycle(root, publicDir),
            localizedRuntime(root),
            htmlPartials(root),
            optimizedImages(imageMap, responsiveMap, imageDimensions),
            runtimePatterns(root),
            tailwindcss(),
            publicAssetBase(base),
            templateCustomizer(root, base, { publicTools: mode !== "backend" }),
            ...(mode === "backend" ? [] : [designTokenReference(root)]),
            localeOutput(root),
        ],
        build: {
            outDir,
            // Razor integration must resolve hashed JS/CSS from the manifest,
            // including CSS belonging to imported shared chunks (see docs).
            manifest: true,
            rollupOptions: {
                input: {
                    ...Object.fromEntries(pages.map(({ name, file }) => [name, resolve(root, file)])),
                    ...(mode === "backend"
                        ? {}
                        : {
                              customizer: resolve(root, "tools/customizer.html"),
                              "design-tokens": resolve(root, "tools/design-tokens.html"),
                          }),
                },
            },
        },
    };
});
