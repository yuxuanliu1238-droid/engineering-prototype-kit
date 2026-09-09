import { safePath } from "./safe-path.mjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function readJson(relativePath) {
  const absolutePath = safePath(ROOT, relativePath);
  return JSON.parse(await fs.readFile(absolutePath, "utf8"));
}

export async function pathExists(relativePath) {
  try {
    await fs.access(safePath(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function walk(relativeDirectory, options = {}) {
  const { exclude = () => false } = options;
  const output = [];
  const start = path.join(ROOT, relativeDirectory);

  async function visit(absoluteDirectory) {
    const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const relativePath = path.relative(ROOT, absolutePath).split(path.sep).join("/");
      if (exclude(relativePath, entry)) continue;
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile()) output.push(relativePath);
    }
  }

  await visit(start);
  return output;
}

export function assertObject(value, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} 必须是对象`);
    return false;
  }
  return true;
}

export function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function requireStringArray(value, label, errors) {
  if (!Array.isArray(value) || value.some((item) => !hasText(item))) {
    errors.push(`${label} 必须是字符串数组`);
    return false;
  }
  return true;
}

export function validationResult(errors, source = "project") {
  return {
    valid: errors.length === 0,
    issues: [...new Set(errors)].map((reason) => ({
      code: /证据|报告|验收/.test(reason)
        ? "EVIDENCE_REQUIRED"
        : /路径|符号链接/.test(reason)
          ? "UNSAFE_PATH"
          : /就绪|授权|跳过|评审/.test(reason)
            ? "WORKFLOW_BLOCKED"
            : "INVALID_INPUT",
      field:
        reason.match(/(?:items\[\d+\]|config\.paths|project[^\s]*\.json)[^\s：]*/)?.[0] || source,
      reason,
      nextAction: /证据|报告|验收/.test(reason)
        ? "补齐当前有效引用并重新执行检查"
        : /授权|评审/.test(reason)
          ? "请产品经理确认当前范围与授权来源"
          : "修正指出的字段或文件后重新检查",
    })),
  };
}

export function printResult(label, errors, successDetail) {
  if (process.env.KIT_VALIDATION_JSON === "1") {
    console.log(JSON.stringify(validationResult(errors, label), null, 2));
    if (errors.length) process.exitCode = 1;
    return errors.length === 0;
  }
  if (errors.length) {
    console.error(`${label}失败（${errors.length} 项）：`);
    for (const error of [...new Set(errors)]) console.error(`- ${error}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`${label}通过：${successDetail}`);
  return true;
}
