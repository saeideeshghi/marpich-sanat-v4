// New-repository setup/publication uses local fixtures only, never a GitHub push.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { githubPagesBase, githubPagesUrl, parseGithubRepository, repositoryFromOrigin } from "../build/github-pages.js";
import { setupGithub } from "./setup-github.js";
import { publishGithub } from "./publish-github.js";

const root = resolve(import.meta.dirname, "..");
assert(
    existsSync(join(root, ".github/workflows/pages.yml")),
    "Missing .github/workflows/pages.yml. Extract the complete ZIP beside package.json before publishing.",
);

for (const name of ["marpich-sanat-v3", "another-site", "site_with.dots"])
    assert.equal(githubPagesBase(`saeideeshghi/${name}`), `/${name}/`);
assert.equal(githubPagesBase("saeideeshghi/saeideeshghi.github.io"), "/");
assert.equal(githubPagesUrl("saeideeshghi/marpich-sanat-v3"), "https://saeideeshghi.github.io/marpich-sanat-v3/");
for (const value of [
    "",
    "owner",
    "owner/..",
    "owner/repo/extra",
    "owner/a b",
    "owner/repo;bad",
    "https://github.com/o/r",
])
    assert.throws(() => parseGithubRepository(value), /OWNER\/REPO/);
for (const url of [
    "https://github.com/saeideeshghi/marpich-sanat-v3.git",
    "git@github.com:saeideeshghi/marpich-sanat-v3.git",
])
    assert.equal(repositoryFromOrigin(url), "saeideeshghi/marpich-sanat-v3");
assert.equal(repositoryFromOrigin("https://github.com.evil.test/saeideeshghi/marpich-sanat-v3.git"), "");

const scratch = mkdtempSync(join(tmpdir(), "marpich new repo (V3) صنعت-"));
const remote = join(scratch, "empty-origin.git"),
    repo = join(scratch, "fresh project");
const calls = [];
const execute = (program, args, cwd) => {
    calls.push([program, ...args]);
    if (program !== "git") return { status: 0, stdout: "" }; // Actual checks/builds run in the project pipeline.
    const result = spawnSync(program, args, { cwd, encoding: "utf8" });
    return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
};
const git = (args, cwd = repo) => {
    const result = execute("git", args, cwd);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
};
try {
    mkdirSync(repo);
    writeFileSync(join(repo, "package.json"), '{"version":"3.0.0"}\n');
    setupGithub({ cwd: repo, repository: "saeideeshghi/marpich-sanat-v3", execute, report: () => {} });
    assert.equal(git(["symbolic-ref", "--short", "HEAD"]), "main");
    assert.equal(git(["remote", "get-url", "origin"]), "https://github.com/saeideeshghi/marpich-sanat-v3.git");
    const settings = readFileSync(join(repo, "github-pages.json"), "utf8");
    setupGithub({ cwd: repo, repository: "saeideeshghi/marpich-sanat-v3", execute, report: () => {} });
    assert.equal(readFileSync(join(repo, "github-pages.json"), "utf8"), settings, "Setup retry preserves the target");
    const beforeWrong = calls.length;
    assert.throws(
        () => setupGithub({ cwd: repo, repository: "saeideeshghi/marpich-sanat", execute }),
        /already points to another origin/,
    );
    assert.equal(git(["remote", "get-url", "origin"]), "https://github.com/saeideeshghi/marpich-sanat-v3.git");
    assert.equal(readFileSync(join(repo, "github-pages.json"), "utf8"), settings);
    assert(!calls.slice(beforeWrong).some((c) => ["init", "add", "set-url", "commit", "push"].includes(c[1])));
    setupGithub({
        cwd: repo,
        repository: "saeideeshghi/marpich-sanat-v4",
        replaceOrigin: true,
        execute,
        report: () => {},
    });
    assert.equal(git(["remote", "get-url", "origin"]), "https://github.com/saeideeshghi/marpich-sanat-v4.git");
    assert.equal(git(["remote", "get-url", "previous-origin"]), "https://github.com/saeideeshghi/marpich-sanat-v3.git");
    setupGithub({
        cwd: repo,
        repository: "saeideeshghi/marpich-sanat-v4",
        replaceOrigin: true,
        execute,
        report: () => {},
    });
    const nested = join(repo, "nested");
    mkdirSync(nested);
    writeFileSync(join(nested, "package.json"), '{"version":"3.0.0"}\n');
    assert.throws(() => setupGithub({ cwd: nested, repository: "saeideeshghi/site", execute }), /inside another Git/);
    rmSync(nested, { recursive: true });
    git(["init", "--bare", remote], scratch);
    git(["remote", "set-url", "origin", remote]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "user.email", "fixture@example.test"]);
    git(["config", "commit.gpgsign", "false"]);
    git(["config", "core.hooksPath", ".git/hooks"]);
    const publish = () => publishGithub({ cwd: repo, allowedOrigin: remote, execute, report: () => {} });
    const beforeFirst = calls.length;
    publish();
    assert.equal(git(["rev-parse", "HEAD"]), git(["rev-parse", "refs/heads/main"], remote));
    assert(!calls.slice(beforeFirst).some((c) => c[1] === "pull"), "An empty origin must not be pulled");
    writeFileSync(join(repo, "update.txt"), "Next website update\n");
    const beforeSecond = calls.length;
    publish();
    assert(calls.slice(beforeSecond).some((c) => c[1] === "pull" && c.includes("--rebase")));
    assert.equal(git(["rev-parse", "HEAD"]), git(["rev-parse", "refs/heads/main"], remote));
    git(["remote", "set-url", "origin", "https://github.com/saeideeshghi/marpich-sanat.git"]);
    const beforeOldOrigin = calls.length;
    assert.throws(() => publishGithub({ cwd: repo, execute, report: () => {} }), /Origin must match/);
    assert(
        !calls.slice(beforeOldOrigin).some((c) => c[0] === "npm" || ["switch", "add", "commit", "push"].includes(c[1])),
    );
    assert(!calls.some((c) => c.includes("--force") || c.includes("--force-with-lease")));
    console.log(
        "PASS: configurable Pages base, safe new-repository setup, empty-origin first push, repeat updates and rejection of an old origin before changes.",
    );
} finally {
    rmSync(scratch, { recursive: true, force: true });
}
