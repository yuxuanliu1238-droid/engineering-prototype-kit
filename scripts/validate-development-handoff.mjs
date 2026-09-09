import { safePath as projectPath } from "./safe-path.mjs";
import { promises as fs } from "node:fs";

import { printResult, ROOT } from "./project-lib.mjs";
import {
  renderDevelopmentTaskList,
  summarizeTaskTypes,
  validateDevelopmentHandoff,
} from "./development-handoff-lib.mjs";

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!["--input", "--expected"].includes(key) || !args[index + 1])
      throw new Error(`参数无效：${key || "缺失"}`);
    values[key.slice(2)] = args[index + 1];
  }
  return values;
}

function safePath(relativePath) {
  return projectPath(ROOT, relativePath);
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) throw new Error("必须提供 --input");
const data = JSON.parse(await fs.readFile(safePath(args.input), "utf8"));
const errors = validateDevelopmentHandoff(data);
if (args.expected) {
  const expected = renderDevelopmentTaskList(data);
  const actual = await fs.readFile(safePath(args.expected), "utf8");
  if (actual !== expected) errors.push("研发任务清单 Markdown 与结构化台账不同源，请重新生成");
}

printResult(
  "研发任务清单校验",
  errors,
  `${data.tasks?.length || 0} 项任务，${summarizeTaskTypes(data)}`,
);
