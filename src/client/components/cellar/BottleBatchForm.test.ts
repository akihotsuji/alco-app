import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "BottleBatchForm.tsx"), "utf8");
const header = readFileSync(join(here, "../layout/AppHeader.tsx"), "utf8");

describe("BottleBatchForm（04-cellar bottle-batch）", () => {
  it("保存ラベルは本数合計、行ごとに品名・種類・本数・詳細・読み取り帯・×", () => {
    expect(source).toContain("BOTTLE_SAVE_LABELS.arrange(total)");
    expect(source).toContain("batchTotalCount(batch.rows)");
    expect(source).toContain("<DrinkTypeChips");
    expect(source).toContain('label="本数を増やす"');
    expect(source).toContain('label="この行を外す"');
    expect(source).toContain("RECOGNIZE_BANNER[row.recognize]");
    expect(source).toContain('label="生産者"');
    expect(source).toContain("BOTTLE_FIELD_LABELS.origin");
    expect(source).toContain("BOTTLE_FIELD_LABELS.name");
    expect(source).toContain("BOTTLE_FIELD_LABELS.vintage");
    expect(source).toContain("BOTTLE_FIELD_LABELS.variety");
    expect(source).toContain('layout="inline"');
    // 購入日・価格・場所・メモは持たない（あとで bottle-edit）
    expect(source).not.toContain("購入日");
    expect(source).not.toContain("bottle-memo");
  });

  it("「次を撮る」は連続撮影、「ライブラリから（複数枚）」は複数選択（G8 / G8b）", () => {
    expect(source).toContain("BOTTLE_BATCH_MESSAGES.captureNext(remainingBatchRows(batch.rows))");
    expect(source).toContain("disabled={!batch.canAdd || formBusy}");
    expect(source).toContain("BOTTLE_BATCH_MESSAGES.rowLimit");
    expect(source).toContain("BOTTLE_BATCH_MESSAGES.libraryProgress");
    expect(source).toContain('<Mascot pose="surprised" size={32} aria-hidden />');
    expect(source).toContain('batch.addPhoto("camera")');
    expect(source).toContain("batch.addLibraryPhotos()");
    expect(source).toContain("IMAGE_PICK_LABELS.libraryMultiple");
  });

  it("全成功で /cellar へ replace + トースト + M-32、一部失敗は行を残して上部に汎用文（G9）", () => {
    expect(source).toContain('navigate("/cellar", { replace: true })');
    expect(source).toContain("arrangedToastMessage(result.created.length)");
    expect(source).toContain('kind: "placed"');
    expect(source).toContain("BOTTLE_BATCH_MESSAGES.partialFailure(result.failedCount)");
  });

  it("戻るは確認して未紐付けの写真を消す", () => {
    expect(source).toContain("BOTTLE_BATCH_MESSAGES.discardBody");
    expect(source).toContain("await batch.discardAll()");
  });

  it("棚ヘッダー右は「まとめて追加」だけ（C3b）。追加は右下 FAB", () => {
    expect(header).toContain('case "batch":');
    expect(header).toContain('label="まとめて追加"');
    expect(header).not.toContain("app-header-wide");
    expect(header).not.toContain("cellar-add");
  });
});
