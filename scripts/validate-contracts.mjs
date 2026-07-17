import { validateContractsData } from "./contract-lib.mjs";
import { printResult, readJson } from "./project-lib.mjs";
import { PAGE_CONTRACTS } from "../prototype/src/contracts/index.js";

const config = await readJson("project.config.json");
const errors = validateContractsData(PAGE_CONTRACTS, config);

const actionCount = PAGE_CONTRACTS.reduce(
  (total, contract) => total + contract.actions.length,
  0,
);
const stateCount = PAGE_CONTRACTS.reduce(
  (total, contract) => total + contract.states.length,
  0,
);

printResult(
  "页面契约校验",
  errors,
  `${PAGE_CONTRACTS.length} 个页面、${actionCount} 个动作、${stateCount} 个状态`,
);
