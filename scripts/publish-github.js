import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { githubPagesUrl, readGithubRepository, repositoryFromOrigin } from "../build/github-pages.js";

const projectRoot = resolve(import.meta.dirname, "..");

export function publishCommand(
    program,
    args,
    {
        platform = process.platform,
        execPath = process.execPath,
        npmExecPath = process.env.npm_execpath,
        comSpec = process.env.ComSpec || "cmd.exe",
    } = {},
) {
    if (platform !== "win32" || program !== "npm") return { program, args };
    // npm run supplies the JS entrypoint. Running it with Node keeps each argument
    // separate and avoids shell:true's Windows DEP0190 warning.
    if (typeof npmExecPath === "string" && /(?:^|[\\/])npm-cli\.js$/i.test(npmExecPath))
        return { program: execPath, args: [npmExecPath, ...args] };
    // Direct node invocation may lack npm_execpath. Only fixed commands may pass
    // through cmd.exe; no caller-provided text becomes a shell command.
    const commands = new Map([
        ["ci", "npm ci"],
        ["run check", "npm run check"],
        ["run check:release", "npm run check:release"],
        ["run build:pages", "npm run build:pages"],
    ]);
    const command = commands.get(args.join(" "));
    if (!command) throw new Error("Unsupported npm command for Windows publication.");
    return { program: comSpec, args: ["/d", "/s", "/c", command] };
}

function runCommand(program, args, cwd) {
    console.log(`> ${program} ${args.join(" ")}`);
    const command = publishCommand(program, args);
    const result = spawnSync(command.program, command.args, {
        cwd,
        encoding: "utf8",
        shell: false,
        stdio: ["inherit", "pipe", "pipe"],
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    return { status: result.status, stdout: result.stdout || "" };
}

// The CLI always checks the intended repository. The exported function also
// supports isolated Git fixtures, so retries can be tested without publishing.
export function publishGithub({
    cwd = projectRoot,
    releaseTag = "",
    allowedOrigin,
    execute = runCommand,
    report = console.log,
} = {}) {
    const run = (program, args, statuses = [0]) => {
        const result = execute(program, args, cwd);
        if (!statuses.includes(result.status))
            throw new Error(
                `${program} failed (${result.status}). Resolve the error above and run this command again.`,
            );
        return result;
    };
    const git = (args, statuses) => run("git", args, statuses);
    const readGit = (args) => git(args).stdout.trim();
    if (releaseTag && !/^v[0-9][A-Za-z0-9._-]*$/.test(releaseTag))
        throw new Error("Use a version tag such as v4 or v4.0.1.");
    if (releaseTag) git(["check-ref-format", `refs/tags/${releaseTag}`]);
    if (readGit(["rev-parse", "--is-inside-work-tree"]) !== "true")
        throw new Error("Run in the project repository clone.");
    const origin = readGit(["remote", "get-url", "origin"]);
    const repository = allowedOrigin ? "" : readGithubRepository(cwd);
    const originMatches = allowedOrigin
        ? typeof allowedOrigin === "string"
            ? origin === allowedOrigin
            : allowedOrigin.test(origin)
        : repositoryFromOrigin(origin).toLowerCase() === repository.toLowerCase();
    if (!originMatches)
        throw new Error(
            `Origin must match ${repository || "the configured repository"}. Use github:setup in a separate folder for a new repository. No files were published.`,
        );
    // Let Git resolve the working directory. Windows TEMP can use an 8.3 alias
    // while --show-toplevel uses its long name; comparing those strings can
    // reject a real repository root. Git's prefix is empty only at that root,
    // independent of path spelling, separators, case or directory junctions.
    if (readGit(["rev-parse", "--show-prefix"]) !== "")
        throw new Error(
            "Run the publisher from the Git repository root. If the project is nested, merge its contents beside the clone's package.json first.",
        );
    // An empty repository already has an unborn main branch: git switch main
    // would fail before its first commit. Existing clones still switch normally.
    if (git(["symbolic-ref", "--quiet", "--short", "HEAD"], [0, 1]).stdout.trim() !== "main") git(["switch", "main"]);
    const version = () => JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8")).version;
    const releaseVersion = version();
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(releaseVersion) || Number(releaseVersion.split(".")[0]) < 3)
        throw new Error("Merge the current project files into this clone first.");
    run(process.execPath, ["scripts/clean-legacy.js", "--apply"]);
    const validate = () => {
        run("npm", ["ci"]);
        run("npm", ["run", "check:release"]);
        run("npm", ["run", "build:pages"]);
    };
    validate();
    git(["status", "--short"]);
    git(["add", "-A"]);
    if (git(["diff", "--cached", "--quiet"], [0, 1]).status === 1)
        git(["commit", "-m", `Update Marpich Sanat ${releaseVersion}`]);
    const beforeRebase = readGit(["rev-parse", "HEAD"]);
    if (readGit(["ls-remote", "--heads", "origin", "refs/heads/main"])) {
        git(["pull", "--rebase", "origin", "main"]);
    } else if (readGit(["ls-remote", "--heads", "origin"])) {
        throw new Error("Origin has another branch but no main. Review the repository before publishing.");
    }
    if (version() !== releaseVersion)
        throw new Error("The rebased package version changed. Review it before publishing.");
    const head = readGit(["rev-parse", "HEAD"]);
    if (head !== beforeRebase) validate();
    if (readGit(["status", "--porcelain"]))
        throw new Error("Validation changed source files. Review and commit them, then run again.");

    let pushTag = false;
    if (releaseTag) {
        const ref = `refs/tags/${releaseTag}`;
        const localExists = git(["show-ref", "--verify", "--quiet", ref], [0, 1]).status === 0;
        if (localExists && readGit(["rev-parse", `${ref}^{commit}`]) !== head)
            throw new Error(
                `Local tag ${releaseTag} belongs to an earlier commit. Keep it and choose a new tag, or publish main without --release-tag.`,
            );
        const remote = readGit(["ls-remote", "--tags", "origin", ref, `${ref}^{}`]);
        const remoteLines = remote
            .split("\n")
            .filter(Boolean)
            .map((line) => line.split(/\s+/));
        const remoteCommit =
            remoteLines.find((line) => line[1] === `${ref}^{}`)?.[0] ||
            remoteLines.find((line) => line[1] === ref)?.[0];
        if (remoteCommit && remoteCommit !== head)
            throw new Error(
                `Remote tag ${releaseTag} belongs to an earlier release. Choose a new tag, or publish main without --release-tag.`,
            );
        if (!remoteCommit) {
            if (!localExists) git(["tag", "-a", releaseTag, "-m", `Marpich Sanat ${releaseTag}`]);
            pushTag = true;
        }
    }
    // Ordinary updates only publish main; an existing v3 tag cannot block them.
    git(
        pushTag
            ? ["push", "--set-upstream", "--atomic", "origin", "main", `refs/tags/${releaseTag}`]
            : ["push", "--set-upstream", "origin", "main"],
    );
    report(
        `[OK] ${releaseVersion} published: main${pushTag ? ` + ${releaseTag}` : ""}. Check the GitHub Actions deployment.`,
    );
    if (repository) report(`Site after deployment: ${githubPagesUrl(repository)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const args = process.argv.slice(2);
        if (args.length && (args.length !== 2 || args[0] !== "--release-tag"))
            throw new Error("Usage: npm run publish:github [-- --release-tag v4.0.1]");
        publishGithub({ releaseTag: args[1] || "" });
    } catch (error) {
        console.error(`[STOP] ${error.message}`);
        process.exitCode = 1;
    }
}
