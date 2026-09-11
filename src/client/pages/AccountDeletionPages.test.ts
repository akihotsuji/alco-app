import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "AccountDeletionPages.tsx"),
  "utf8",
);

describe("AccountDeletionPages", () => {
  it("削除画面は指定本文・チェック・最終ボタンがあり、完了断定を出さない", () => {
    expect(source).toContain("ACCOUNT_DELETION_COPY.body");
    expect(source).toContain("ACCOUNT_DELETION_COPY.note");
    expect(source).toContain("ACCOUNT_DELETION_COPY.confirm");
    expect(source).toContain("ACCOUNT_DELETION_COPY.submit");
    expect(source).toContain("ACCOUNT_DELETION_COPY.submitting");
    expect(source).toContain("ACCOUNT_DELETION_COPY.disconnect");
    expect(source).toContain("current-password");
    expect(source).toContain("ACCOUNT_DELETION_COPY.googleReauth");
    expect(source).toContain('to="/account-deleted"');
    expect(source).not.toContain("全データの削除が完了しました");
    expect(source).not.toContain("localStorage.clear");
    expect(source).not.toContain('pose="');
    expect(source).not.toContain("もう一杯");
  });

  it("受付後画面はログインへ戻れる", () => {
    expect(source).toContain("ACCOUNT_DELETION_COPY.acceptedTitle");
    expect(source).toContain("ACCOUNT_DELETION_COPY.acceptedBody");
    expect(source).toContain('to="/login"');
  });
});
