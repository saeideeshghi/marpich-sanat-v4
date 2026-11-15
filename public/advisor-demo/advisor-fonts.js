if (window.parent !== window) {
    document.documentElement.dataset.embedded = "true";
    window.addEventListener("message", async (event) => {
        if (event.source !== window.parent || event.origin !== location.origin ||
            event.data?.type !== "marpich:advisor-fonts" || !Array.isArray(event.data.fonts)) return;
        await Promise.allSettled(event.data.fonts.map(async ({family, weight, bytes}) => {
            const face = new FontFace(family + " Demo", bytes, {weight});
            document.fonts.add(await face.load());
        }));
    });
}
