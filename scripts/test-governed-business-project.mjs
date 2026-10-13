import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createBusinessProject } from "./project-generator-lib.mjs";

const run = promisify(execFile);

async function writeJson(filename, data) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, `${JSON.stringify(data, null, 2)}\n`);
}

const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "kit-governed-project-"));
try {
  const projectRoot = path.join(sandbox, "business-project");
  await createBusinessProject({
    name: "交付治理闭环测试",
    output: projectRoot,
    mode: "continuous-iteration",
    recommendationReason: "验证业务口径变化能够同步到规则、页面和验收场景",
    confirmedBy: "自动化测试",
    confirmedAt: "2026-10-13T00:00:00.000Z",
  });

  const domain = {
    schemaVersion: 1,
    ruleModel: {
      fields: [
        {
          id: "field-request-time",
          label: "规则判断时间",
          dataSourceRef: "source-business-request",
          valueType: "datetime",
          operators: ["equals"],
          repeatPolicy: "forbid",
          missingDataPolicy: "undecidable",
        },
      ],
      rules: [
        {
          id: "rule-request-time",
          label: "按业务请求时间判断",
          conditionLogic: "all",
          conditions: [
            {
              fieldRef: "field-request-time",
              operator: "equals",
              valueRef: "fixture:request-time",
            },
          ],
          resultRef: "result:recommended",
        },
      ],
      selection: { strategy: "most-specific-complete-match", unresolvedTie: "conflict" },
    },
    stateModel: {
      states: [
        {
          id: "state-recommendation-failed",
          objectType: "business-object",
          meaning: "本次推荐失败，可以在根因修复后重新计算",
          source: true,
        },
      ],
      actions: [
        {
          id: "action-recalculate",
          label: "重新计算",
          allowedStateRefs: ["state-recommendation-failed"],
          forbiddenStateRefs: [],
          successStateRef: "state-recommendation-failed",
        },
      ],
      exceptions: [],
    },
    integrationModel: { fields: [], derivations: [] },
  };

  const scenarios = {
    schemaVersion: 2,
    reviewCenterEnabled: false,
    reviewRoute: "/review",
    businessRoute: "/app",
    scenarios: [
      {
        id: "scenario-request-time",
        category: "规则变更",
        name: "按业务请求时间重新计算",
        validationQuestion: "时间口径变化后是否仍能形成唯一推荐结果？",
        entryPath: "/app/orders/example",
        dataRefs: ["fixture:request-time"],
        preconditions: ["订单处于推荐失败状态", "失败根因已经修复"],
        expectedResult: "重新计算后形成唯一推荐结果",
        expected: {
          matchedRuleRefs: ["rule-request-time"],
          selectedRuleRef: "rule-request-time",
          resultRef: "result:recommended",
          sourceStateRef: "state-recommendation-failed",
          exceptionRef: null,
          assertions: {
            visible: ["重新计算", "推荐结果"],
            hidden: ["恢复演示数据"],
          },
        },
        sources: ["product-confirmed"],
        assumptions: [],
        openQuestions: [],
        owner: "产品经理",
        status: "pending",
      },
    ],
  };

  const governance = {
    schemaVersion: 1,
    capabilityCatalog: [
      {
        id: "cap-recalculate",
        label: "重新计算",
        pageRef: "page-order-detail",
        purpose: "business",
        requirementTreatment: "include",
        allowedStateRefs: ["state-recommendation-failed"],
        visibilityRule: "仅在推荐失败且失败根因已修复时展示",
      },
      {
        id: "cap-reset-demo",
        label: "恢复演示数据",
        pageRef: "page-review",
        purpose: "review-only",
        requirementTreatment: "exclude",
        allowedStateRefs: [],
        visibilityRule: "只在评审入口展示，不进入正式业务页面",
      },
    ],
    changeImpacts: [
      {
        id: "impact-request-time",
        decisionRef: "decision:request-time-source",
        reason: "统一以业务请求时间作为规则有效时间",
        affected: {
          fields: ["field-request-time"],
          rules: ["rule-request-time"],
          states: ["state-recommendation-failed"],
          pages: ["page-order-detail"],
          fixtures: ["fixture:request-time"],
          documents: ["requirement:recommendation-time"],
          integrations: ["source-business-request"],
        },
        acceptanceScenarioRefs: ["scenario-request-time"],
      },
    ],
    b2bExperience: {
      navigationPattern: "host-convention",
      hostConventionEvidence: "详情页沿用宿主系统既有面包屑层级",
      checks: [
        {
          id: "ux-navigation",
          area: "navigation",
          requirement: "详情页沿用宿主系统导航层级",
          status: "passed",
          evidenceRefs: ["scenario:scenario-request-time"],
        },
        {
          id: "ux-information",
          area: "information-hierarchy",
          requirement: "推荐结果只在主结果区展示一次",
          status: "passed",
          evidenceRefs: ["scenario:scenario-request-time"],
        },
        {
          id: "ux-responsive",
          area: "responsive",
          requirement: "目标宽度下操作与结果不溢出",
          status: "passed",
          evidenceRefs: ["scenario:scenario-request-time"],
        },
        {
          id: "ux-overlay",
          area: "overlay-interaction",
          requirement: "临时弹层支持关闭与取消恢复",
          status: "passed",
          evidenceRefs: ["scenario:scenario-request-time"],
        },
      ],
    },
  };

  await writeJson(path.join(projectRoot, "docs/domain/domain-evidence.json"), domain);
  await writeJson(path.join(projectRoot, "prototype/src/review-scenarios.json"), scenarios);
  await writeJson(path.join(projectRoot, "docs/review/delivery-governance.json"), governance);

  const cli = path.join(projectRoot, ".prototype-kit/business-cli.mjs");
  await run(process.execPath, [cli, "check"], { cwd: projectRoot });
  await run(process.execPath, [cli, "validate-delivery-governance"], { cwd: projectRoot });

  await fs.mkdir(path.join(projectRoot, ".openai"), { recursive: true });
  await writeJson(path.join(projectRoot, ".openai/hosting.json"), {
    project_id: "project-governed-test",
    static: { directory: "prototype/dist" },
  });
  await fs.mkdir(path.join(projectRoot, "prototype/dist"), { recursive: true });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await fs.writeFile(
    path.join(projectRoot, "prototype/dist/index.html"),
    "<!doctype html><title>Governed project</title>\n",
  );
  await run(process.execPath, [cli, "site-release-check"], { cwd: projectRoot });

  const receipt = JSON.parse(
    await fs.readFile(path.join(projectRoot, ".sites-runtime/site-release-preflight.json"), "utf8"),
  );
  assert.equal(receipt.localChecksPassed, true);
  assert.equal(receipt.projectId, "project-governed-test");
  assert.equal(receipt.requiredExternalChecks.length, 4);
} finally {
  await fs.rm(sandbox, { recursive: true, force: true });
}

console.log("治理业务项目集成测试通过：生成、口径影响、场景闭环和站点发布前检查均可运行");
