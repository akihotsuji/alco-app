import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoAttachment } from "@/client/components/layout/photo-edit-context.tsx";
import { DEFAULT_BOTTLE_STORAGE } from "@/shared/bottles.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import {
  applyBatchOutcome,
  BOTTLE_BATCH_MAX_ROWS,
  BOTTLE_BATCH_MESSAGES,
  type BottleBatchRow,
  batchIngestProgress,
  batchRowBody,
  batchRowPhotoStatus,
  batchSavableCount,
  batchTotalCount,
  batchUnlinkedPhotoIds,
  canAddBatchRow,
  canReserveBatchRow,
  canSubmitBatch,
  isBatchRowSavable,
  newBatchRow,
  newQueuedBatchRow,
  patchBatchRowForm,
  remainingBatchRows,
  removeBatchRow,
  savableBatchRows,
  setBatchBackPhoto,
  updateBatchRow,
  updateExistingBatchPhoto,
  upsertBatchPhoto,
} from "./bottle-batch.ts";

function photo(overrides: Partial<PhotoAttachment> = {}): PhotoAttachment {
  return {
    previewUrl: `blob:${crypto.randomUUID()}`,
    blob: new Blob(),
    photoId: "photo-1",
    status: "ready",
    ...overrides,
  };
}

function readyRow(key: string, name = "サンプル赤", count = 1): BottleBatchRow {
  const row = newBatchRow(key, photo({ photoId: `photo-${key}` }));
  return { ...row, form: { ...row.form, name, count } };
}

const revoke = vi.fn();

