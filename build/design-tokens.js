import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import postcss from "postcss";
import { pages } from "./pages.js";
import { describeToken } from "../src/js/customizer/token-descriptions.js";
import { TOKEN_CONTRACTS } from "../src/js/customizer/token-values.js";

const moduleId = "virtual:design-tokens";
// Catalog paths are identifiers, so keep them portable even on Windows. Exclude
// generated editor CSS before parsing; saved overrides must never become owners.
const projectPath = (root, file) => relative(root, file).replaceAll("\\", "/");
const readSource = (file) => readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
const filesIn = (directory) =>
    readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .flatMap((entry) =>
            entry.isDirectory() ? filesIn(resolve(directory, entry.name)) : [resolve(directory, entry.name)],
        );
const pageNamesFor = (file, selector = "") => {
    const names = new Set();
    for (const page of pages) {
        if (
            file === page.file ||
            file === `src/css/pages/${page.name}.css` ||
            file === `src/js/pages/${page.name}.js` ||
            file.startsWith(`src/css/pages/${page.name}-`) ||
            selector.includes(`data-page="${page.name}"`) ||
            selector.includes(`.${page.name}__`) ||
            selector.includes(`.${page.name}-`) ||
            selector.includes(`#hero-${page.file.replace(/\.html$/, "")}`)
        )
            names.add(page.name);
    }
    return [...names];
};

/** Parse authored declarations instead of guessing variable names from BEM classes.
 * One generated catalog powers both help surfaces and reflects later CSS edits. */
export function collectDesignTokens(root) {
    const tokens = new Map();
    const tokenFor = (name) => {
        if (!tokens.has(name)) tokens.set(name, { name, definitions: [], usages: [] });
        return tokens.get(name);
    };
    const location = (node, file) => {
        let parent = node.parent;
        while (parent && parent.type !== "rule" && parent.type !== "atrule") parent = parent.parent;
        const selector = parent?.selector || (parent ? `@${parent.name}` : "inline style");
        const media = [];
        for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent)
            if (ancestor.type === "atrule" && ["media", "supports"].includes(ancestor.name))
                media.unshift(`@${ancestor.name} ${ancestor.params}`);
        return { file, line: node.source?.start?.line || 1, selector, media: media.join(" · ") };
    };
    const readCSS = (source, file, inlineSelector, lineOffset = 0) => {
        const css = postcss.parse(source, { from: file });
        css.walkDecls((declaration) => {
            const place = location(declaration, file);
            place.line += lineOffset;
            if (inlineSelector) place.selector = inlineSelector;
            if (declaration.prop.startsWith("--"))
                tokenFor(declaration.prop).definitions.push({ ...place, value: declaration.value });
            for (const [, name] of declaration.value.matchAll(/var\(\s*(--[\w-]+)/g))
                tokenFor(name).usages.push({ ...place, property: declaration.prop, value: declaration.value });
        });
    };
    const cssFiles = filesIn(resolve(root, "src/css")).filter(
        (file) =>
            file.endsWith(".css") &&
            !["customizer.css", "token-reference.css", "template-overrides.css"].includes(
                projectPath(root, file).split("/").at(-1),
            ),
    );
    for (const file of cssFiles) readCSS(readSource(file), projectPath(root, file));
    const htmlFiles = [...pages.map((page) => resolve(root, page.file)), ...filesIn(resolve(root, "src/components"))];
    for (const file of htmlFiles.filter((file) => file.endsWith(".html"))) {
        const html = readSource(file);
        for (const match of html.matchAll(/<[^>]+\bstyle=(['"])(.*?)\1[^>]*>/gs)) {
            const classes = match[0]
                .match(/\bclass=(['"])(.*?)\1/s)?.[2]
                ?.split(/\s+/)
                .filter((name) => /^[a-z][\w-]*$/.test(name));
            readCSS(
                match[2],
                projectPath(root, file),
                classes?.length ? `.${classes[0]}` : "inline style",
                html.slice(0, match.index).split("\n").length - 1,
            );
        }
    }
    for (const file of [
        ...filesIn(resolve(root, "src/js/components")),
        ...filesIn(resolve(root, "src/js/pages")),
    ].filter((file) => file.endsWith(".js"))) {
        const source = readSource(file);
        for (const match of source.matchAll(/\b(getPropertyValue|setProperty)\(\s*["'](--[\w-]+)["']/g)) {
            const runtime = match[1] === "setProperty";
            tokenFor(match[2])[runtime ? "definitions" : "usages"].push({
                file: projectPath(root, file),
                line: source.slice(0, match.index).split("\n").length,
                selector: "JavaScript",
                runtime,
                ...(runtime ? { value: "محاسبه در زمان اجرا" } : {}),
            });
        }
    }
    return [...tokens.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((token) => {
            const descriptions = describeToken(token.name);
            const places = [...token.definitions, ...token.usages];
            const pageNames = [...new Set(places.flatMap((place) => pageNamesFor(place.file, place.selector)))];
            const shared = places.some((place) => !pageNamesFor(place.file, place.selector).length);
            return {
                ...token,
                ...descriptions,
                pages: pageNames,
                shared,
                editable: TOKEN_CONTRACTS[token.name]?.editable === true,
                contract: TOKEN_CONTRACTS[token.name],
                runtime: token.definitions.some((definition) => definition.runtime),
                buildToken: token.definitions.some((definition) => definition.selector === "@theme"),
            };
        });
}

export function designTokenReference(root) {
    return {
        name: "marpich-design-token-reference",
        resolveId(id) {
            if (id === moduleId) return `\0${moduleId}`;
        },
        load(id) {
            if (id === `\0${moduleId}`) return `export default ${JSON.stringify(collectDesignTokens(root))};`;
        },
        handleHotUpdate(context) {
            const file = projectPath(root, context.file);
            if (
                ["src/css/template-overrides.css", "src/css/customizer.css", "src/css/token-reference.css"].includes(
                    file,
                )
            )
                return;
            if (!/^(src\/(css|components|js\/(components|pages))\/|[^/]+\.html$)/.test(file)) return;
            const module = context.server.moduleGraph.getModuleById(`\0${moduleId}`);
            if (module) {
                context.server.moduleGraph.invalidateModule(module);
                return [...context.modules, module];
            }
        },
    };
}
