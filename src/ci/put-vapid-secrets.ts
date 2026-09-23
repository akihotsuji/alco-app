import { spawnSync } from "node:child_process";
import { generateVapidKeys } from "./local-dev-vars.ts";
import { parseVapidPutArgs, putVapidSecrets } from "./vapid-secrets.ts";

const env = parseVapidPutArgs(process.argv.slice(2));
if (!env) {
  console.error("使い方: pnpm vapid:put -- --env dev  または  pnpm vapid:put -- --env production");
  process.exit(1);
}

const ok = putVapidSecrets({
  env,
  generate: generateVapidKeys,
  put: ({ key, env: target, value }) => {
    // 値は argv に載せない（シェル履歴・プロセス一覧に残さない）。Windows の pnpm.cmd は shell 経由
    const result = spawnSync("pnpm", ["exec", "wrangler", "secret", "put", key, "--env", target], {
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    return result.status === 0;
  },
  log: (line) => console.log(line),
});
process.exit(ok ? 0 : 1);
