import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function readJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  return JSON.parse(await fs.readFile(absolutePath, "utf8"));
}

export async function pathExists(relativePath) {
  try {
    await fs.access(path.join(ROOT, relativePath));
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

export function printResult(label, errors, successDetail) {
  if (errors.length) {
    console.error(`${label}失败（${errors.length} 项）：`);
    for (const error of [...new Set(errors)]) console.error(`- ${error}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`${label}通过：${successDetail}`);
  return true;
}
