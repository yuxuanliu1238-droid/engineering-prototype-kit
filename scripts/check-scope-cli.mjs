import { scopeCommand } from "./check-runner.mjs";
import { ROOT } from "./project-lib.mjs";
await scopeCommand(ROOT, process.argv.slice(2));
