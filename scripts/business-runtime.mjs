import { ROOT } from "./project-lib.mjs";
import {
  writeRequirements,
  writePageGuides,
  writeDevelopmentHandoff,
  writeDevelopmentTaskPrompt,
} from "./runtime/generate.mjs";
import { validateProject } from "./runtime/validate.mjs";
import { validateDomainEvidenceProject } from "./domain-evidence-lib.mjs";
import { validateDeliveryGovernanceProject } from "./delivery-governance-lib.mjs";
import { checkSiteReleaseProject } from "./site-release-lib.mjs";
import { packageReview } from "./runtime/package.mjs";
const command = process.argv[2] || "check";
try {
  if (command === "check-scope") {
    const { scopeCommand } = await import("./check-runner.mjs");
    await scopeCommand(ROOT, process.argv.slice(3));
  } else if (command === "task-context") {
    const { contextCommand } = await import("./task-context.mjs");
    await contextCommand(ROOT, process.argv.slice(3));
  } else if (command === "check") {
    await validateProject();
    await validateDomainEvidenceProject(ROOT);
    await validateDeliveryGovernanceProject(ROOT);
  }
  else if (command === "validate-domain-evidence") await validateDomainEvidenceProject(ROOT);
  else if (command === "validate-delivery-governance")
    await validateDeliveryGovernanceProject(ROOT, { requireResolved: true });
  else if (command === "site-release-check") await checkSiteReleaseProject(ROOT);
  else if (command === "generate") await writeRequirements();
  else if (command === "generate-page-guides") await writePageGuides();
  else if (command === "generate-development-handoff") await writeDevelopmentHandoff();
  else if (command === "generate-development-task-prompt")
    await writeDevelopmentTaskPrompt(process.argv[3]);
  else if (command === "package-review") await packageReview();
  else throw new Error(`未知命令：${command}`);
} catch (error) {
  console.error(
    JSON.stringify(
      {
        code: "COMMAND_FAILED",
        field: command,
        reason: error.message,
        nextAction: "修正阻断项后重新运行",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
