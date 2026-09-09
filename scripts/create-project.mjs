import { parseOptions } from "./cli-lib.mjs";
import path from "node:path";
import { createBusinessProject } from "./project-generator-lib.mjs";

function argsFrom(argv) {
  return parseOptions(argv, {
    values: [
      "name",
      "output",
      "mode",
      "recommendation-reason",
      "confirmed-by",
      "confirmed-at",
      "validation-focuses",
      "primary-validation-focus",
      "validation-recommendation-reason",
      "input-sufficiency",
      "input-sufficiency-reason",
      "input-known",
      "input-missing",
      "input-can-proceed",
      "input-requires-confirmation",
      "input-must-not-do",
      "review-center",
      "review-center-reason",
      "development-handoff",
      "development-handoff-reason",
    ],
  });
}

function list(value) {
  return value
    ? value
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

const args = argsFrom(process.argv.slice(2));
if (!args.output) throw new Error("缺少输出目录 --output");
if (args["development-handoff"] && !["enabled", "disabled"].includes(args["development-handoff"])) {
  throw new Error("--development-handoff 必须为 enabled 或 disabled");
}
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
  developmentHandoffEnabled: args["development-handoff"] === "enabled",
  developmentHandoffReason: args["development-handoff-reason"],
});

console.log(`已创建业务项目：${result.targetRoot}`);
console.log(`模式：${result.mode}；生成 ${result.fileCount} 个受清单管理的文件`);
