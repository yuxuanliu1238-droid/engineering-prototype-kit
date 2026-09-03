import { promises as fs } from "node:fs";
import path from "node:path";
import { printResult, readJson, ROOT } from "./project-lib.mjs";
import { renderRequirements, validateRegistryData } from "./workflow-v3-lib.mjs";

const config = await readJson("project.config.json");
const registry = await readJson(config.paths.requirements);
const errors = validateRegistryData(registry);

if (!printResult("需求台账生成前校验", errors, `${registry.items.length} 条需求`)) {
  process.exit(1);
}

const outputPath = path.join(ROOT, config.paths.requirementsSummary);
await fs.writeFile(outputPath, renderRequirements(registry), "utf8");
console.log(`已生成：${config.paths.requirementsSummary}`);
