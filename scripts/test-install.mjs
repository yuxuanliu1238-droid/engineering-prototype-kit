import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createBusinessProject } from "./project-generator-lib.mjs";
import { ROOT } from "./project-lib.mjs";
const project = await fs.mkdtemp(path.join(os.tmpdir(), "kit-isolated-install-"));
await createBusinessProject({
  name: "Isolated review",
  output: project,
  mode: "rapid-validation",
  recommendationReason: "合成隔离安装验证",
  confirmedBy: "fixture",
  validationFocuses: ["prototype-presentation"],
  primaryValidationFocus: "prototype-presentation",
  validationRecommendationReason: "验证模板交互",
  inputSufficiency: "sufficient",
  inputSufficiencyReason: "合成场景",
  reviewCenterEnabled: true,
  reviewCenterReason: "测试评审往返",
});
const run = (args) =>
  execFileSync("pnpm", args, { cwd: project, encoding: "utf8", timeout: 120000 });
try {
  console.log(
    run([
      "install",
      process.env.KIT_INSTALL_ONLINE === "1" ? "--prefer-offline" : "--offline",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]),
  );
  const actual = await fs.realpath(path.join(project, "node_modules/fflate"));
  assert.ok(actual.startsWith(await fs.realpath(project)), "依赖不得指向宿主 Kit");
  console.log(run(["build"]));
  await fs.mkdir(path.join(ROOT, "dist/verification"), { recursive: true });
  await fs.writeFile(
    path.join(ROOT, "dist/verification/install.json"),
    JSON.stringify({ result: "passed", project, hostDependencyLink: false }),
  );
  console.log(`独立安装与构建通过：${project}`);
} catch (e) {
  console.error(e.stderr || e.stdout || e.message);
  process.exitCode = 1;
}
