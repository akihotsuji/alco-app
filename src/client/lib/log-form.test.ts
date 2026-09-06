import { describe, expect, it } from "vitest";
import { type DrinkLog, DRINK_LOG_MESSAGES } from "@/shared/drink-logs.ts";
import { ApiClientError } from "./api.ts";
import {
  applyDrinkType,
  canSubmitLogForm,
  describeSaveFailure,
  FORM_ERROR_MESSAGES,
  formatAbv,
  formatDrunkAtLabel,
  formatGrams,
  initialDrunkAt,
  initialLogFormState,
  isLogFormDirty,
  isManualVolume,
  liveAlcoholGrams,
  logFormStateFromDrinkLog,
  SAVE_LABELS,
  saveButtonLabel,
  stepAbv,
  toCreateDrinkLogBody,
  toUpdateDrinkLogBody,
  validateLogForm,
  volumeChipValues,
} from "./log-form.ts";

// 2026-09-05 13:05 JST
const NOW = new Date("2026-09-05T04:05:00.000Z");

describe("initial state", () => {
  it("初期はワイン 125 / 12、日時いま、メモ空（すぐ保存できる）", () => {
    const state = initialLogFormState(null, NOW);
    expect(state).toEqual({
      drinkType: "wine",
      volumeMl: 125,
      abvPercent: 12,
      drunkAt: NOW.toISOString(),
      memo: "",
    });
    expect(canSubmitLogForm(state, validateLogForm(state, NOW), "none")).toBe(true);
  });

  it("?date= の過去日は 20:00 JST、今日・未来日・不正は「いま」（E5）", () => {
    expect(initialDrunkAt("2026-09-04", NOW)).toBe("2026-09-04T11:00:00.000Z");
    expect(initialDrunkAt("2026-09-05", NOW)).toBe(NOW.toISOString());
    expect(initialDrunkAt("2026-09-06", NOW)).toBe(NOW.toISOString());
    expect(initialDrunkAt("2026-02-30", NOW)).toBe(NOW.toISOString());
    expect(initialDrunkAt(undefined, NOW)).toBe(NOW.toISOString());
  });
});

describe("drink type", () => {
  it("種類変更で量・度数をその種類のデフォルトで上書きする（触った値は捨てる）", () => {
    const touched = { ...initialLogFormState(null, NOW), volumeMl: 999, abvPercent: 3.3 };
    const beer = applyDrinkType(touched, "beer");
    expect(beer.volumeMl).toBe(350);
    expect(beer.abvPercent).toBe(5);
    expect(beer.memo).toBe("");
    expect(applyDrinkType(beer, "whisky")).toMatchObject({ volumeMl: 30, abvPercent: 40 });
  });

  it("「その他」は量・度数が空になり保存できない（E18）", () => {
    const other = applyDrinkType(initialLogFormState(null, NOW), "other");
    expect(other.volumeMl).toBeNull();
    expect(other.abvPercent).toBeNull();
    expect(canSubmitLogForm(other, validateLogForm(other, NOW), "none")).toBe(false);
    expect(liveAlcoholGrams(other)).toBeNull();
  });
});

describe("volume chips", () => {
  it("種類の量チップ + ボトル量 375 / 750 / 1500", () => {
    expect(volumeChipValues("wine")).toEqual([125, 150, 375, 750, 1500]);
    expect(volumeChipValues("beer")).toEqual([200, 350, 500, 375, 750, 1500]);
    expect(volumeChipValues("other")).toEqual([375, 750, 1500]);
  });

  it("チップに無い値・空は手入力扱い", () => {
    expect(isManualVolume("wine", 125)).toBe(false);
    expect(isManualVolume("wine", 130)).toBe(true);
    expect(isManualVolume("wine", null)).toBe(true);
  });
});

describe("abv", () => {
  it("ステッパーは 0.1 刻みで 0〜100 に止まる", () => {
    expect(stepAbv(12, 1)).toBe(12.1);
    expect(stepAbv(12.1, -1)).toBe(12);
    expect(stepAbv(0, -1)).toBe(0);
    expect(stepAbv(100, 1)).toBe(100);
    expect(stepAbv(null, 1)).toBe(0.1);
    expect(stepAbv(0.1 + 0.2, 1)).toBe(0.4);
  });

  it("表示は第 1 位まで、末尾 .0 は省く", () => {
    expect(formatAbv(12)).toBe("12");
    expect(formatAbv(12.5)).toBe("12.5");
    expect(formatAbv(null)).toBe("—");
  });
});