beforeEach(() => {
  revoke.mockClear();
  vi.stubGlobal("URL", { ...URL, revokeObjectURL: revoke });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("行の追加・置き換え", () => {
  it("新しい key の写真は行として末尾に積まれる（撮った順）", () => {
    const rows = upsertBatchPhoto([], "a", photo());
    const next = upsertBatchPhoto(rows, "b", photo());
    expect(next.map((row) => row.key)).toEqual(["a", "b"]);
    expect(next[0]?.form.name).toBe("");
    expect(next[0]?.form.drinkType).toBe("wine_red");
    expect(next[0]?.form.count).toBe(1);
  });

  it("同じ key の写真はその行の写真だけ置き換え、入力は保つ。旧プレビューは解放する", () => {
    const first = photo({ previewUrl: "blob:old", photoId: null, status: "uploading" });
    let rows = upsertBatchPhoto([], "a", first);
    rows = patchBatchRowForm(rows, "a", { name: "モルト" });
    const uploaded = { ...first, photoId: "p1", status: "ready" as const };
    rows = upsertBatchPhoto(rows, "a", uploaded);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.form.name).toBe("モルト");
    expect(rows[0]?.photo?.status).toBe("ready");
    expect(revoke).not.toHaveBeenCalled();

    rows = upsertBatchPhoto(rows, "a", photo({ previewUrl: "blob:new" }));
    expect(revoke).toHaveBeenCalledWith("blob:old");
  });

  it(`${BOTTLE_BATCH_MAX_ROWS} 行で止まり、超えた写真は解放して捨てる`, () => {
    let rows: BottleBatchRow[] = [];
    for (let i = 0; i < BOTTLE_BATCH_MAX_ROWS; i += 1) {
      rows = upsertBatchPhoto(rows, `k${i}`, photo());
    }
    expect(canAddBatchRow(rows)).toBe(false);
    expect(remainingBatchRows(rows)).toBe(0);
    const next = upsertBatchPhoto(rows, "extra", photo({ previewUrl: "blob:extra" }));
    expect(next).toHaveLength(BOTTLE_BATCH_MAX_ROWS);
    expect(revoke).toHaveBeenCalledWith("blob:extra");
    expect(BOTTLE_BATCH_MESSAGES.captureNext(remainingBatchRows(next.slice(0, 3)))).toBe(
      "次を撮る（あと 17 本）",
    );
    expect(canReserveBatchRow(BOTTLE_BATCH_MAX_ROWS - 1)).toBe(true);
    expect(canReserveBatchRow(BOTTLE_BATCH_MAX_ROWS)).toBe(false);
    expect(BOTTLE_BATCH_MESSAGES.burstProcessing(3)).toBe("3 本を裏で処理しています");
    expect(BOTTLE_BATCH_MESSAGES.libraryProgress(2, 8)).toBe("2 / 8 枚を変換しています");
    expect(BOTTLE_BATCH_MESSAGES.overflow(20, 3)).toBe(
      "20枚を受け付けました。3枚は上限のため追加できません",
    );
    expect(BOTTLE_BATCH_MESSAGES.progress({ total: 20, done: 12, failed: 2, processing: 6 })).toBe(
      "20枚中12枚完了・2枚失敗・6枚処理中",
    );
  });

  it("削除済みの行は遅延写真で復活しない", () => {
    const next = updateExistingBatchPhoto([], "gone", photo({ previewUrl: "blob:late" }));
    expect(next).toEqual([]);
    expect(revoke).toHaveBeenCalledWith("blob:late");
  });

  it("待機行は選択順の枠として上限に含める", () => {
    const queued = newQueuedBatchRow("q1", "ing-1");
    expect(queued.phase).toBe("queued");
    expect(queued.photo).toBeNull();
    expect(remainingBatchRows([queued])).toBe(BOTTLE_BATCH_MAX_ROWS - 1);
  });

  it("行を外すとプレビューを解放する", () => {
    const rows = upsertBatchPhoto([], "a", photo({ previewUrl: "blob:a" }));
    expect(removeBatchRow(rows, "a")).toEqual([]);
    expect(revoke).toHaveBeenCalledWith("blob:a");
  });
});

describe("行の編集と AI 印", () => {
  it("AI が入れた欄をユーザーが触ると印が外れる。他の印は残る", () => {
    let rows = upsertBatchPhoto([], "a", photo());
    rows = updateBatchRow(rows, "a", (row) => ({
      aiMarks: ["name", "producer"],
      form: { ...row.form, name: "AI 名", producer: "AI 生産者" },
    }));
    rows = patchBatchRowForm(rows, "a", { name: "手入力" });
    expect(rows[0]?.aiMarks).toEqual(["producer"]);
    expect(rows[0]?.form.name).toBe("手入力");
  });

  it("品種の AI 印も手入力で外れる", () => {
    let rows = upsertBatchPhoto([], "a", photo());
    rows = updateBatchRow(rows, "a", (row) => ({
      aiMarks: ["variety"],
      form: { ...row.form, variety: "ピノ" },
    }));
    rows = patchBatchRowForm(rows, "a", { variety: "手入力" });
    expect(rows[0]?.aiMarks).toEqual([]);
    expect(rows[0]?.form.variety).toBe("手入力");
  });

  it("種類を触ったことを覚え、行のエラーは編集で消える", () => {
    let rows = upsertBatchPhoto([], "a", photo());
    rows = updateBatchRow(rows, "a", { error: "失敗" });
    rows = patchBatchRowForm(rows, "a", { drinkType: "beer" });
    expect(rows[0]?.drinkTypeTouched).toBe(true);
    expect(rows[0]?.error).toBeNull();
  });
});

describe("保存可否と本数", () => {
  it("行 0 は無効", () => {
    expect(canSubmitBatch([])).toBe(false);
    expect(batchTotalCount([])).toBe(0);
  });

  it("銘柄名が空の行は保存対象外。他の完了行は保存できる", () => {
    const rows = [readyRow("a"), readyRow("b", "")];
    expect(savableBatchRows(rows).map((row) => row.key)).toEqual(["a"]);
    expect(canSubmitBatch(rows)).toBe(true);
    expect(batchSavableCount(rows)).toBe(1);
  });

  it("AI 失敗でも写真と手入力が残り、その行は保存できる", () => {
    const row = {
      ...readyRow("a"),
      recognize: "failure" as const,
      failure: {
        code: "ai_empty" as const,
        message: "ラベルから項目を取れませんでした",
        stage: "recognize" as const,
      },
    };
    expect(isBatchRowSavable(row)).toBe(true);
    expect(canSubmitBatch([row])).toBe(true);
    expect(row.form.name).toBe("サンプル赤");
    expect(row.photo?.photoId).toBe("photo-a");
  });

  it("処理中・失敗の行は保存対象外。完了行だけ保存できる", () => {
    const uploading = {
      ...readyRow("a"),
      photo: photo({ photoId: null, status: "uploading" }),
      phase: "uploading" as const,
    };
    const failed = {
      ...readyRow("b"),
      photo: photo({ photoId: null, status: "error" }),
      phase: "error" as const,
    };
    const ready = readyRow("c");
    expect(canSubmitBatch([uploading])).toBe(false);
    expect(canSubmitBatch([failed])).toBe(false);
    expect(canSubmitBatch([uploading, failed, ready])).toBe(true);
    expect(savableBatchRows([uploading, failed, ready]).map((row) => row.key)).toEqual(["c"]);
    expect(batchIngestProgress([uploading, failed, ready])).toEqual({
      total: 3,
      done: 1,
      failed: 1,
      processing: 1,
    });
  });

  it("N は全行の本数の合計", () => {
    const rows = [readyRow("a", "赤", 2), readyRow("b", "白", 3)];
    expect(canSubmitBatch(rows)).toBe(true);
    expect(batchTotalCount(rows)).toBe(5);
  });

  it("撮影日があれば未操作の保管日に入れる", () => {
    const row = newBatchRow("a", photo({ capturedAt: "2026-08-15T12:00:00.000Z" }));
    expect(row.form.storedOn).toBe("2026-08-15");
    expect(batchRowBody({ ...row, form: { ...row.form, name: "赤" } })?.storedOn).toBe(
      "2026-08-15",
    );
  });

  it("行のボディは bottle-new と同じ形（photoIds は 1 枚）", () => {
    const row = readyRow("a", "サンプル赤", 2);
    expect(batchRowBody(row)).toEqual({
      name: "サンプル赤",
      drinkType: "wine_red",
      count: 2,
      producer: null,
      origin: null,
      variety: null,
      vintage: null,
      purchasedOn: null,
      priceJpy: null,
      shop: null,
      storedOn: tokyoToday(),
      storage: DEFAULT_BOTTLE_STORAGE,
      memo: null,
      photoIds: ["photo-a"],
    });
  });

  it("未紐付けの写真 id を集める（アップロード中の行は含まない）", () => {
    const uploading = { ...readyRow("c"), photo: photo({ photoId: null, status: "uploading" }) };
    expect(batchUnlinkedPhotoIds([readyRow("a"), readyRow("b"), uploading])).toEqual([
      "photo-a",
      "photo-b",
    ]);
  });
});

describe("裏面（G2b）", () => {
  it("裏面を付けると photoIds は [表面, 裏面]。外せば表面だけ", () => {
    const withBack = setBatchBackPhoto([readyRow("a")], "a", photo({ photoId: "back-a" }));
    expect(batchRowBody(withBack[0] as BottleBatchRow)?.photoIds).toEqual(["photo-a", "back-a"]);
    expect(batchUnlinkedPhotoIds(withBack)).toEqual(["photo-a", "back-a"]);
    const removed = setBatchBackPhoto(withBack, "a", null);
    expect(batchRowBody(removed[0] as BottleBatchRow)?.photoIds).toEqual(["photo-a"]);
    expect(revoke).toHaveBeenCalled();
  });

  it("裏面の処理中・アップロード中・失敗は行の保存を止める", () => {
    const processing = { ...readyRow("a"), backProcessing: true };
    expect(batchRowPhotoStatus(processing)).toBe("uploading");
    expect(canSubmitBatch([processing])).toBe(false);
    const uploading = setBatchBackPhoto(
      [readyRow("a")],
      "a",
      photo({ photoId: null, status: "uploading" }),
    );
    expect(canSubmitBatch(uploading)).toBe(false);
    const failed = setBatchBackPhoto(
      [readyRow("a")],
      "a",
      photo({ photoId: null, status: "error" }),
    );
    expect(canSubmitBatch(failed)).toBe(false);
    const ready = setBatchBackPhoto([readyRow("a")], "a", photo({ photoId: "back-a" }));
    expect(canSubmitBatch(ready)).toBe(true);
  });

  it("行を外すと裏面のプレビューも解放し、破棄の対象に裏面の id も入る", () => {
    const rows = setBatchBackPhoto([readyRow("a")], "a", photo({ photoId: "back-a" }));
    revoke.mockClear();
    removeBatchRow(rows, "a");
    expect(revoke).toHaveBeenCalledTimes(2);
  });
});

describe("送信結果の反映", () => {
  it("成功した行は消え、失敗した行は残って汎用文が付く", () => {
    const rows = [readyRow("a"), readyRow("b"), readyRow("c")];
    const next = applyBatchOutcome(rows, {
      succeeded: ["a", "c"],
      failed: [{ key: "b", message: "保存できませんでした" }],
    });
    expect(next.map((row) => row.key)).toEqual(["b"]);
    expect(next[0]?.error).toBe("保存できませんでした");
    expect(BOTTLE_BATCH_MESSAGES.partialFailure(1)).toBe(
      "1 行を並べられませんでした。もう一度お試しください",
    );
  });

  it("失敗行の operationKey は残り、成功行は再送対象にならない", () => {
    const rows = [
      { ...readyRow("a"), saveOperationKey: "op-a" },
      { ...readyRow("b"), saveOperationKey: "op-b" },
    ];
    const next = applyBatchOutcome(rows, {
      succeeded: ["a"],
      failed: [{ key: "b", message: "保存できませんでした" }],
    });
    expect(next.map((row) => row.key)).toEqual(["b"]);
    expect(next[0]?.saveOperationKey).toBe("op-b");
  });
});
