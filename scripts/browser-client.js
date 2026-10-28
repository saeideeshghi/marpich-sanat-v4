import { mkdirSync, writeFileSync } from "node:fs";
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
        ws.addEventListener("open", resolve, { once: true });
        ws.addEventListener("error", reject, { once: true });
    });
    let sequence = 0;
    const pending = new Map(),
        events = [];
    ws.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (!message.id) return events.push(message);
        const task = pending.get(message.id);
        if (!task) return;
        pending.delete(message.id);
        clearTimeout(task.timer);
        message.error ? task.reject(Error(JSON.stringify(message.error))) : task.resolve(message.result);
    });
    return {
        ws,
        events,
        call: (method, params = {}) =>
            new Promise((resolve, reject) => {
                const id = ++sequence;
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(Error("CDP timeout: " + method));
                }, 30000);
                pending.set(id, { resolve, reject, timer });
                ws.send(JSON.stringify({ id, method, params }));
            }),
    };
}
export async function browserClient() {
    const cdp = process.env.CDP_URL || "http://127.0.0.1:9227";
    const base = process.env.SITE_URL || "http://127.0.0.1:4180/";
    const version = await (await fetch(cdp + "/json/version")).json();
    const browser = await connect(version.webSocketDebuggerUrl);
    const { browserContextId } = await browser.call("Target.createBrowserContext");
    const { targetId } = await browser.call("Target.createTarget", { url: "about:blank", browserContextId });
    const targets = await (await fetch(cdp + "/json/list")).json();
    const page = await connect(targets.find((item) => item.id === targetId).webSocketDebuggerUrl);
    const evaluate = async (expression) => {
        const result = await page.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const waitFor = async (expression) => {
        for (let i = 0; i < 150; i++) {
            if (await evaluate(expression)) return;
            await delay(100);
        }
        throw Error(
            "Browser condition timed out: " +
                expression +
                "\n" +
                JSON.stringify(
                    page.events.filter((e) => e.method === "Runtime.exceptionThrown" || e.method === "Log.entryAdded"),
                ),
        );
    };
    await page.call("Page.enable");
    await page.call("Runtime.enable");
    await page.call("Log.enable");
    await page.call("Network.enable");
    const navigate = async (file, width = 1500) => {
        page.events.length = 0;
        await page.call("Emulation.setDeviceMetricsOverride", {
            width,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: width < 640,
        });
        await page.call("Page.navigate", { url: new URL(file, base).href });
        await waitFor("document.readyState==='complete' && document.body?.dataset.siteReady==='true'");
        await evaluate("document.fonts.ready");
        await delay(350);
    };
    const screenshot = async (name, full = false) => {
        mkdirSync(".cache/locale-screenshots", { recursive: true });
        const { data } = await page.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
        writeFileSync(".cache/locale-screenshots/" + name + ".png", Buffer.from(data, "base64"));
    };
    return {
        base,
        ...page,
        evaluate,
        waitFor,
        navigate,
        screenshot,
        close: async () => {
            page.ws.close();
            await browser.call("Target.disposeBrowserContext", { browserContextId });
            browser.ws.close();
        },
    };
}