describe("live grams", () => {
  it("保存値の丸めと一致する表示丸め", () => {
    expect(liveAlcoholGrams({ volumeMl: 125, abvPercent: 12 })).toBe(12);
    expect(liveAlcoholGrams({ volumeMl: 350, abvPercent: 5 })).toBe(14);
    expect(liveAlcoholGrams({ volumeMl: 30, abvPercent: 40 })).toBe(9.6);
    expect(liveAlcoholGrams({ volumeMl: 125, abvPercent: 12.3 })).toBe(12.3);
    expect(formatGrams(12)).toBe("12.0");
    expect(formatGrams(null)).toBe("—");
  });

  it("範囲外なら「—」", () => {
    expect(liveAlcoholGrams({ volumeMl: 0, abvPercent: 12 })).toBeNull();
    expect(liveAlcoholGrams({ volumeMl: 125, abvPercent: 101 })).toBeNull();
    expect(liveAlcoholGrams({ volumeMl: 12.5, abvPercent: 12 })).toBeNull();
  });
});

describe("drunkAt label", () => {
  it("今日は「今日 HH:MM」、他は「9月4日 20:00」（JST 固定）", () => {
    expect(formatDrunkAtLabel(NOW.toISOString(), NOW)).toBe("今日 13:05");
    expect(formatDrunkAtLabel("2026-09-04T11:00:00.000Z", NOW)).toBe("9月4日 20:00");
    expect(formatDrunkAtLabel("2026-09-04T14:59:00.000Z", NOW)).toBe("9月4日 23:59");
    expect(formatDrunkAtLabel("2026-09-04T15:00:00.000Z", NOW)).toBe("今日 00:00");
  });
});

describe("validation", () => {
  it("範囲外はフィールド直下の文言で保存不可", () => {
    const base = initialLogFormState(null, NOW);
    expect(validateLogForm({ ...base, volumeMl: 5001 }, NOW).volumeMl).toBe(
      DRINK_LOG_MESSAGES.volumeMl,
    );
    expect(validateLogForm({ ...base, abvPercent: 100.5 }, NOW).abvPercent).toBe(
      DRINK_LOG_MESSAGES.abvPercent,
    );
    expect(validateLogForm({ ...base, abvPercent: 12.34 }, NOW).abvPercent).toBe(
      DRINK_LOG_MESSAGES.abvDecimals,
    );
    expect(validateLogForm({ ...base, memo: "a".repeat(501) }, NOW).memo).toBe(
      DRINK_LOG_MESSAGES.memo,
    );
    const future = new Date(NOW.getTime() + 16 * 60_000).toISOString();
    expect(validateLogForm({ ...base, drunkAt: future }, NOW).drunkAt).toBe(
      DRINK_LOG_MESSAGES.drunkAtFuture,
    );
    const nearFuture = new Date(NOW.getTime() + 14 * 60_000).toISOString();
    expect(validateLogForm({ ...base, drunkAt: nearFuture }, NOW)).toEqual({});
    expect(
      canSubmitLogForm(
        { ...base, volumeMl: 5001 },
        validateLogForm({ ...base, volumeMl: 5001 }, NOW),
        "none",
      ),
    ).toBe(false);
  });

  it("空の量・度数はエラー文を出さずに保存だけ無効にする", () => {
    const base = { ...initialLogFormState(null, NOW), volumeMl: null };
    expect(validateLogForm(base, NOW)).toEqual({});
    expect(canSubmitLogForm(base, {}, "none")).toBe(false);
  });

  it("写真アップロード中・失敗中は保存不可（E20 / E21）、ラベルは「写真を保存中」", () => {
    const base = initialLogFormState(null, NOW);
    expect(canSubmitLogForm(base, {}, "uploading")).toBe(false);
    expect(canSubmitLogForm(base, {}, "error")).toBe(false);
    expect(canSubmitLogForm(base, {}, "ready")).toBe(true);
    expect(saveButtonLabel(false, "uploading")).toBe(SAVE_LABELS.photoUploading);
    expect(saveButtonLabel(true, "uploading")).toBe(SAVE_LABELS.saving);
    expect(saveButtonLabel(false, "ready")).toBe(SAVE_LABELS.idle);
  });
});

