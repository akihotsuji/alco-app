import { describe, expect, it } from "vitest";
import { guestOnlyRedirectPath, resolveGuestOnlyContent } from "./guest-only-content.ts";

describe("resolveGuestOnlyContent", () => {
  it("初期ロード中は起動画面", () => {
    expect(
      resolveGuestOnlyContent({
        kind: "loading",
        hasBootVariant: true,
        settledAsGuest: false,
      }),
    ).toBe("boot");
  });

  it("未ログインが確定したらフォームを出す", () => {
    expect(
      resolveGuestOnlyContent({
        kind: "guest",
        hasBootVariant: false,
        settledAsGuest: true,
      }),
    ).toBe("outlet");
  });

  it("フォーム表示後の refetch では起動画面に戻さない", () => {
    expect(
      resolveGuestOnlyContent({
        kind: "loading",
        hasBootVariant: true,
        settledAsGuest: true,
      }),
    ).toBe("outlet");
    expect(
      resolveGuestOnlyContent({
        kind: "slow",
        hasBootVariant: true,
        settledAsGuest: true,
      }),
    ).toBe("outlet");
  });

  it("認証済みはフォームを出さず移す", () => {
    expect(
      resolveGuestOnlyContent({
        kind: "authenticated",
        hasBootVariant: false,
        settledAsGuest: true,
      }),
    ).toBe("redirect");
  });
});

describe("guestOnlyRedirectPath", () => {
  it("安全な redirect があればそこへ、無ければホームへ", () => {
    expect(guestOnlyRedirectPath("/logs/new")).toBe("/logs/new");
    expect(guestOnlyRedirectPath("/logs/new?date=2026-09-01")).toBe("/logs/new?date=2026-09-01");
    expect(guestOnlyRedirectPath(null)).toBe("/");
  });

  it("外部 URL・認証画面自身には移さない（ループ・オープンリダイレクト対策）", () => {
    expect(guestOnlyRedirectPath("//evil.example")).toBe("/");
    expect(guestOnlyRedirectPath("https://evil.example/")).toBe("/");
    expect(guestOnlyRedirectPath("/login")).toBe("/");
    expect(guestOnlyRedirectPath("/signup?redirect=%2F")).toBe("/");
  });
});
