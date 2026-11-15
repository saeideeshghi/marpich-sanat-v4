// The demo frame has an opaque origin. Send the public font bytes from the site
// so the frame can use the same fonts without cross-origin font requests.
const persianFaces = [
    ["Peyda", "400", "fonts/Peyda-Regular[@fontbazi].ttf"],
    ["Peyda", "500 600", "fonts/Peyda-Medium[@fontbazi].ttf"],
    ["Peyda", "700 900", "fonts/Peyda-Bold[@fontbazi].ttf"],
];
const englishFaces = [
    ["D-DIN", "400", "fonts/en/D-DIN.otf"],
    ["D-DIN", "700", "fonts/en/D-DIN-Bold.otf"],
    ["Montserrat", "600 900", "fonts/en/Montserrat-Bold.ttf"],
];
const cachedFiles = new Map();

function loadFont(file) {
    if (!cachedFiles.has(file)) {
        const bytes = fetch(import.meta.env.BASE_URL + file)
            .then((response) => {
                if (!response.ok) throw new Error("Advisor font unavailable");
                return response.arrayBuffer();
            })
            .catch((error) => {
                cachedFiles.delete(file);
                throw error;
            });
        cachedFiles.set(file, bytes);
    }
    return cachedFiles.get(file);
}

export function initAdvisorFonts(frame, language) {
    frame.addEventListener("load", async () => {
        if (!frame.hasAttribute("src")) return;
        const faces = language === "en" ? englishFaces : persianFaces;
        const loaded = await Promise.allSettled(
            faces.map(async ([family, weight, file]) => ({ family, weight, bytes: await loadFont(file) })),
        );
        const fonts = loaded.filter((face) => face.status === "fulfilled").map((face) => face.value);
        // The payload contains only the site's public font files.
        if (fonts.length) frame.contentWindow?.postMessage({ type: "marpich:advisor-fonts", fonts }, "*");
    });
}
