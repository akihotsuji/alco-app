import { describe, expect, it } from "vitest";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  isMascotColor,
  mascotLightColor,
  normalizeNickname,
  socialBatchKindLabel,
} from "./social.ts";

describe("social helpers", () => {
  it("ニックネームは前後空白と制御文字を落とす", () => {
    expect(normalizeNickname("  ワイン好き\u0007  ")).toBe("ワイン好き");
  });

  it("色は #RRGGBB だけ受け、明部は混ぜる", () => {
    expect(isMascotColor("#8E2F3C")).toBe(true);
    expect(isMascotColor("red")).toBe(false);
    expect(isMascotColor("#8E2F3C80")).toBe(false);
    expect(mascotLightColor("#8E2F3C")).toMatch(/^#[0-9A-F]{6}$/);
    expect(mascotLightColor("#8E2F3C")).not.toBe("#8E2F3C");
  });

  it("フィードカーソルは往復する", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const cursor = encodeFeedCursor(1_700_000_000_000, id);
    expect(decodeFeedCursor(cursor)).toEqual({ publishedAtMs: 1_700_000_000_000, id });
    expect(decodeFeedCursor("bad")).toBeNull();
  });

  it("まとめ登録の種別ラベルは本数を入れる", () => {
    expect(socialBatchKindLabel(3)).toBe("セラーに3本追加");
  });
});
