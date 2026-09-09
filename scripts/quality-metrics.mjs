import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { ROOT } from "./project-lib.mjs";
const require = createRequire(path.join(ROOT, "prototype/package.json"));
const pluginRequire = createRequire(require.resolve("@vitejs/plugin-react"));
const babelRequire = createRequire(pluginRequire.resolve("@babel/core"));
const { parse } = babelRequire("@babel/parser");
const traverse = babelRequire("@babel/traverse").default;
export async function measure(root) {
  const files = {};
  const fragments = new Map();
  async function visit(relative) {
    let entries;
    try {
      entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
    } catch (e) {
      if (e.code === "ENOENT") return;
      throw e;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await visit(path.join(relative, entry.name));
        continue;
      }
      if (!/\.(mjs|js|jsx)$/.test(entry.name)) continue;
      const file = path.join(relative, entry.name);
      const source = await fs.readFile(path.join(root, file), "utf8");
      const lines = source.split("\n");
      const unused = [];
      const ast = parse(source.replace(/\{\{[A-Z_]+\}\}/g, "KIT_PLACEHOLDER"), {
        sourceType: "module",
        plugins: ["jsx"],
      });
      traverse(ast, {
        Scope(p) {
          for (const [name, binding] of Object.entries(p.scope.bindings))
            if (!binding.referenced && ["module", "const", "let", "hoisted"].includes(binding.kind))
              unused.push({ name, line: binding.identifier.loc.start.line });
        },
      });
      files[file] = {
        bytes: Buffer.byteLength(source),
        lines: lines.length,
        maxLine: Math.max(...lines.map((l) => l.length)),
        longLines: lines.filter((l) => l.length > 180).length,
        unused: [...new Map(unused.map((x) => [x.name + ":" + x.line, x])).values()],
      };
      const normalized = lines
        .map((l) => l.trim())
        .filter((l) => l.length > 8 && !l.startsWith("import "));
      for (let i = 0; i + 8 <= normalized.length; i++) {
        const hash = createHash("sha256")
          .update(normalized.slice(i, i + 8).join("\n"))
          .digest("hex");
        if (!fragments.has(hash)) fragments.set(hash, new Set());
        fragments.get(hash).add(file);
      }
    }
  }
  for (const dir of [
    "scripts",
    "prototype/src",
    "templates/business-project/runtime/prototype/src",
    "skills",
  ])
    await visit(dir);
  const duplicateGroups = [...fragments.values()]
    .filter((x) => x.size > 1)
    .map((x) => [...x].sort());
  return {
    files,
    totals: {
      files: Object.keys(files).length,
      bytes: Object.values(files).reduce((n, x) => n + x.bytes, 0),
      longLines: Object.values(files).reduce((n, x) => n + x.longLines, 0),
      unused: Object.values(files).reduce((n, x) => n + x.unused.length, 0),
      duplicateWindows: duplicateGroups.length,
    },
    duplicateGroups,
  };
}
const beforePath = path.join(ROOT, "scripts/quality-baseline.json");
if (process.argv.includes("--capture-baseline")) {
  const source = process.argv[process.argv.indexOf("--capture-baseline") + 1];
  await fs.writeFile(
    beforePath,
    JSON.stringify({ source: "本轮改动前的活跃源码快照", ...(await measure(source)) }, null, 2) +
      "\n",
  );
} else {
  const current = await measure(ROOT);
  const baseline = JSON.parse(await fs.readFile(beforePath, "utf8"));
  const warnings = [];
  for (const [file, metric] of Object.entries(current.files)) {
    const old = baseline.files[file] || { longLines: 0, unused: [], bytes: 0 };
    if (metric.longLines > old.longLines)
      warnings.push(`${file} 长行增加 ${metric.longLines - old.longLines}`);
    if (metric.unused.length > old.unused.length)
      warnings.push(`${file} 疑似未使用声明增加 ${metric.unused.length - old.unused.length}`);
  }
  if (current.totals.duplicateWindows > baseline.totals.duplicateWindows)
    warnings.push("重复片段窗口数量增加，请人工判断是否需要共用");
  await fs.mkdir(path.join(ROOT, "dist/verification"), { recursive: true });
  await fs.writeFile(
    path.join(ROOT, "dist/verification/quality.json"),
    JSON.stringify(
      { baseline: baseline.totals, current: current.totals, warnings, files: current.files },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ baseline: baseline.totals, current: current.totals, warnings }, null, 2),
  );
}
