import { describe, expect, it } from "vitest";
import {
  FEEDBACK_BODY_MAX_LENGTH,
  FEEDBACK_COPY,
  FEEDBACK_DAILY_LIMIT,
  feedbackFieldsSchema,
} from "./feedback.ts";

describe("feedbackFieldsSchema", () => {
  it("前後空白を除き、未知キーと空本文を拒否する", () => {
    expect(feedbackFieldsSchema.parse({ category: "bug", body: "  直して  " })).toEqual({
      category: "bug",
      body: "直して",
    });
    expect(feedbackFieldsSchema.safeParse({ category: "bug", body: "   " }).success).toBe(false);
    expect(
      feedbackFieldsSchema.safeParse({
        category: "bug",
        body: "本文",
        userId: "someone",
      }).success,
    ).toBe(false);
    expect(
      feedbackFieldsSchema.safeParse({
        category: "bug",
        body: "あ".repeat(FEEDBACK_BODY_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("日次上限の数値を画面コピーに出さない", () => {
    const copy = Object.values(FEEDBACK_COPY).join("\n");
    expect(copy).not.toContain(String(FEEDBACK_DAILY_LIMIT));
    expect(copy).not.toContain("1日");
    expect(copy).toContain("返信をお約束するものではありません");
    expect(copy).toContain("分からない形");
  });
});
