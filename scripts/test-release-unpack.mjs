import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { unzipSync } from "fflate";
import { ROOT } from "./project-lib.mjs";
import { safePath } from "./safe-path.mjs";
import { validateArchiveEntries } from "./archive-policy.mjs";
const pkg = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
const prefix = `${pkg.name}-v${pkg.version}`;
const entries = unzipSync(await fs.readFile(path.join(ROOT, `dist/releases/${prefix}.zip`)));
validateArchiveEntries(Object.keys(entries), prefix, "kit");
const root = await fs.mkdtemp(path.join(os.tmpdir(), "kit-unpack-"));
try {
  for (const [file, content] of Object.entries(entries)) {
    const dest = safePath(root, file);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content);
  }
  const kit = path.join(root, prefix);
  const project = path.join(root, "business");
  const generator = await import(
    new URL("file://" + path.join(kit, "scripts/project-generator-lib.mjs"))
  );
  await generator.createBusinessProject({
    name: "Unpacked",
    output: project,
    mode: "continuous-iteration",
    recommendationReason: "synthetic archive",
    confirmedBy: "fixture",
  });
  const result = execFileSync(process.execPath, [".prototype-kit/business-cli.mjs", "check"], {
    cwd: project,
    encoding: "utf8",
  });
  assert.ok(result.includes("通过"));
  console.log("解包验证通过：归档独立加载生成器，新实例检查通过。");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
