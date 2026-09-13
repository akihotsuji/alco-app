import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureLocalDevVars } from "./local-dev-vars.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const result = ensureLocalDevVars(repoRoot);
if (result.created) {
  console.log("wrote .dev.vars (BETTER_AUTH_SECRET). do not commit or print the value.");
} else {
  console.log(".dev.vars already has BETTER_AUTH_SECRET.");
}
