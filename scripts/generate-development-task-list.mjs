import { safePath as projectPath } from "./safe-path.mjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    if (!["--input", "--output"].includes(key) || !args[index + 1])
      throw new Error(`参数无效：${key || "缺失"}`);
    values[key.slice(2)] = args[index + 1];
  }
  return values;
}

function safePath(relativePath) {
  return projectPath(ROOT, relativePath);
}

export async function generateDevelopmentTaskList({ input, output }) {
  if (!input || !output) throw new Error("必须提供 --input 和 --output");
  const data = JSON.parse(await fs.readFile(safePath(input), "utf8"));
  const errors = validateDevelopmentHandoff(data);
  if (
    !printResult(
      "研发任务清单生成前校验",
      errors,
      `${data.tasks?.length || 0} 项任务，${summarizeTaskTypes(data)}`,
    )
  ) {
    throw new Error("研发任务清单未通过校验");
  }
  const target = safePath(output);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderDevelopmentTaskList(data), "utf8");
  return target;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const target = await generateDevelopmentTaskList(args);
  console.log(`已生成：${path.relative(ROOT, target)}`);
}
