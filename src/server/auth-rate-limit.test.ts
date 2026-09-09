import { describe, expect, it } from "vitest";
import { authRateLimitConfig } from "./auth.ts";

describe("authRateLimitConfig", () => {
  it("本番 HTTPS は sign-up の既定（10 秒 3 回）を上書きしない", () => {
    expect(authRateLimitConfig(true)).toEqual({ enabled: true });
  });

  it("HTTP（ローカル / E2E）は同一 IP の連続登録が 429 にならないよう緩める", () => {
    const config = authRateLimitConfig(false);
    expect(config.enabled).toBe(true);
    expect(config.customRules?.["/sign-up/email"]).toEqual({ window: 10, max: 100 });
    expect(config.customRules?.["/sign-in/email"]).toEqual({ window: 10, max: 100 });
  });
});
