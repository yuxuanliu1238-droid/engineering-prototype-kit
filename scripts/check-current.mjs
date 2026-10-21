import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { ROOT } from "./project-lib.mjs";
const scripts = [
  "validate-project.mjs",
  "validate-contracts.mjs",
  "validate-links.mjs",
  "validate-skills.mjs",
  "validate-templates.mjs",
  "validate-example.mjs",
  "documents-validate.mjs",
  ...readdirSync(new URL(".", import.meta.url))
    .filter(
      (f) =>
        /^test-.*\.mjs$/.test(f) &&
        !["test-browser.mjs", "test-install.mjs", "test-release-unpack.mjs"].includes(f),
    )
    .sort(),
];
const results = [];
for (const script of scripts) {
  try {
    execFileSync(process.execPath, [`scripts/${script}`], {
      cwd: ROOT,
      stdio: "pipe",
      timeout: 180000,
    });
    results.push({ script, result: "passed" });
    console.log(`通过：${script}`);
  } catch (e) {
    results.push({ script, result: "failed" });
    console.error(`失败：${script}\n${e.stderr || e.stdout || e.message}`);
  }
}
console.log(
  `当前源码检查：${results.filter((r) => r.result === "passed").length}/${results.length}；历史全文检查未执行。`,
);
if (results.some((r) => r.result === "failed")) process.exitCode = 1;
