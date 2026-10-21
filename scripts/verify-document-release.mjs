import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { unzipSync } from "fflate";
import { ROOT } from "./project-lib.mjs";
import { safePath } from "./safe-path.mjs";
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "kit-document-release-"));
const run = (cwd, command, args) => execFileSync(command, args, { cwd, encoding: "utf8", timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
const results = [];
const json = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
async function unpack(archive, root) {
  await fs.mkdir(root, { recursive: true });
  for (const [file, content] of Object.entries(unzipSync(archive))) {
    const destination = safePath(root, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content);
  }
}
try {
  const kit = path.join(sandbox, "source");
  await fs.cp(ROOT, kit, { recursive: true, filter: (source) => !path.relative(ROOT, source).split(path.sep).some((part) => [".git", "node_modules", "dist"].includes(part)) });
  await fs.symlink(path.join(ROOT, "node_modules"), path.join(kit, "node_modules"));
  await fs.symlink(path.join(ROOT, "prototype/node_modules"), path.join(kit, "prototype/node_modules"));
  run(kit, "pnpm", ["--dir", "prototype", "build"]);
  run(kit, process.execPath, ["scripts/package-release.mjs"]);
  run(kit, process.execPath, ["scripts/validate-release.mjs"]);
  run(kit, process.execPath, ["scripts/test-release-unpack.mjs"]);
  results.push("isolated-kit-build-package-checksum-and-unpack");
  const pkg = await json(path.join(kit, "package.json"));
  const prefix = `${pkg.name}-v${pkg.version}`;
  const archive = await fs.readFile(path.join(kit, "dist/releases", `${prefix}.zip`));
  const kitEntries = Object.keys(unzipSync(archive));
  for (const file of ["scripts/project-material.mjs", "scripts/documents-validate.mjs", "scripts/template-manifest.mjs", "templates/business-project/optional/documents/business-requirements.md", "templates/business-project/optional/documents/interface-specification.md"]) {
    assert.ok(kitEntries.includes(`${prefix}/${file}`), file);
  }
  const unpacked = path.join(sandbox, "unpacked");
  await unpack(archive, unpacked);
  const source = path.join(unpacked, prefix);
  const { createBusinessProject } = await import(pathToFileURL(path.join(source, "scripts/project-generator-lib.mjs")));
  const { prepareMaterial } = await import(pathToFileURL(path.join(source, "scripts/project-material.mjs")));
  const { validateDocumentBaseline } = await import(pathToFileURL(path.join(source, "scripts/documents-validate.mjs")));
  const project = path.join(sandbox, "business");
  await createBusinessProject({ name: "Anonymous release fixture", output: project, mode: "continuous-iteration", recommendationReason: "synthetic release check", confirmedBy: "fixture" });
  await prepareMaterial({ project, activation: "business-requirements", apply: true });
  await prepareMaterial({ project, activation: "interface-specification", apply: true });
  await fs.mkdir(path.join(project, "docs/review/snapshots"), { recursive: true });
  const snapshot = "Synthetic adopted document snapshot\n";
  await fs.writeFile(path.join(project, "docs/review/snapshots/requirement.md"), snapshot);
  const baseline = { schemaVersion: 1, documents: [{ id: "SYNTHETIC-REQ", type: "requirement", locator: "docs/business-requirements.md", revisionLabel: "synthetic-1", readAt: "2026-10-16T10:00:00+08:00", sections: ["5"], confirmationEvidence: ["synthetic fixture only"], snapshotPath: "docs/review/snapshots/requirement.md", sha256: createHash("sha256").update(snapshot).digest("hex") }] };
  await fs.writeFile(path.join(project, "docs/review/document-baseline.json"), JSON.stringify(baseline));
  await fs.symlink(path.join(ROOT, "node_modules"), path.join(project, "node_modules"));
  await fs.symlink(path.join(ROOT, "prototype/node_modules"), path.join(project, "prototype/node_modules"));
  run(project, "pnpm", ["--dir", "prototype", "build"]);
  run(project, process.execPath, [".prototype-kit/business-cli.mjs", "package-review"]);
  const config = await json(path.join(project, "project.config.json"));
  const businessArchive = await fs.readFile(path.join(project, `dist/review/${config.packageName}-review.zip`));
  const businessRoot = path.join(sandbox, "business-unpacked");
  await unpack(businessArchive, businessRoot);
  const extracted = path.join(businessRoot, `${config.packageName}-review`);
  assert.equal((await validateDocumentBaseline(baseline, { root: extracted })).valid, true);
  results.push("unpacked-kit-materials-runtime-review-archive-and-snapshot-integrity");

  // Exercise the distributed CLI after archive checks, using synthetic records
  // only. This verifies evidence-card wiring, not product acceptance.
  const { runChecks } = await import(pathToFileURL(path.join(project, ".prototype-kit/check-runner.mjs")));
  const sample = await json(path.join(source, "examples/review-workflow-isolated.json"));
  const decisionPath = "prototype/src/review-decision.md";
  const decisionRef = `${decisionPath}#sample-decision`;
  sample.artifacts.find((entry) => entry.type === "decision").location = decisionRef;
  sample.evidence[0].location = decisionRef;
  await fs.copyFile(path.join(source, "examples/review-decision-isolated.md"), path.join(project, decisionPath));
  const registry = await json(path.join(project, config.paths.requirements));
  registry.items = [sample];
  await fs.writeFile(path.join(project, config.paths.requirements), JSON.stringify(registry));
  const report = await runChecks({ root: project, target: sample.id, commands: [{ command: process.execPath, args: [".prototype-kit/business-cli.mjs", "documents-validate"] }] });
  assert.equal(report.result, "passed");
  const reportRef = `dist/checks/${report.cacheKey}.json`;
  const outputRef = "dist/review-packages/synthetic-card.md";
  const statusBefore = await fs.readFile(path.join(project, "project-status.json"), "utf8");
  run(project, process.execPath, [".prototype-kit/review-package.mjs", "--cr", sample.id, "--report", reportRef, "--output", outputRef]);
  const card = await fs.readFile(path.join(project, outputRef), "utf8");
  assert.ok(card.includes(sample.evidence[0].originalClaim));
  assert.match(card, /确认记录：candidate/);
  assert.ok(card.includes(`../../${decisionRef}`));
  assert.match(card, /文件纳入当前检查覆盖/);
  await fs.appendFile(path.join(project, decisionPath), "\nSynthetic decision revision\n");
  run(project, process.execPath, [".prototype-kit/review-package.mjs", "--cr", sample.id, "--report", reportRef, "--output", outputRef]);
  const staleCard = await fs.readFile(path.join(project, outputRef), "utf8");
  assert.match(staleCard, /检查报告状态：过期/);
  assert.equal(staleCard.includes("文件纳入当前检查覆盖"), false);
  assert.equal(await fs.readFile(path.join(project, "project-status.json"), "utf8"), statusBefore);
  results.push("unpacked-runtime-evidence-card-cli-source-links-and-stale-report-without-state-change");
  console.log(JSON.stringify({ result: "passed", isolated: true, scenarios: results, publicReleaseCreated: false }, null, 2));
} finally { await fs.rm(sandbox, { recursive: true, force: true }); }
