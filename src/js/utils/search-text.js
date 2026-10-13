/* Shared matching for article text and catalog options.
 * Normalize display variants only; keep native form values and visible text intact. */
export function normalizeSearchText(value) {
    return String(value ?? "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[يى]/g, "ی")
        .replace(/ك/g, "ک")
        .replace(/[\u064b-\u065f\u0670]/g, "")
        .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
        .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
        .replace(/[\s\u200c\u200d]+/g, "");
}