describe("body", () => {
  it("alcoholG / drunkOn を含めず、メモは trim、写真は photoIds に 1 枚", () => {
    const state = { ...initialLogFormState(null, NOW), memo: "  旨い " };
    const body = toCreateDrinkLogBody(state, "11111111-1111-4111-8111-111111111111");
    expect(body).toEqual({
      drinkType: "wine",
      volumeMl: 125,
      abvPercent: 12,
      drunkAt: NOW.toISOString(),
      memo: "旨い",
      photoIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(toCreateDrinkLogBody({ ...state, memo: "   " }, null)).toEqual({
      drinkType: "wine",
      volumeMl: 125,
      abvPercent: 12,
      drunkAt: NOW.toISOString(),
    });
    expect(toCreateDrinkLogBody({ ...state, volumeMl: null }, null)).toBeNull();
  });

  it("編集は変更したフィールドだけを送り、空メモは null、写真は差し替えにする", () => {
    const log = {
      id: "log",
      drunkAt: NOW.toISOString(),
      drunkOn: "2026-09-05",
      drinkType: "wine",
      drinkName: null,
      volumeMl: 125,
      abvPercent: 12,
      alcoholG: 12,
      memo: "元",
      myDrinkId: null,
      bottleId: null,
      thumbPhotoId: null,
      photos: [],
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    } satisfies DrinkLog;
    const initial = logFormStateFromDrinkLog(log);
    expect(toUpdateDrinkLogBody(initial, initial, null)).toBeNull();
    expect(
      toUpdateDrinkLogBody(
        { ...initial, drinkType: "beer", memo: "   " },
        initial,
        "11111111-1111-4111-8111-111111111111",
      ),
    ).toEqual({
      drinkType: "beer",
      memo: null,
      photoIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(toUpdateDrinkLogBody({ ...initial, volumeMl: 350 }, initial, null)).toEqual({
      volumeMl: 350,
    });
  });
});

describe("dirty", () => {
  it("初期状態のままなら未変更、何か触れば変更あり", () => {
    const initial = initialLogFormState(null, NOW);
    expect(isLogFormDirty(initial, initial)).toBe(false);
    expect(isLogFormDirty({ ...initial, memo: "   " }, initial)).toBe(false);
    expect(isLogFormDirty({ ...initial, volumeMl: 150 }, initial)).toBe(true);
    expect(isLogFormDirty(applyDrinkType(initial, "beer"), initial)).toBe(true);
    expect(isLogFormDirty({ ...initial, memo: "a" }, initial)).toBe(true);
  });
});

describe("describeSaveFailure", () => {
  it("オフラインなら X4 の文言", () => {
    expect(describeSaveFailure(new Error("x"), false).formMessage).toBe(
      FORM_ERROR_MESSAGES.offline,
    );
  });

  it("400 の fields は該当欄へ、ルートキーは汎用文", () => {
    const fielded = describeSaveFailure(
      new ApiClientError(400, "validation_error", {
        volumeMl: ["1以上5000以下で入力してください"],
      }),
      true,
    );
    expect(fielded.fieldErrors.volumeMl).toBe("1以上5000以下で入力してください");
    expect(fielded.formMessage).toBeNull();

    const root = describeSaveFailure(
      new ApiClientError(400, "validation_error", { "": ["リクエストの形式が正しくありません"] }),
      true,
    );
    expect(root.fieldErrors).toEqual({});
    expect(root.formMessage).toBe(FORM_ERROR_MESSAGES.generic);

    const nested = describeSaveFailure(
      new ApiClientError(400, "validation_error", { "photoIds.0": ["不正"] }),
      true,
    );
    expect(nested.fieldErrors.photoIds).toBe("不正");
  });

  it("404 は写真を解除して「写真をもう一度撮ってください」", () => {
    const result = describeSaveFailure(new ApiClientError(404, "not_found"), true);
    expect(result.dropPhoto).toBe(true);
    expect(result.fieldErrors.photoIds).toBe(DRINK_LOG_MESSAGES.photoNotFound);
    expect(result.formMessage).toBeNull();
  });

  it("その他は汎用文（理由は区別しない）", () => {
    expect(describeSaveFailure(new ApiClientError(500, "internal_error"), true).formMessage).toBe(
      FORM_ERROR_MESSAGES.generic,
    );
    expect(describeSaveFailure(new TypeError("failed to fetch"), true).formMessage).toBe(
      FORM_ERROR_MESSAGES.generic,
    );
  });
});
