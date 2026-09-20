import { describe, expect, it } from "vitest";
import {
  isInviteToken,
  resolvePublicDisplayName,
  SOCIAL_FALLBACK_DISPLAY_NAME,
  socialBecameFriendsMessage,
  socialMoreBottlesLabel,
} from "./social.ts";

describe("resolvePublicDisplayName", () => {
  it("アカウント表示名を trim して返す", () => {
    expect(resolvePublicDisplayName("  アリス  ")).toBe("アリス");
  });

  it("空・空白はユーザーとし、アカウントへは書き込まない", () => {
    expect(resolvePublicDisplayName("")).toBe(SOCIAL_FALLBACK_DISPLAY_NAME);
    expect(resolvePublicDisplayName("   ")).toBe(SOCIAL_FALLBACK_DISPLAY_NAME);
    expect(resolvePublicDisplayName(null)).toBe(SOCIAL_FALLBACK_DISPLAY_NAME);
    expect(resolvePublicDisplayName(undefined)).toBe(SOCIAL_FALLBACK_DISPLAY_NAME);
  });

  it("40文字の表示名を切らない", () => {
    const name = "あ".repeat(40);
    expect(resolvePublicDisplayName(name)).toBe(name);
  });
});

describe("招待トークンと文言", () => {
  it("形式を検証する", () => {
    expect(isInviteToken("a".repeat(32))).toBe(true);
    expect(isInviteToken("a".repeat(31))).toBe(false);
    expect(isInviteToken("abc def")).toBe(false);
  });

  it("完了メッセージと複数本ラベルを組み立てる", () => {
    expect(socialBecameFriendsMessage("テスト")).toBe("テストさんと友達になりました");
    expect(socialMoreBottlesLabel(2)).toBe("＋2本");
  });
});
