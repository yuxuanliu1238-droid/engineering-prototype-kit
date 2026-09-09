import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createBusinessProject } from "./project-generator-lib.mjs";
import { ROOT } from "./project-lib.mjs";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "kit-paths-"));
const run = (script, args = [], cwd = root) =>
  execFileSync(process.execPath, [script, ...args], { cwd, stdio: "pipe" });
try {
  await createBusinessProject({
    name: "Paths",
    output: root,
    mode: "continuous-iteration",
    recommendationReason: "synthetic paths",
    confirmedBy: "fixture",
  });
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, ".prototype-kit/manifest.json"), "utf8"),
  );
  const config = JSON.parse(await fs.readFile(path.join(root, "project.config.json"), "utf8"));
  for (const [key, destination] of [
    ["requirements", "docs/custom/registry.json"],
    ["requirementsSummary", "docs/custom/requirements.md"],
  ]) {
    await fs.mkdir(path.dirname(path.join(root, destination)), { recursive: true });
    await fs.rename(path.join(root, config.paths[key]), path.join(root, destination));
    for (const entry of manifest.files)
      if (entry.path === config.paths[key]) entry.path = destination;
    config.paths[key] = destination;
  }
  config.paths.developmentHandoff = "docs/custom/handoff.json";
  config.paths.developmentTaskList = "docs/custom/tasks.md";
  await fs.writeFile(path.join(root, "project.config.json"), JSON.stringify(config));
  // The fixture represents an already registered custom configuration, not a bypass for real edits.
  manifest.files.find((e) => e.path === "project.config.json").sha256 = createHash("sha256")
    .update(JSON.stringify(config))
    .digest("hex");
  await fs.writeFile(path.join(root, ".prototype-kit/manifest.json"), JSON.stringify(manifest));
  run(path.join(ROOT, "scripts/configure-development-handoff.mjs"), [
    "--project",
    root,
    "--reason",
    "custom path test",
    "--confirmed-by",
    "fixture",
    "--apply",
  ]);
  await fs.access(path.join(root, "docs/custom/handoff.json"));
  run(".prototype-kit/business-cli.mjs", ["generate"]);
  run(".prototype-kit/business-cli.mjs", ["check"]);
  const summary = await fs.readFile(path.join(root, "docs/custom/requirements.md"), "utf8");
  assert.ok(summary.length > 0);
  console.log("自定义台账、摘要、交接来源及生成视图路径：启用、生成和校验通过。");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
