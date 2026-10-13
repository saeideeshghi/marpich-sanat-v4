const counts = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
const number = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

// Validate parameter groups, not just the character allowlist. In particular,
// "tc0.2..." consists of allowed letters but is invalid SVG path syntax.
// SVG grammar: https://www.w3.org/TR/SVG/paths.html#PathDataBNF
export function isValidSvgPath(data, maxNumber = Infinity) {
    if (typeof data !== "string" || !data.trim() || data.length > 30000) return false;
    let offset = 0,
        command = null,
        first = true,
        group = 0;
    const whitespace = () => {
        while (/[\t\n\r ]/.test(data[offset] || "\0")) offset++;
    };
    while (offset < data.length) {
        whitespace();
        if (offset === data.length) break;
        if (/[a-z]/i.test(data[offset])) {
            command = data[offset++].toUpperCase();
            group = 0;
            if (first && command !== "M") return false;
            first = false;
            if (command === "Z") {
                command = null;
                continue;
            }
            if (!Object.hasOwn(counts, command)) return false;
        } else if (!command) return false;
        for (let argument = 0; argument < counts[command]; argument++) {
            whitespace();
            if (data[offset] === ",") {
                if (argument === 0 && group === 0) return false;
                offset++;
                whitespace();
            }
            // Arc flags are single characters, including the compact "01".
            if (command === "A" && (argument === 3 || argument === 4)) {
                if (data[offset] !== "0" && data[offset] !== "1") return false;
                offset++;
            } else {
                const token = data.slice(offset).match(number)?.[0];
                if (!token || !Number.isFinite(Number(token)) || Math.abs(Number(token)) > maxNumber) return false;
                offset += token.length;
            }
        }
        group++;
    }
    return !first;
}
