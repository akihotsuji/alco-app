import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bottleStatusPill } from "@/client/lib/bottle-form.ts";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "BottleDetail.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("BottleDetail 状態バッジ", () => {
  it("棚は未開栓、貯蔵庫は開栓日付きの consumed クラス", () => {
    expect(source).toContain("bottleStatusPill(bottle)");
    expect(source).toContain("bottle-status is-consumed");
    expect(source).toContain("{statusPill.label}");
    expect(bottleStatusPill({ status: "sealed", openedOn: null, finishedOn: null }).label).toBe(
      "未開栓",
    );
    expect(
      bottleStatusPill({ status: "opened", openedOn: "2026-09-05", finishedOn: null }).label,
    ).toBe("味わい中（2026年9月5日に開栓）");
    expect(source).toContain("bottlePropLayout");
    expect(source).toContain("displayBottleDate");
    expect(source).toContain("displayBottlePrice");
    expect(source).toContain("displayBottleText");
    expect(source).toContain("displayBottleMemo");
    expect(source).not.toContain("UNKNOWN_PROP_VALUE");
    expect(source).not.toContain('"NV"');
  });

  it("未開栓は開栓する、味わい中は記録と飲み切り、貯蔵庫は記録と味わい中に戻す", () => {
    expect(source).toContain("開栓する");
    expect(source).toContain("飲んだ量を記録");
    expect(source).toContain("飲み切った");
    expect(source).toContain("味わい中に戻す");
    expect(source).not.toContain("テイスティングノートを書く");
    // 旧「開栓の記録を取り消す」（貯蔵庫 → 棚）はやめ、記録が 0 件の味わい中だけ「開栓を取り消す」
    expect(source).not.toContain("開栓の記録を取り消す");
    expect(source).toContain("開栓を取り消す");
    expect(source).toContain("const canUndoOpen = opened && logs.length === 0;");
    expect(source).toContain("TOAST_MESSAGES.finished");
    expect(source).toContain("onReopen(result)");
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
    expect(source).toContain("bottle-detail-name");
    expect(source).toContain("<DrinkSearchLink");
    expect(source.indexOf("bottle-detail-name")).toBeLessThan(source.indexOf("<DrinkSearchLink"));
    expect(source.indexOf("<DrinkSearchLink")).toBeLessThan(source.indexOf("bottle-detail-photos"));
    expect(source.indexOf("bottle-detail-name")).toBeLessThan(
      source.indexOf("bottle-detail-photos"),
    );
    expect(source).toContain("bottle-cellar-meta");
    expect(source).toContain("ボトル情報");
    expect(source).toContain("購入・保管");
    expect(source).not.toContain("基本情報");
    expect(source).toContain("bottle-props-group");
    expect(source).toContain("bottle-memo-body");
    expect(source).toContain("参加者に共有");
    expect(source).toContain("is-empty");
    expect(source).toContain("<dl");
    expect(source).toContain("<dt>");
    expect(source).toContain("bottle-detail-actions");
    expect(source).toContain("has-back");
    expect(source).not.toContain("UNKNOWN_PROP_VALUE");
    expect(source).toContain("vintageLabel");
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

  it("表面写真の下にガラス棚板や傍線を置かない", () => {
    expect(source).not.toContain("bottle-hero-shelf");
    expect(source).not.toContain("shelf-board");
    expect(css).not.toContain(".bottle-hero-shelf");
  });

  it("項目行はラベル列を揃えた2列グリッドで、値は左揃え", () => {
    expect(css).toContain(".bottle-prop {");
    expect(css).toContain("grid-template-columns: 6.5rem minmax(0, 1fr)");
    expect(css).toContain(".bottle-prop dd.is-empty");
    expect(css).toContain(".bottle-memo-body");
    expect(css).toContain("@media (max-width: 320px)");
  });
});
