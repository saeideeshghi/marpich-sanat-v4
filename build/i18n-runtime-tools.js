import { parseSync } from "vite";
export const normalizeMessage = (value) => String(value).replace(/\s+/g, " ").trim();
export const hasPersianText = (value) => /[\u0600-\u06ff]/.test(value) && !/^[۰-۹٠-٩]+$/.test(value);
export function runtimeMessages(code, filename) {
    const result = parseSync(filename, code);
    if (result.errors.length) throw new Error("Cannot parse localization source: " + filename);
    const messages = [];
    const visit = (node, parent) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "Literal" && typeof node.value === "string" && hasPersianText(node.value)) {
            if (parent?.type === "Property" && parent.key === node && !parent.computed) return;
            messages.push({
                start: node.start,
                end: node.end,
                key: normalizeMessage(node.value),
                kind: "literal",
                value: node.value,
            });
            return;
        }
        if (node.type === "TemplateLiteral") {
            const value = node.quasis
                .map((q, i) => (q.value.cooked ?? q.value.raw) + (i < node.expressions.length ? "{" + i + "}" : ""))
                .join("");
            if (hasPersianText(value)) {
                messages.push({
                    start: node.start,
                    end: node.end,
                    key: normalizeMessage(value),
                    kind: "template",
                    value,
                    expressions: node.expressions.map((n) => code.slice(n.start, n.end)),
                });
                return;
            }
        }
        for (const [key, value] of Object.entries(node)) {
            if (["start", "end", "loc"].includes(key)) continue;
            if (Array.isArray(value)) value.forEach((n) => visit(n, node));
            else if (value && typeof value === "object") visit(value, node);
        }
    };
    visit(result.program);
    return messages;
}
