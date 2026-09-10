import { describe, expect, it } from "vitest";
import {
  isTurnstileProtectedAuthPath,
  publicConfigSchema,
  TURNSTILE_TOKEN_HEADER,
  turnstileRequestHeaders,
} from "./turnstile.ts";

describe("isTurnstileProtectedAuthPath", () => {
  it("登録・ログイン・再設定要求・Google 開始だけ対象", () => {
    expect(isTurnstileProtectedAuthPath("/sign-up/email")).toBe(true);
    expect(isTurnstileProtectedAuthPath("/sign-in/email")).toBe(true);
    expect(isTurnstileProtectedAuthPath("/request-password-reset")).toBe(true);
    expect(isTurnstileProtectedAuthPath("/sign-in/social")).toBe(true);
    expect(isTurnstileProtectedAuthPath("/sign-out")).toBe(false);
    expect(isTurnstileProtectedAuthPath("/get-session")).toBe(false);
    expect(isTurnstileProtectedAuthPath("/reset-password")).toBe(false);
  });
});

describe("publicConfigSchema", () => {
  it("サイトキーか null だけ通し、余分なキーは拒否する", () => {
    expect(publicConfigSchema.parse({ turnstileSiteKey: "1x00000000000000000000AA" })).toEqual({
      turnstileSiteKey: "1x00000000000000000000AA",
    });
    expect(publicConfigSchema.parse({ turnstileSiteKey: null })).toEqual({
      turnstileSiteKey: null,
    });
    expect(publicConfigSchema.safeParse({ turnstileSiteKey: null, secret: "x" }).success).toBe(
      false,
    );
  });
});

describe("turnstileRequestHeaders", () => {
  it("トークンがあるときだけ公式ヘッダーを付ける", () => {
    expect(turnstileRequestHeaders(null)).toEqual({});
    expect(turnstileRequestHeaders("tok")).toEqual({ [TURNSTILE_TOKEN_HEADER]: "tok" });
  });
});
