import type { VapidKeyPair } from "./local-dev-vars.ts";

/**
 * `pnpm vapid:put -- --env <dev|production>`（spec/secrets.md 4 章）。
 * 鍵は端末内で作り、値は標準入力でだけ `wrangler secret put` に渡す。秘密鍵は出力しない。
 */

export const VAPID_TARGET_ENVS = ["dev", "production"] as const;
export type VapidTargetEnv = (typeof VAPID_TARGET_ENVS)[number];

export function parseVapidPutArgs(argv: readonly string[]): VapidTargetEnv | null {
  const index = argv.indexOf("--env");
  const value = index >= 0 ? argv[index + 1] : undefined;
  return VAPID_TARGET_ENVS.find((env) => env === value) ?? null;
}

export type SecretPut = (input: { key: string; env: VapidTargetEnv; value: string }) => boolean;

/** 秘密鍵を先に入れる。途中で失敗したら同じコマンドで新しい 1 組を入れ直す */
export function putVapidSecrets(input: {
  env: VapidTargetEnv;
  generate: () => VapidKeyPair;
  put: SecretPut;
  log: (line: string) => void;
}): boolean {
  const keys = input.generate();
  for (const [key, value] of [
    ["VAPID_PRIVATE_KEY", keys.privateKey],
    ["VAPID_PUBLIC_KEY", keys.publicKey],
  ] as const) {
    if (!input.put({ key, env: input.env, value })) {
      input.log(
        `${key} の投入に失敗しました。同じコマンドをやり直してください（新しい鍵の組で入れ直します）。`,
      );
      return false;
    }
  }
  input.log(`VAPID_PRIVATE_KEY と VAPID_PUBLIC_KEY を env.${input.env} に投入しました。`);
  input.log(`公開鍵（秘密ではありません）: ${keys.publicKey}`);
  return true;
}
