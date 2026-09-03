import path from "node:path";
import { createBusinessProject } from "./project-generator-lib.mjs";

function argsFrom(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    result[value.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

function list(value) {
  return value ? value.split("|").map((item) => item.trim()).filter(Boolean) : [];
}

const args = argsFrom(process.argv.slice(2));
if (!args.output) throw new Error("缺少输出目录 --output");
const result = await createBusinessProject({
  name: args.name,
  output: path.resolve(args.output),
  mode: args.mode,
  recommendationReason: args["recommendation-reason"],
  confirmedBy: args["confirmed-by"],
  confirmedAt: args["confirmed-at"],
  validationFocuses: args["validation-focuses"],
  primaryValidationFocus: args["primary-validation-focus"],
  validationRecommendationReason: args["validation-recommendation-reason"],
  inputSufficiency: args["input-sufficiency"],
  inputSufficiencyReason: args["input-sufficiency-reason"],
  inputKnown: list(args["input-known"]),
  inputMissing: list(args["input-missing"]),
  inputCanProceed: list(args["input-can-proceed"]),
  inputRequiresConfirmation: list(args["input-requires-confirmation"]),
  inputMustNotDo: list(args["input-must-not-do"]),
  reviewCenterEnabled: args["review-center"] === "enabled",
  reviewCenterReason: args["review-center-reason"],
});

console.log(`已创建业务项目：${result.targetRoot}`);
console.log(`模式：${result.mode}；生成 ${result.fileCount} 个受清单管理的文件`);
