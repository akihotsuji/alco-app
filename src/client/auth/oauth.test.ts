import { describe, expect, it } from "vitest";
import {
  hasOAuthErrorQuery,
  oauthClientFailed,
  oauthErrorCallbackPath,
  stripOAuthErrorParams,
} from "./oauth.ts";

describe("oauth query", () => {
  it("error または oauth=1 を失敗と見る", () => {
    expect(hasOAuthErrorQuery(new URLSearchParams("error=access_denied"))).toBe(true);
    expect(hasOAuthErrorQuery(new URLSearchParams("oauth=1"))).toBe(true);
    expect(hasOAuthErrorQuery(new URLSearchParams("reset=1"))).toBe(false);
  });

  it("error 系だけ消して redirect は残す", () => {
    const next = stripOAuthErrorParams(
      new URLSearchParams("redirect=%2Flogs&error=access_denied&error_description=x&oauth=1"),
    );
    expect(next.get("redirect")).toBe("/logs");
    expect(next.has("error")).toBe(false);
    expect(next.has("error_description")).toBe(false);
    expect(next.has("oauth")).toBe(false);
  });

  it("失敗時の戻り先はログイン／サインアップ", () => {
    expect(oauthErrorCallbackPath("/login", null)).toBe("/login");
    expect(oauthErrorCallbackPath("/signup", "/cellar")).toBe("/signup?redirect=%2Fcellar");
  });
});

describe("oauthClientFailed", () => {
  it("error または認可 URL なしを失敗とする", () => {
    expect(oauthClientFailed({ error: { status: 400 } })).toEqual({ failed: true, status: 400 });
    expect(oauthClientFailed({ data: {} })).toEqual({ failed: true });
    expect(oauthClientFailed(null)).toEqual({ failed: true });
  });

  it("認可 URL があれば成功", () => {
    expect(
      oauthClientFailed({ data: { url: "https://accounts.google.com/o/oauth2/v2/auth" } }),
    ).toEqual({ failed: false });
  });
});
