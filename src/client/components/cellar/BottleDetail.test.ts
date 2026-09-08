import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bottleStatusPill } from "@/client/lib/bottle-form.ts";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "BottleDetail.tsx"),
  "utf8",
);

describe("BottleDetail 状態バッジ", () => {
  it("棚は未開栓、貯蔵庫は開栓日付きの consumed クラス", () => {
    expect(source).toContain("bottleStatusPill(bottle)");
    expect(source).toContain("bottle-status-pill is-consumed");
    expect(source).toContain("{statusPill.label}");
    expect(bottleStatusPill({ status: "sealed", consumedOn: null }).label).toBe("未開栓");
    expect(bottleStatusPill({ status: "consumed", consumedOn: "2026-09-05" })).toEqual({
      label: "開栓（9/5）",
      consumed: true,
    });
  });

  it("棚は開栓する、貯蔵庫は記録とテイスティングの入口とセラーに戻す", () => {
    expect(source).toContain("開栓する");
    expect(source).toContain("飲んだ量を記録");
    expect(source).toContain("テイスティングを書く");
    expect(source).toContain("セラーに戻す");
    expect(source).toContain("OpenedFollowupSheet");
    expect(source).not.toContain("ノートを書く");
    expect(source).not.toContain('navigate("/cellar"');
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("ノート節 T6 を出し、記録節の前に置く", () => {
    expect(source).toContain("BottleNotesSection");
    expect(source.indexOf("BottleNotesSection")).toBeLessThan(source.indexOf("記録"));
    expect(source).toContain("notesTotalCount");
  });

  it("プロパティの年はビンテージと書く", () => {
    expect(source).toContain("BOTTLE_FIELD_LABELS.vintage");
    expect(source).toContain("BOTTLE_FIELD_LABELS.variety");
    expect(source).not.toContain('label: "年"');
    expect(source).toContain("BOTTLE_FIELD_LABELS.storedOn");
    expect(source).toContain("BOTTLE_FIELD_LABELS.storage");
  });
});
