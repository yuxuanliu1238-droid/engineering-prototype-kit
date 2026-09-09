import { contextCommand } from "./task-context.mjs";
import { ROOT } from "./project-lib.mjs";
await contextCommand(ROOT, process.argv.slice(2));
