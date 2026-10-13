import { targetSelector, ruleKey } from "./model.js";

// Opt-in unification only touches the same property, responsive range and state.
// Distinct children or rules at other widths keep their authored settings.
export function removeSharedPropertyOverrides(config, active, name) {
    const selector = targetSelector(active.target);
    const className = /^\.([\w-]+)$/.exec(selector)?.[1];
    for (const rule of config.rules) {
        if (
            ruleKey(rule) === ruleKey(active) ||
            rule.breakpoint !== active.breakpoint ||
            JSON.stringify(rule.range) !== JSON.stringify(active.range) ||
            (rule.state || "normal") !== (active.state || "normal")
        )
            continue;
        const other = targetSelector(rule.target);
        const terminal = other?.split(" > ").at(-1) || "";
        const same = other === selector || (className && new RegExp(`\\.${className}(?![\\w-])`).test(terminal));
        if (same) delete rule.properties[name];
    }
}
