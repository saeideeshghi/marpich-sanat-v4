// One launcher for CMD and npm: stale dependencies and native optional bindings
// are reinstalled before Vite starts. Source styles keep using the same server.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cache = resolve(root, ".cache");
const stampPath = resolve(cache, "customizer-install.json");
const logPath = resolve(cache, "customizer-start.log");
function log(message) {
    console.log(message);
    mkdirSync(cache, { recursive: true });
    writeFileSync(logPath, `${message}\n`, { flag: "a" });
}

export function nodeSupported(version) {
    const [major, minor] = version.replace(/^v/, "").split(".").map(Number);
    return major > 22 || (major === 22 && minor >= 12);
}

function installSignature() {
    return createHash("sha256")
        .update(readFileSync(resolve(root, "package-lock.json")))
        .update(`${process.platform}/${process.arch}/${process.versions.node.split(".")[0]}`)
        .digest("hex");
}
function dependencyVersionsMatch() {
    try {
        const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json")));
        for (const name of ["vite", "@tailwindcss/vite", "tailwindcss", "@fortawesome/fontawesome-free"])
            if (
                JSON.parse(readFileSync(resolve(root, "node_modules", name, "package.json"))).version !==
                lock.packages[`node_modules/${name}`].version
            )
                return false;
        return true;
    } catch {
        return false;
    }
}
async function installDependencies(signature) {
    log("Installing project dependencies (npm ci --include=optional)...");
    const isWindows = process.platform === "win32";
    const command = isWindows ? process.env.ComSpec || "cmd.exe" : "npm";
    const args = isWindows ? ["/d", "/s", "/c", "npm ci --include=optional"] : ["ci", "--include=optional"];
    await new Promise((accept, reject) => {
        const child = spawn(command, args, { cwd: root, stdio: "inherit" });
        child.on("error", reject);
        child.on("exit", (code) =>
            code === 0
                ? accept()
                : reject(new Error(`npm ci failed (${code}). Check the error above and your network connection.`)),
        );
    });
    mkdirSync(cache, { recursive: true });
    writeFileSync(stampPath, JSON.stringify({ signature }));
}

async function start() {
    mkdirSync(cache, { recursive: true });
    writeFileSync(logPath, "");
    log(`Marpich Customizer | Node ${process.versions.node} | ${process.platform} ${process.arch}`);
    if (!nodeSupported(process.versions.node))
        throw new Error(
            "Node.js 22.12 or newer is required. Install Node 24, reopen CMD, then run CUSTOMIZE.cmd again.",
        );
    const signature = installSignature();
    let installedSignature;
    try {
        installedSignature = JSON.parse(readFileSync(stampPath)).signature;
    } catch {
        /* First run. */
    }
    if (process.argv.includes("--check")) {
        if (!dependencyVersionsMatch())
            throw new Error(
                "Dependencies are missing or outdated. Run npm run customize to install them automatically.",
            );
        log("PASS: Node and project dependency versions are ready.");
        return;
    }
    if (signature !== installedSignature || !dependencyVersionsMatch()) await installDependencies(signature);
    // A missing platform binding can survive a copied node_modules directory.
    try {
        await import("@tailwindcss/vite");
        await import("vite");
    } catch {
        log("Repairing native build dependencies...");
        await installDependencies(signature);
    }
    const { createServer } = await import("vite");
    const server = await createServer({
        root,
        server: { host: "127.0.0.1", port: 5173, strictPort: false, open: "/tools/customizer.html" },
    });
    await server.listen();
    const address = server.httpServer.address();
    log(`Open: http://127.0.0.1:${address.port}/tools/customizer.html`);
    log("Keep this window open. Confirm in the editor writes CSS and JSON into the project. Press Ctrl+C to stop.");
    const stop = async () => {
        await server.close();
        process.exit(0);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    start().catch((error) => {
        log(`ERROR: ${error.message}`);
        log(`Details: ${logPath}`);
        process.exitCode = 1;
    });
}
