import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { activateOptionalMaterial } from "./optional-material-lib.mjs";
import { createBusinessProject } from "./project-generator-lib.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "kit-optional-material-"));
try {
  const project = path.join(root, "project");
  await createBusinessProject({
    name: "按需材料启用测试",
    output: project,
    mode: "continuous-iteration",
    recommendationReason: "验证按需治理材料的确定性启用路径",
    confirmedBy: "自动化测试",
    confirmedAt: "2026-10-13T00:00:00.000Z",
  });

  const preview = await activateOptionalMaterial(project, "domain-evidence");
  assert.equal(preview.applied, false);
  await assert.rejects(fs.access(path.join(project, preview.target)));

  const applied = await activateOptionalMaterial(project, "domain-evidence", { apply: true });
  assert.equal(applied.applied, true);
  const config = JSON.parse(await fs.readFile(path.join(project, "project.config.json"), "utf8"));
  assert.equal(config.paths.domainEvidence, "docs/domain/domain-evidence.json");
  const manifest = JSON.parse(
    await fs.readFile(path.join(project, ".prototype-kit/manifest.json"), "utf8"),
  );
  assert(manifest.files.some((item) => item.path === "docs/domain/domain-evidence.json"));
  await assert.rejects(
    activateOptionalMaterial(project, "domain-evidence", { apply: true }),
    /停止以避免覆盖/,
  );

  await activateOptionalMaterial(project, "delivery-governance");
  await activateOptionalMaterial(project, "delivery-governance", { apply: true });
  assert.equal(
    JSON.parse(await fs.readFile(path.join(project, "project.config.json"), "utf8")).paths
      .deliveryGovernance,
    "docs/review/delivery-governance.json",
  );
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("按需材料启用测试通过：预览、应用、配置登记和防覆盖均有效");
