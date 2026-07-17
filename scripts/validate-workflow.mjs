import { promises as fs } from "node:fs";
import path from "node:path";
import { printResult, readJson, ROOT } from "./project-lib.mjs";
import { renderRequirements, validateRegistryData } from "./workflow-lib.mjs";

const config = await readJson("project.config.json");
const registry = await readJson(config.paths.requirements);
const errors = validateRegistryData(registry);
const expected = renderRequirements(registry);
const actual = await fs.readFile(
  path.join(ROOT, config.paths.requirementsSummary),
  "utf8",
);

if (actual !== expected) {
  errors.push("requirements.md 与 registry.json 不同源，请运行 pnpm workflow:generate");
}

printResult("需求工作流校验", errors, `${registry.items.length} 条需求，流程和摘要同源`);
