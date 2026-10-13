// Publication retries are exercised against local bare repositories, never GitHub.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishGithub } from "./publish-github.js";
// Spaces, parentheses and Persian characters match the owner's Windows path.
const scratch = mkdtempSync(join(tmpdir(), "marpich publish (V3) صنعت-"));
const remote = join(scratch, "remote.git");
const repo = join(scratch, "repo with spaces (V3)");
const git = (args, cwd = repo) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
};
let failPush = false,
    failChecks = false,
    windowsRootAlias = false;
const calls = [];
const execute = (program, args, cwd) => {
    calls.push([program, ...args]);
    if (program === "npm") return { status: failChecks ? 1 : 0, stdout: "" };
    if (program !== "git") return { status: 0, stdout: "" }; // Cleanup is covered by check-project.
    if (args[0] === "push" && failPush) return { status: 1, stdout: "" };
    // The old filesystem-string comparison rejects this alternative Windows
    // spelling before validation. Root verification must use Git's own cwd.
    if (windowsRootAlias && args.join(" ") === "rev-parse --show-toplevel")
        return { status: 0, stdout: "C:/Users/SAEID_~1/AppData/Local/Temp/fixture/repo\r\n" };
    const result = spawnSync(program, args, { cwd, encoding: "utf8" });
    return { status: result.status, stdout: result.stdout };
};
const publish = (releaseTag) =>
    publishGithub({ cwd: repo, allowedOrigin: remote, execute, releaseTag, report: () => {} });
try {
    git(["init", "--bare", remote], scratch);
    mkdirSync(repo);
    git(["init", "-b", "main"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "user.email", "fixture@example.test"]);
    git(["config", "commit.gpgsign", "false"]);
    git(["config", "tag.gpgsign", "false"]);
    git(["config", "core.hooksPath", ".git/hooks"]);
    git(["remote", "add", "origin", remote]);
    writeFileSync(join(repo, "package.json"), '{"version":"3.0.0"}\n');
    git(["add", "."]);
    git(["commit", "-m", "Initial"]);
    git(["tag", "-a", "v3", "-m", "V3"]);
    git(["push", "origin", "main", "refs/tags/v3"]);
    const oldTag = git(["rev-parse", "refs/tags/v3"]);
    writeFileSync(join(repo, "package.json"), '{"version":"4.0.0"}\n');
    writeFileSync(join(repo, "edit.txt"), "Products grid fix\n");
    publish();
    assert.equal(git(["rev-parse", "refs/tags/v3"]), oldTag);
    assert.equal(git(["rev-parse", "HEAD"]), git(["rev-parse", "refs/heads/main"], remote));
    assert.equal(git(["rev-parse", "refs/tags/v3"], remote), oldTag);
    windowsRootAlias = true;
    publish();
    const alias = join(scratch, "repository alias (V3)");
    symlinkSync(repo, alias, process.platform === "win32" ? "junction" : "dir");
    try {
        publishGithub({ cwd: alias, allowedOrigin: remote, execute, report: () => {} });
    } finally {
        rmSync(alias);
    }
    assert.equal(git(["rev-parse", "HEAD"]), git(["rev-parse", "refs/heads/main"], remote));
    assert.throws(() => publish("v3"), /earlier commit/);
    assert.equal(git(["rev-parse", "refs/tags/v3"], remote), oldTag);
    failPush = true;
    assert.throws(() => publish("v3.0.1"), /git failed/);
    const retryTag = git(["rev-parse", "refs/tags/v3.0.1"]);
    failPush = false;
    publish("v3.0.1");
    assert.equal(git(["rev-parse", "refs/tags/v3.0.1"], remote), retryTag);
    publish("v3.0.1");
    assert.equal(git(["rev-parse", "refs/tags/v3.0.1"], remote), retryTag);
    failChecks = true;
    const count = calls.filter((c) => c[0] === "git" && c[1] === "push").length;
    assert.throws(() => publish(), /npm failed/);
    assert.equal(calls.filter((c) => c[0] === "git" && c[1] === "push").length, count);
    assert.throws(
        () => publishGithub({ cwd: repo, allowedOrigin: "https://other.example/repo", execute }),
        /Origin must/,
    );
    const nested = join(repo, "nested");
    mkdirSync(nested);
    const beforeNested = calls.length;
    assert.throws(
        () => publishGithub({ cwd: nested, allowedOrigin: remote, execute, report: () => {} }),
        /repository root/,
    );
    assert(
        !calls.slice(beforeNested).some((c) => c[0] === "npm" || ["switch", "add", "commit", "push"].includes(c[1])),
    );
    windowsRootAlias = false;
    assert.throws(() => publish("v3;bad"), /version tag/);
    assert(!calls.some((c) => c.includes("--force") || c.includes("--force-with-lease")));
    console.log(
        "PASS: repository roots with spaces/Unicode, Windows path aliases and junctions; nested folders stop before changes; immutable tags and push retries; failed validation stops publication.",
    );
} finally {
    rmSync(scratch, { recursive: true, force: true });
}
