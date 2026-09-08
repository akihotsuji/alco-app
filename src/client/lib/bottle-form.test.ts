import { describe, expect, it } from "vitest";
import { BOTTLE_MESSAGES, type Bottle, DEFAULT_BOTTLE_STORAGE } from "@/shared/bottles.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { ApiClientError } from "./api.ts";
import {
  bottleFormStateFromBottle,
  bottleStatusPill,
  canSubmitBottleForm,
  createEmptyBottleForm,
  describeBottleSaveFailure,
  formatPriceJpy,
  hasBottleDetails,
  isBottleFormDirty,
  isUuid,
  resolveCreateStoredOn,
  toCreateBottleBody,
  toUpdateBottleBody,
  validateBottleForm,
  vintageLabel,
} from "./bottle-form.ts";
import { FORM_ERROR_MESSAGES } from "./log-form.ts";

const NOW = new Date("2026-09-06T03:00:00.000Z");
const EMPTY = createEmptyBottleForm(NOW);

describe("validateBottleForm", () => {
  it("初期は名前空で保存できない。名前があれば通る", () => {
    expect(validateBottleForm(EMPTY, NOW).name).toBe(BOTTLE_MESSAGES.name);
    expect(canSubmitBottleForm(EMPTY, validateBottleForm(EMPTY, NOW), "none")).toBe(false);
    const named = { ...EMPTY, name: "サンプル赤" };
    expect(validateBottleForm(named, NOW)).toEqual({});
    expect(canSubmitBottleForm(named, {}, "none")).toBe(true);
    expect(canSubmitBottleForm(named, {}, "uploading")).toBe(false);
  });

  it("年・価格・購入日・保管日の範囲", () => {
    expect(validateBottleForm({ ...EMPTY, name: "赤", vintage: "1799" }, NOW).vintage).toBe(
      BOTTLE_MESSAGES.vintage,
    );
    expect(validateBottleForm({ ...EMPTY, name: "赤", priceJpy: "-1" }, NOW).priceJpy).toBe(
      BOTTLE_MESSAGES.priceJpy,
    );
    expect(
      validateBottleForm({ ...EMPTY, name: "赤", purchasedOn: "2026-09-07" }, NOW).purchasedOn,
    ).toBe(BOTTLE_MESSAGES.purchasedOnFuture);
    expect(
      validateBottleForm({ ...EMPTY, name: "赤", purchasedOn: "2026-02-30" }, NOW).purchasedOn,
    ).toBe(BOTTLE_MESSAGES.purchasedOn);
    expect(validateBottleForm({ ...EMPTY, name: "赤", storedOn: "2026-09-07" }, NOW).storedOn).toBe(
      BOTTLE_MESSAGES.storedOnFuture,
    );
  });
});

describe("toCreate / toUpdate", () => {
  it("作成は trim と空欄 null。写真 id を付ける。未変更の保管日は保存日", () => {
    const body = toCreateBottleBody(
      {
        ...EMPTY,
        name: "  サンプル赤  ",
        count: 3,
        producer: "  生産者  ",
        vintage: "2020",
        memo: "  ",
      },
      "11111111-1111-4111-8111-111111111111",
      { now: NOW, storedOnTouched: false },
    );
    expect(body).toEqual({
      name: "サンプル赤",
      drinkType: "wine",
      count: 3,
      producer: "生産者",
      origin: null,
      variety: null,
      vintage: 2020,
      purchasedOn: null,
      priceJpy: null,
      shop: null,
      storedOn: tokyoToday(NOW),
      storage: DEFAULT_BOTTLE_STORAGE,
      memo: null,
      photoIds: ["11111111-1111-4111-8111-111111111111"],
    });
  });

  it("保管日を変えたらその値。日付またぎでも手動値は維持", () => {
    const opened = createEmptyBottleForm(new Date("2026-09-06T03:00:00.000Z"));
    const nextDay = new Date("2026-09-07T03:00:00.000Z");
    expect(
      toCreateBottleBody({ ...opened, name: "赤" }, null, {
        now: nextDay,
        storedOnTouched: false,
      })?.storedOn,
    ).toBe(tokyoToday(nextDay));
    expect(
      toCreateBottleBody({ ...opened, name: "赤", storedOn: "2026-08-01" }, null, {
        now: nextDay,
        storedOnTouched: true,
      })?.storedOn,
    ).toBe("2026-08-01");
    expect(resolveCreateStoredOn(opened, false, nextDay)).toBe(tokyoToday(nextDay));
    expect(resolveCreateStoredOn({ ...opened, storedOn: "2026-08-01" }, true, nextDay)).toBe(
      "2026-08-01",
    );
  });

  it("編集は変わった欄だけ。写真削除は空配列。空の保管欄は埋めない", () => {
    const initial = { ...createEmptyBottleForm(NOW), name: "元", storedOn: "", storage: "" };
    expect(toUpdateBottleBody(initial, initial, null, false)).toBeNull();
    expect(toUpdateBottleBody({ ...initial, name: "改名" }, initial, null, false)).toEqual({
      name: "改名",
    });
    expect(toUpdateBottleBody(initial, initial, null, true)).toEqual({ photoIds: [] });
    expect(
      toUpdateBottleBody({ ...initial, storedOn: "2026-01-02" }, initial, null, false),
    ).toEqual({ storedOn: "2026-01-02" });
  });
});

