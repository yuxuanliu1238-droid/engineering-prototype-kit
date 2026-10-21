import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createBusinessProject, addContinuousStructure } from "./project-generator-lib.mjs";
import { prepareMaterial } from "./project-material.mjs";
import { selectTemplateFiles, templateManifest } from "./template-manifest.mjs";
import { restoreTransaction } from "./transaction-lib.mjs";
import { ROOT } from "./project-lib.mjs";
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "kit-materials-"));
const read = async (root, file) => JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
const exists = async (root, file) => fs.access(path.join(root, file)).then(() => true, () => false);
const run = (root, script, args = []) => execFileSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
try {
  for (const mode of ["rapid-validation", "continuous-iteration"]) {
    const root = path.join(sandbox, mode);
    await createBusinessProject({ name: "Document fixture", output: root, mode,
      recommendationReason: "synthetic", confirmedBy: "fixture",
      validationFocuses: ["business-solution"], primaryValidationFocus: "business-solution",
      validationRecommendationReason: "synthetic", inputSufficiency: "sufficient", inputSufficiencyReason: "synthetic" });
    const originalStatus = await fs.readFile(path.join(root, "project-status.json"), "utf8");
    const initialConfig = await fs.readFile(path.join(root, "project.config.json"), "utf8");
    assert.equal(await exists(root, "docs/business-requirements.md"), false);
    assert.equal(await exists(root, "docs/review/document-baseline.json"), false);
    const manifest = await read(root, ".prototype-kit/manifest.json");
    for (const entry of selectTemplateFiles({ mode })) {
      assert.equal(manifest.files.find((file) => file.path === entry.target)?.ownership, entry.ownership, entry.target);
    }
    assert.match(run(root, ".prototype-kit/business-cli.mjs", ["documents-validate"]), /skipped/);
    assert.equal((await prepareMaterial({ project: root, activation: "business-requirements" })).applied, false);
    assert.equal(await fs.readFile(path.join(root, "project.config.json"), "utf8"), initialConfig);
    assert.equal(await exists(root, "docs/business-requirements.md"), false);
    await prepareMaterial({ project: root, activation: "business-requirements", apply: true });
    assert.equal((await read(root, "project.config.json")).paths.documentBaseline, "docs/review/document-baseline.json");
    const configAfter = await fs.readFile(path.join(root, "project.config.json"), "utf8");
    await assert.rejects(prepareMaterial({ project: root, activation: "business-requirements", apply: true }), /禁止覆盖/);
    assert.equal(await fs.readFile(path.join(root, "project.config.json"), "utf8"), configAfter);
    await prepareMaterial({ project: root, activation: "interface-specification", apply: true });
    assert.match(run(root, ".prototype-kit/business-cli.mjs", ["documents-validate"]), /passed/);
    run(root, ".prototype-kit/business-cli.mjs", ["check"]);
    await fs.appendFile(path.join(root, "docs/business-requirements.md"), "\n业务自行维护\n");
    const ownContent = await fs.readFile(path.join(root, "docs/business-requirements.md"), "utf8");
    run(ROOT, path.join(ROOT, "scripts/upgrade-project.mjs"), ["--project", root, "--apply"]);
    assert.equal(await fs.readFile(path.join(root, "docs/business-requirements.md"), "utf8"), ownContent);
    assert.equal(await fs.readFile(path.join(root, "project-status.json"), "utf8"), originalStatus);
    assert.equal((await read(root, "project-status.json")).capabilities.developmentHandoff.enabled, false);
    if (mode === "rapid-validation") {
      assert.equal(await exists(root, "docs/requirements/registry.json"), false);
      assert.equal(await exists(root, "prototype/src/contracts"), false);
      const added = await addContinuousStructure(root);
      for (const entry of selectTemplateFiles({ mode: "continuous-iteration", includeAlways: false })) {
        assert.equal(added.find((file) => file.path === entry.target)?.ownership, entry.ownership);
      }
    }
    await assert.rejects(restoreTransaction(root, "material-interface-specification"), /存在后续修改/);
  }
  const failureRoot = path.join(sandbox, "failure");
  await createBusinessProject({ name: "Rollback", output: failureRoot, mode: "continuous-iteration", recommendationReason: "synthetic", confirmedBy: "fixture" });
  const before = await fs.readFile(path.join(failureRoot, "project.config.json"), "utf8");
  await assert.rejects(prepareMaterial({ project: failureRoot, activation: "business-requirements", apply: true, failAfter: 1 }), /故障/);
  assert.equal(await exists(failureRoot, "docs/business-requirements.md"), false);
  assert.equal(await exists(failureRoot, "docs/review/document-baseline.json"), false);
  assert.equal(await fs.readFile(path.join(failureRoot, "project.config.json"), "utf8"), before);
  await prepareMaterial({ project: failureRoot, activation: "interface-specification", apply: true });
  await restoreTransaction(failureRoot, "material-interface-specification");
  assert.equal(await exists(failureRoot, "docs/interface-specification.md"), false);
  assert.equal(await exists(failureRoot, "docs/review/document-baseline.json"), false);
  assert.equal(await fs.readFile(path.join(failureRoot, "project.config.json"), "utf8"), before);
  await assert.rejects(prepareMaterial({ project: failureRoot, activation: "domain-lifecycle", apply: true }), /门禁/);
  await prepareMaterial({ project: failureRoot, activation: "business-requirements" });
  await fs.appendFile(path.join(failureRoot, "project.config.json"), "\n");
  await assert.rejects(prepareMaterial({ project: failureRoot, activation: "business-requirements", apply: true }), /预览后文件已变化/);
  const interfaceTemplate = await fs.readFile(path.join(ROOT, "templates/business-project/optional/documents/interface-specification.md"), "utf8");
  assert.deepEqual([...interfaceTemplate.matchAll(/^## (\d+)\./gm)].map((match) => Number(match[1])), [1,2,3,4,5,6,7,8]);
  assert.equal(templateManifest.files.find((entry) => entry.target === "docs/page-guides/README.md").ownership, "kit-managed");
  console.log("业务材料：两模式实际分发、按需激活、重复保护、升级保留、清单归属、预览过期及事务恢复通过。");
} finally { await fs.rm(sandbox, { recursive: true, force: true }); }
