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
      label: "開栓（2026年9月5日）",
      consumed: true,
    });
    expect(source).toContain("bottlePropLayout");
    expect(source).toContain("formatBottleDisplayDate");
    expect(source).not.toContain('"NV"');
  });

  it("棚は開栓する、貯蔵庫は記録とテイスティングノートの入口と開栓の取り消し", () => {
    expect(source).toContain("開栓する");
    expect(source).toContain("飲んだ量を記録");
    expect(source).toContain("テイスティングノートを書く");
    expect(source).toContain("開栓の記録を取り消す");
    expect(source).toContain("更新中…");
    expect(source).not.toContain("セラーに戻す");
    expect(source).not.toContain("開栓中");
    expect(source).toContain("OpenedFollowupSheet");
    expect(source).not.toContain(">ノートを書く<");
    expect(source).not.toContain('navigate("/cellar"');
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("ノート節 T6 を出し、記録節の前に置く", () => {
    expect(source).toContain("BottleNotesSection");
    expect(source.indexOf("BottleNotesSection")).toBeLessThan(source.indexOf("記録"));
    expect(source).toContain("notesTotalCount");
  });

  it("プロパティの年はヴィンテージ、産地は生産国と書く", () => {
    expect(source).toContain("BOTTLE_FIELD_LABELS.name");
    expect(source).toContain("BOTTLE_FIELD_LABELS.vintage");
    expect(source).toContain("BOTTLE_FIELD_LABELS.variety");
    expect(source).toContain("BOTTLE_FIELD_LABELS.origin");
    expect(source).not.toContain('label: "年"');
    expect(source).not.toContain('label: "銘柄名"');
    expect(source).not.toContain('label: "産地"');
    expect(source).toContain("BOTTLE_FIELD_LABELS.storedOn");
    expect(source).toContain("BOTTLE_FIELD_LABELS.storage");
  });

  it("写真拡大は共通 PhotoViewer で、切り抜きは市松のまま", () => {
    expect(source).toContain("PhotoViewer");
    expect(source).toContain("checkerboard");
    expect(source).not.toContain("bottle-lightbox");
  });
});
