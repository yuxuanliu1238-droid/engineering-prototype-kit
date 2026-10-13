import path from "node:path";
import { parseOptions } from "./cli-lib.mjs";
import { activateOptionalMaterial } from "./optional-material-lib.mjs";
import { restoreTransaction } from "./transaction-lib.mjs";

const args = parseOptions(process.argv.slice(2), {
  values: ["project", "capability", "restore"],
  flags: ["apply"],
});
if (!args.project) throw new Error("缺少业务项目路径 --project");
if (!args.capability) throw new Error("缺少按需能力 --capability");

const projectRoot = path.resolve(args.project);
const kind = `activate-${args.capability}`;
if (args.restore === "latest") {
  const backup = await restoreTransaction(projectRoot, kind);
  console.log(`已恢复启用前状态：${backup}`);
} else {
  const result = await activateOptionalMaterial(projectRoot, args.capability, {
    apply: args.apply === true,
  });
  if (result.applied) {
    console.log(`已启用按需能力 ${args.capability}：${result.target}`);
  } else {
    console.log(`预览通过：将启用 ${args.capability} 并创建 ${result.target}`);
    console.log("确认后使用同一命令增加 --apply；预览后文件发生变化时会自动阻断。");
  }
}