describe("dirty / helpers", () => {
  it("本数を含むときだけ count を見る", () => {
    const initial = EMPTY;
    expect(isBottleFormDirty(initial, initial, true)).toBe(false);
    expect(isBottleFormDirty({ ...initial, count: 2 }, initial, true)).toBe(true);
    expect(isBottleFormDirty({ ...initial, count: 2 }, initial, false)).toBe(false);
    expect(isBottleFormDirty({ ...initial, name: "触った" }, initial, false)).toBe(true);
  });

  it("詳細の有無と表示", () => {
    expect(hasBottleDetails(EMPTY)).toBe(false);
    expect(hasBottleDetails({ ...EMPTY, storage: DEFAULT_BOTTLE_STORAGE })).toBe(false);
    expect(hasBottleDetails({ ...EMPTY, vintage: "2020" })).toBe(false);
    expect(hasBottleDetails({ ...EMPTY, variety: "カベルネ" })).toBe(false);
    expect(hasBottleDetails({ ...EMPTY, storage: "リビング" })).toBe(true);
    expect(vintageLabel(null)).toBe("NV");
    expect(vintageLabel(2020)).toBe("2020");
    expect(bottleStatusPill({ status: "sealed", consumedOn: null })).toEqual({
      label: "未開栓",
      consumed: false,
    });
    expect(bottleStatusPill({ status: "consumed", consumedOn: "2026-09-05" })).toEqual({
      label: "開栓（9/5）",
      consumed: true,
    });
    expect(bottleStatusPill({ status: "consumed", consumedOn: null })).toEqual({
      label: "未開栓",
      consumed: false,
    });
    expect(formatPriceJpy(3800)).toBe("¥3,800");
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("ボトルからの初期値", () => {
    const bottle = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "赤",
      drinkType: "wine",
      producer: "生産者",
      origin: null,
      variety: null,
      vintage: 2020,
      purchasedOn: "2026-06-01",
      priceJpy: 3800,
      shop: null,
      storedOn: "2026-05-01",
      storage: null,
      memo: null,
      status: "sealed",
      consumedAt: null,
      consumedOn: null,
      thumbPhotoId: null,
      thumbPhotoKind: null,
      photos: [],
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    } satisfies Bottle;
    expect(bottleFormStateFromBottle(bottle)).toMatchObject({
      name: "赤",
      vintage: "2020",
      priceJpy: "3800",
      origin: "",
      storedOn: "2026-05-01",
      storage: "",
    });
    expect(bottleFormStateFromBottle({ ...bottle, storedOn: null, storage: null })).toMatchObject({
      storedOn: "",
      storage: "",
    });
  });
});

describe("describeBottleSaveFailure", () => {
  it("404 は写真を解除する", () => {
    const result = describeBottleSaveFailure(new ApiClientError(404, "not_found"), true);
    expect(result.dropPhoto).toBe(true);
    expect(result.fieldErrors.photoIds).toBe(BOTTLE_MESSAGES.photoNotFound);
  });

  it("オフラインと汎用", () => {
    expect(describeBottleSaveFailure(new Error("x"), false).formMessage).toBe(
      FORM_ERROR_MESSAGES.offline,
    );
    expect(
      describeBottleSaveFailure(new ApiClientError(500, "internal_error"), true).formMessage,
    ).toBe(FORM_ERROR_MESSAGES.generic);
  });
});
