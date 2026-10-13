import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { githubPagesUrl, parseGithubRepository, repositoryFromOrigin } from "../build/github-pages.js";

const projectRoot = resolve(import.meta.dirname, "..");
function executeGit(program, args, cwd) {
    console.log(`> ${program} ${args.join(" ")}`);
    const result = spawnSync(program, args, { cwd, encoding: "utf8", shell: false });
    if (result.error) throw result.error;
    if (result.stdout) process.stdout.write(result.stdout);
    // A folder outside Git and a missing origin are normal during first setup.
    return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

export function setupGithub({
    cwd = projectRoot,
    repository,
    replaceOrigin = false,
    execute = executeGit,
    report = console.log,
} = {}) {
    const target = parseGithubRepository(repository).repository;
    if (!existsSync(resolve(cwd, "package.json"))) throw new Error("Run setup beside the project's package.json.");
    const git = (args, statuses = [0]) => {
        const result = execute("git", args, cwd);
        if (!statuses.includes(result.status))
            throw new Error(result.stderr?.trim() || `Git setup failed (${result.status}).`);
        return result;
    };
    const inside = git(["rev-parse", "--is-inside-work-tree"], [0, 128]);
    let origin = "";
    if (inside.status === 0) {
        if (git(["rev-parse", "--show-prefix"]).stdout.trim())
            throw new Error("This folder is inside another Git repository. Use a separate folder for the new site.");
        origin = git(["remote", "get-url", "origin"], [0, 2]).stdout.trim();
        if (origin && repositoryFromOrigin(origin).toLowerCase() !== target.toLowerCase()) {
            if (!replaceOrigin)
                throw new Error(
                    "This folder already points to another origin. Extract the new ZIP into a separate folder without copying the old .git directory.",
                );
            // Migration is explicit and preserves the old remote and history.
            const previous = git(["remote", "get-url", "previous-origin"], [0, 2]);
            if (previous.status === 0 && previous.stdout.trim() !== origin)
                throw new Error("previous-origin already points elsewhere. Review remotes before migration.");
            if (previous.status === 2) git(["remote", "add", "previous-origin", origin]);
            git(["remote", "set-url", "origin", `https://github.com/${target}.git`]);
            origin = `https://github.com/${target}.git`;
        }
    } else git(["init", "-b", "main"]);
    if (!origin) git(["remote", "add", "origin", `https://github.com/${target}.git`]);
    writeFileSync(resolve(cwd, "github-pages.json"), JSON.stringify({ repository: target }, null, 2) + "\n");
    report(`[OK] Target: ${target}. Create that repository on GitHub, then run npm run publish:github.`);
    report(`Pages URL after a successful deployment: ${githubPagesUrl(target)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const args = process.argv.slice(2);
        if (
            args[0] !== "--repo" ||
            !args[1] ||
            (args.length !== 2 && !(args.length === 3 && args[2] === "--replace-origin"))
        )
            throw new Error("Usage: npm run github:setup -- --repo OWNER/REPO [--replace-origin]");
        setupGithub({ repository: args[1], replaceOrigin: args.includes("--replace-origin") });
    } catch (error) {
        console.error(`[STOP] ${error.message}`);
        process.exitCode = 1;
    }
}
