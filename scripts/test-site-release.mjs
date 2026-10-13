import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectSiteRelease } from "./site-release-lib.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "kit-site-release-"));
try {
  await fs.mkdir(path.join(root, ".openai"), { recursive: true });
  await fs.mkdir(path.join(root, "prototype/src"), { recursive: true });
  await fs.mkdir(path.join(root, "prototype/dist"), { recursive: true });
  await fs.writeFile(path.join(root, "prototype/src/main.js"), "export default true;\n");
  await new Promise((resolve) => setTimeout(resolve, 20));
  await fs.writeFile(path.join(root, "prototype/dist/index.html"), "<!doctype html><title>Demo</title>\n");
  await fs.writeFile(
    path.join(root, ".openai/hosting.json"),
    `${JSON.stringify({ project_id: "project-example", static: { directory: "prototype/dist" } }, null, 2)}\n`,
  );
  const valid = await inspectSiteRelease(root);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.report.indexPresent, true);
  assert.equal(valid.report.requiredExternalChecks.length, 4);

  await new Promise((resolve) => setTimeout(resolve, 20));
  await fs.writeFile(path.join(root, "prototype/src/main.js"), "export default false;\n");
  const stale = await inspectSiteRelease(root);
  assert.match(stale.errors.join("\n"), /构建产物早于 prototype\/src/);

  await fs.writeFile(
    path.join(root, ".openai/hosting.json"),
    `${JSON.stringify({ project_id: "project-example", static: { directory: "../outside" } }, null, 2)}\n`,
  );
  const unsafe = await inspectSiteRelease(root);
  assert.match(unsafe.errors.join("\n"), /项目内的相对目录/);

  await fs.writeFile(
    path.join(root, ".openai/hosting.json"),
    `${JSON.stringify({ project_id: "project-example", static: { directory: "prototype/dist" } }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(root, "prototype/dist/.env.production"), "DUMMY=value\n");
  const sensitive = await inspectSiteRelease(root);
  assert.match(sensitive.errors.join("\n"), /发布目录包含不应发布的文件/);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("站点发布门禁测试通过：覆盖构建目录、产物新鲜度、安全范围和发布后核对项");
