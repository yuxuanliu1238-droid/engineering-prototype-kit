import path from "node:path";
import { lstatSync, realpathSync } from "node:fs";

// Reject links below the project boundary, including dangling output links.
export function safePath(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative.trim() ||
    path.isAbsolute(relative) ||
    relative.includes("\0")
  )
    throw new Error("路径必须是项目内相对路径");
  const target = path.resolve(root, relative);
  const rel = path.relative(path.resolve(root), target);
  if (rel === ".." || rel.startsWith(`..${path.sep}`)) throw new Error(`路径越出项目：${relative}`);
  let current = realpathSync(root);
  for (const segment of rel.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink())
        throw new Error(`项目路径不能经过符号链接：${relative}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return target;
}
