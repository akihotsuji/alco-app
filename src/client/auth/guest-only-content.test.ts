import { describe, expect, it } from "vitest";
import { resolveGuestOnlyContent } from "./guest-only-content.ts";

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

  it("認証済みはホームへ", () => {
    expect(
      resolveGuestOnlyContent({
        kind: "authenticated",
        hasBootVariant: false,
        settledAsGuest: true,
      }),
    ).toBe("redirect");
  });
});
