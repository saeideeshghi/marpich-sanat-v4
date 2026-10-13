import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { preparePublicAssets } from "../build/public-assets.js";
import { isValidSvgPath } from "../src/js/utils/svg-path.js";
const root = resolve(import.meta.dirname, "..");
const publicRoot = preparePublicAssets(root);
let paths = 0,
    failures = 0;
function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) scan(path);
        else if (entry.name.endsWith(".svg")) {
            const source = readFileSync(path, "utf8");
            for (const match of source.matchAll(/<path\b[^>]*\bd=(['"])(.*?)\1/gs)) {
                paths++;
                if (match[2].trim() && !isValidSvgPath(match[2])) {
                    failures++;
                    console.error(`Invalid path: ${relative(publicRoot, path)} at ${match.index}`);
                }
            }
        }
    }
}
scan(publicRoot);
console.log(`${paths} SVG paths checked; ${failures} invalid.`);
if (failures) process.exitCode = 1;
