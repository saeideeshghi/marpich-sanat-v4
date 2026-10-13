// Old exports remain importable. Saved files use descriptive names and roles.
export const LEGACY_TOKEN_NAMES = {
    "--hero-title": "--hero-title-font-size",
    "--hero-description": "--hero-description-font-size",
    "--card-title": "--card-title-font-size",
    "--card-description": "--card-description-font-size",
};

export const TAG_TARGETS = ["card-media-tag", "card-meta-tag", "card-status-tag"];

export function migrateLegacyRules(rules) {
    return rules.flatMap((rule) => {
        if (rule?.target?.kind === "role" && rule.target.key === "card-tag")
            return TAG_TARGETS.map((key) => ({ ...rule, target: { kind: "role", key } }));
        if (typeof rule?.target?.selector === "string" && rule.target.selector.includes(".site-card__tag"))
            return ["media", "meta", "status"].map((kind) => ({
                ...rule,
                target: {
                    ...rule.target,
                    selector: rule.target.selector.replaceAll(".site-card__tag", `.site-card__${kind}-tag`),
                },
            }));
        return [rule];
    });
}
