import postcss from "postcss";

const negate = (value) =>
    value === "var(--tw-translate-x)"
        ? value // Tailwind's shared horizontal variable is mirrored at its declaration.
        : /^-?[\d.]+(?:[a-z%]+)?$/i.test(value)
          ? value.startsWith("-")
              ? value.slice(1)
              : Number.parseFloat(value) === 0
                ? value
                : "-" + value
          : `calc(-1 * (${value}))`;

// Vite can shorten translateX(x) to translate(x). Parse balanced function
// arguments so development and minified production CSS use the same geometry.
export function mirrorTranslation(value) {
    const pattern = /\b(translateX|translate3d|translate)\(/g;
    const edits = [];
    for (let match; (match = pattern.exec(value));) {
        const start = pattern.lastIndex;
        let end = start,
            depth = 1;
        for (; end < value.length && depth; end++) {
            if (value[end] === "(") depth++;
            if (value[end] === ")") depth--;
        }
        if (depth) throw new Error("Unbalanced CSS translation: " + value);
        const args = value.slice(start, end - 1);
        const comma = postcss.list.comma(args);
        const parts = comma.length > 1 ? comma : postcss.list.space(args);
        parts[0] = negate(parts[0]);
        edits.push({ start, end: end - 1, text: parts.join(comma.length > 1 ? ", " : " ") });
        pattern.lastIndex = end;
    }
    for (const edit of edits.reverse()) value = value.slice(0, edit.start) + edit.text + value.slice(edit.end);
    return value;
}

function mirrorPosition(value) {
    return postcss.list
        .comma(value)
        .map((layer) => {
            if (/\b(?:left|right)\b/.test(layer))
                return layer.replace(/\bleft\b|\bright\b/g, (word) => (word === "left" ? "right" : "left"));
            const parts = postcss.list.space(layer);
            if (/^(?:top|bottom|center)$/.test(parts[0])) return layer;
            if (/^-?[\d.]+%$/.test(parts[0])) parts[0] = `${100 - Number.parseFloat(parts[0])}%`;
            else if (/^-?[\d.]+(?:px|rem|em)?$/.test(parts[0])) {
                // A minified single length is an x offset with an implicit center y.
                return !parts[1] || /^(?:top|bottom|center)$/.test(parts[1])
                    ? `right ${parts[0]} ${parts[1] || "center"}`
                    : `calc(100% - ${parts[0]}) ${parts.slice(1).join(" ")}`;
            } else parts[0] = `calc(100% - (${parts[0]}))`;
            return parts.join(" ");
        })
        .join(", ");
}

export function flipCSS(css) {
    const ast = postcss.parse(css);
    ast.walkAtRules("font-face", (rule) => {
        if (rule.nodes.some((node) => node.prop === "font-family" && /Peyda/.test(node.value))) rule.remove();
    });
    ast.walkDecls((decl) => {
        if (decl.prop === "--font-peyda") decl.value = decl.value.replace(/Peyda/g, "D-DIN");
        if (decl.prop === "--tw-translate-x" && !decl.value.includes("var(--tw-translate-x)"))
            decl.value = negate(decl.value);
        if (decl.prop.startsWith("--")) return;
        decl.prop = decl.prop.replace(/left|right/g, (word) => (word === "left" ? "right" : "left"));
        if (/^(?:text-align|text-align-last|float|clear)$/.test(decl.prop))
            decl.value = decl.value.replace(/\bleft\b|\bright\b/g, (word) => (word === "left" ? "right" : "left"));
        if (decl.prop === "text-align" && decl.value === "justify") decl.value = "left";
        if (/^(?:background-position|object-position|transform-origin)$/.test(decl.prop))
            decl.value = mirrorPosition(decl.value);
        if (decl.prop === "direction" && decl.value === "rtl") decl.value = "ltr";
        if (/^background(?:-image)?$/.test(decl.prop))
            decl.value = decl.value
                .replace(
                    /linear-gradient\(\s*(-?[\d.]+)deg/g,
                    (_, angle) => "linear-gradient(" + ((((360 - Number(angle)) % 360) + 360) % 360) + "deg",
                )
                .replace(/\bto (left|right)\b/g, (_, direction) => "to " + (direction === "left" ? "right" : "left"));
        if (decl.prop === "font-family") decl.value = decl.value.replace(/Peyda/g, "D-DIN");
        // This marquee owns an explicitly LTR coordinate system in every locale.
        const marquee = decl.parent.parent?.name?.includes("keyframes") && decl.parent.parent.params === "partner-flow";
        if (decl.prop === "transform" && !marquee) decl.value = mirrorTranslation(decl.value);
        if (decl.prop === "translate" && decl.value !== "none") {
            const parts = postcss.list.space(decl.value);
            parts[0] = negate(parts[0]);
            decl.value = parts.join(" ");
        }
        if (/^(?:margin|padding|inset|border-width|border-style|border-color)$/.test(decl.prop)) {
            const values = postcss.list.space(decl.value);
            if (values.length === 4) decl.value = [values[0], values[3], values[2], values[1]].join(" ");
        }
        if (decl.prop === "border-radius") {
            decl.value = decl.value
                .split("/")
                .map((part) => {
                    const values = postcss.list.space(part.trim());
                    if (values.length === 4) return [values[1], values[0], values[3], values[2]].join(" ");
                    if (values.length === 3) return [values[1], values[0], values[1], values[2]].join(" ");
                    if (values.length === 2) return [values[1], values[0]].join(" ");
                    return part;
                })
                .join(" / ");
        }
    });
    return ast.toString();
}
