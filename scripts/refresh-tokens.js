import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { format, resolveConfig } from "prettier";
import { collectDesignTokens } from "../build/design-tokens.js";
import { tokenContract } from "../build/token-contract.js";

const root = resolve(import.meta.dirname, "..");
const contract = tokenContract(collectDesignTokens(root));
const file = resolve(root, "src/data/customizer/token-contract.json");
const options = await resolveConfig(file);
writeFileSync(file, await format(JSON.stringify(contract, null, 2), { ...options, filepath: file }));
console.log(`Updated ${Object.keys(contract).length} source variable contracts.`);
