import { describe, expect, it } from "vitest";
import { parseVapidPutArgs, putVapidSecrets } from "./vapid-secrets.ts";

const KEYS = { publicKey: "PUBLIC-KEY-VALUE", privateKey: "PRIVATE-KEY-VALUE" };

describe("vapid:put", () => {
  it("--env は dev / production だけ", () => {
    expect(parseVapidPutArgs(["--env", "dev"])).toBe("dev");
    expect(parseVapidPutArgs(["--", "--env", "production"])).toBe("production");
    expect(parseVapidPutArgs(["--env", "prod; rm -rf /"])).toBeNull();
    expect(parseVapidPutArgs([])).toBeNull();
  });

  it("秘密鍵 → 公開鍵の順に標準入力で渡し、出力に秘密鍵を出さない", () => {
    const puts: { key: string; env: string; value: string }[] = [];
    const lines: string[] = [];
    const ok = putVapidSecrets({
      env: "production",
      generate: () => KEYS,
      put: (input) => {
        puts.push(input);
        return true;
      },
      log: (line) => lines.push(line),
    });
    expect(ok).toBe(true);
    expect(puts).toEqual([
      { key: "VAPID_PRIVATE_KEY", env: "production", value: KEYS.privateKey },
      { key: "VAPID_PUBLIC_KEY", env: "production", value: KEYS.publicKey },
    ]);
    expect(lines.join("\n")).not.toContain(KEYS.privateKey);
    expect(lines.join("\n")).toContain(KEYS.publicKey);
  });

  it("途中で失敗したら止めて、やり直しを案内する", () => {
    const lines: string[] = [];
    const ok = putVapidSecrets({
      env: "dev",
      generate: () => KEYS,
      put: ({ key }) => key !== "VAPID_PUBLIC_KEY",
      log: (line) => lines.push(line),
    });
    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("やり直してください");
    expect(lines.join("\n")).not.toContain(KEYS.privateKey);
  });
});
