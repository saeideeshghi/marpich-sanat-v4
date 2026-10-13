// Explicit migration list only. Never recurse into artwork or user directories.
import { readFileSync, existsSync, lstatSync, rmSync } from "node:fs";
import { resolve, relative } from "node:path";
const root = resolve(import.meta.dirname, "..");
// Publication needs this source registry even when documentation is omitted
// from a handoff. It contains only the previously approved migration paths.
const files = JSON.parse(readFileSync(resolve(root, "scripts/legacy-files.json"), "utf8"));
const apply = process.argv.includes("--apply");
let count = 0;
for (const name of files) {
    const path = resolve(root, name);
    if (relative(root, path).startsWith("..") || /^(assets|public|fonts|node_modules|tools)\//.test(name))
        throw new Error("Unexpected migration path");
    if (!existsSync(path)) continue;
    if (!lstatSync(path).isFile()) throw new Error(`Expected a regular file: ${name}`);
    console.log(`${apply ? "Removed" : "Would remove"}: ${name}`);
    if (apply) rmSync(path);
    count++;
}
console.log(`${count} legacy files ${apply ? "removed" : "listed; use --apply to remove"}.`);
