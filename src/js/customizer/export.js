import { normalizeConfig, compileCSS, persistedSettings } from "./model.js";

// Small, uncompressed ZIP. Keeps the exact project paths, with no dependency.
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

export function settingsArchive(config) {
    const normalized = normalizeConfig(config);
    const encoder = new TextEncoder();
    const files = [
        ["src/data/customizer/settings.json", `${JSON.stringify(persistedSettings(normalized), null, 2)}\n`],
        ["src/css/template-overrides.css", compileCSS(normalized)],
        ...Object.entries(normalized.patterns || {}).map(([kind, pattern]) => [
            `src/data/patterns/${kind === "header" ? "site" : "footer"}-pattern.json`,
            `${JSON.stringify(pattern, null, 2)}\n`,
        ]),
        [
            "APPLY-SETTINGS.txt",
            "پوشه src این بسته را کنار package.json پروژه Merge و Replace کنید. تصاویر و فونت‌های قبلی را نگه دارید.\nاجرای محلی: npm run customize\nخروجی سایت: npm run build:pages\nاین بسته شامل CSS، تنظیمات ریسپانسیو و پترن هدر/فوتر است؛ به مرورگر یا localStorage وابسته نیست.\nبرای انتشار: PUSH-GITHUB.cmd\n",
        ],
    ];
    const parts = [],
        central = [];
    let offset = 0,
        centralSize = 0;
    for (const [path, text] of files) {
        const name = encoder.encode(path),
            content = encoder.encode(text),
            checksum = crc32(content);
        const header = new Uint8Array(30 + name.length),
            view = new DataView(header.buffer);
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0x800, true);
        view.setUint16(12, 0x21, true);
        view.setUint32(14, checksum, true);
        view.setUint32(18, content.length, true);
        view.setUint32(22, content.length, true);
        view.setUint16(26, name.length, true);
        header.set(name, 30);
        const directory = new Uint8Array(46 + name.length),
            d = new DataView(directory.buffer);
        d.setUint32(0, 0x02014b50, true);
        d.setUint16(4, 20, true);
        d.setUint16(6, 20, true);
        d.setUint16(8, 0x800, true);
        d.setUint16(14, 0x21, true);
        d.setUint32(16, checksum, true);
        d.setUint32(20, content.length, true);
        d.setUint32(24, content.length, true);
        d.setUint16(28, name.length, true);
        d.setUint32(42, offset, true);
        directory.set(name, 46);
        parts.push(header, content);
        central.push(directory);
        offset += header.length + content.length;
        centralSize += directory.length;
    }
    const end = new Uint8Array(22),
        e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, centralSize, true);
    e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: "application/zip" });
}

export function downloadSettings(config) {
    const url = URL.createObjectURL(settingsArchive(config));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "marpich-template-settings.zip";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
