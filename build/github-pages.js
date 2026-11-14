import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// One repository setting serves local builds and the publication guard.
// GitHub Actions supplies its actual repository name for the deployed base.
export function parseGithubRepository(repository) {
    if (typeof repository !== "string") throw new Error("Use a GitHub repository in OWNER/REPO format.");
    const parts = repository.split("/");
    if (
        parts.length !== 2 ||
        !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(parts[0]) ||
        !/^[A-Za-z0-9._-]{1,100}$/.test(parts[1]) ||
        [".", ".."].includes(parts[1])
    )
        throw new Error("Use a GitHub repository in OWNER/REPO format, without a URL or spaces.");
    return { owner: parts[0], name: parts[1], repository };
}

export function readGithubRepository(root) {
    const config = JSON.parse(readFileSync(resolve(root, "github-pages.json"), "utf8"));
    return parseGithubRepository(config.repository).repository;
}

export function githubPagesBase(repository) {
    const { owner, name } = parseGithubRepository(repository);
    return name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? "/" : `/${name}/`;
}
