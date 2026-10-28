// Message lookup is supplied by the server/build in the current page only.
// Persian returns the original strings byte-for-byte; no locale dictionary is downloaded.
let dictionary;
const locale = () => (typeof document === "undefined" ? "fa" : document.documentElement.lang);
const normal = (value) => String(value).replace(/\s+/g, " ").trim();
function messages() {
    if (dictionary) return dictionary;
    const element = document.getElementById("site-locale-messages");
    dictionary = element ? JSON.parse(element.textContent) : {};
    return dictionary;
}
export function t(value) {
    if (locale() === "fa") return value;
    const result = messages()[normal(value)];
    if (typeof result !== "string") throw new Error("Missing interface translation: " + normal(value));
    const prefix = value.match(/^\s*/)?.[0] || "";
    const suffix = value.match(/\s*$/)?.[0] || "";
    return prefix + result + suffix;
}
function displayValue(value) {
    if (typeof value === "string" && typeof messages()[normal(value)] === "string") return t(value);
    if (typeof value === "number")
        return new Intl.NumberFormat(locale(), {
            useGrouping: false,
            numberingSystem: locale() === "ar" ? "arab" : "latn",
        }).format(value);
    const ascii = String(value).replace(/[۰-۹٠-٩]/g, (d) => String(d.charCodeAt(0) % 16));
    return locale() === "ar" ? ascii.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]) : ascii;
}
export function tf(value, args) {
    const translated = t(value);
    return translated.replace(/\{(\d+)\}/g, (_, index) =>
        locale() === "fa" ? String(args[index]) : displayValue(args[index]),
    );
}
