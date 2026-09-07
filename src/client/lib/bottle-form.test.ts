import { describe, expect, it } from "vitest";
import { BOTTLE_MESSAGES, type Bottle } from "@/shared/bottles.ts";
import { ApiClientError } from "./api.ts";
import {
  bottleFormStateFromBottle,
  bottleStatusPill,
  canSubmitBottleForm,
  describeBottleSaveFailure,
  formatPriceJpy,
  hasBottleDetails,
  INITIAL_BOTTLE_FORM,
  isBottleFormDirty,
  isUuid,
  toCreateBottleBody,
  toUpdateBottleBody,
  validateBottleForm,
  vintageLabel,
} from "./bottle-form.ts";
import { FORM_ERROR_MESSAGES } from "./log-form.ts";

const NOW = new Date("2026-09-06T03:00:00.000Z");

describe("validateBottleForm", () => {
  it("初期は名前空で保存できない。名前があれば通る", () => {
    expect(validateBottleForm(INITIAL_BOTTLE_FORM, NOW).name).toBe(BOTTLE_MESSAGES.name);
    expect(
      canSubmitBottleForm(
        INITIAL_BOTTLE_FORM,
        validateBottleForm(INITIAL_BOTTLE_FORM, NOW),
        "none",
      ),
    ).toBe(false);
    const named = { ...INITIAL_BOTTLE_FORM, name: "サンプル赤" };
    expect(validateBottleForm(named, NOW)).toEqual({});
    expect(canSubmitBottleForm(named, {}, "none")).toBe(true);
    expect(canSubmitBottleForm(named, {}, "uploading")).toBe(false);
  });

  it("年・価格・購入日の範囲", () => {
    expect(
      validateBottleForm({ ...INITIAL_BOTTLE_FORM, name: "赤", vintage: "1799" }, NOW).vintage,
    ).toBe(BOTTLE_MESSAGES.vintage);
    expect(
      validateBottleForm({ ...INITIAL_BOTTLE_FORM, name: "赤", priceJpy: "-1" }, NOW).priceJpy,
    ).toBe(BOTTLE_MESSAGES.priceJpy);
    expect(
      validateBottleForm({ ...INITIAL_BOTTLE_FORM, name: "赤", purchasedOn: "2026-09-07" }, NOW)
        .purchasedOn,
    ).toBe(BOTTLE_MESSAGES.purchasedOnFuture);
    expect(
      validateBottleForm({ ...INITIAL_BOTTLE_FORM, name: "赤", purchasedOn: "2026-02-30" }, NOW)
        .purchasedOn,
    ).toBe(BOTTLE_MESSAGES.purchasedOn);
  });
});

describe("toCreate / toUpdate", () => {
  it("作成は trim と空欄 null。写真 id を付ける", () => {
    const body = toCreateBottleBody(
      {
        ...INITIAL_BOTTLE_FORM,
        name: "  サンプル赤  ",
        count: 3,
        producer: "  生産者  ",
        vintage: "2020",
        memo: "  ",
      },
      "11111111-1111-4111-8111-111111111111",
    );
    expect(body).toEqual({
      name: "サンプル赤",
      drinkType: "wine",
      count: 3,
      producer: "生産者",
      origin: null,
      vintage: 2020,
      purchasedOn: null,
      priceJpy: null,
      shop: null,
      storage: null,
      memo: null,
      photoIds: ["11111111-1111-4111-8111-111111111111"],
    });
  });

  it("編集は変わった欄だけ。写真削除は空配列", () => {
    const initial = { ...INITIAL_BOTTLE_FORM, name: "元" };
    expect(toUpdateBottleBody(initial, initial, null, false)).toBeNull();
    expect(toUpdateBottleBody({ ...initial, name: "改名" }, initial, null, false)).toEqual({
      name: "改名",
    });
    expect(toUpdateBottleBody(initial, initial, null, true)).toEqual({ photoIds: [] });
  });
});

describe("dirty / helpers", () => {
  it("本数を含むときだけ count を見る", () => {
    const initial = INITIAL_BOTTLE_FORM;
    expect(isBottleFormDirty(initial, initial, true)).toBe(false);
    expect(isBottleFormDirty({ ...initial, count: 2 }, initial, true)).toBe(true);
    expect(isBottleFormDirty({ ...initial, count: 2 }, initial, false)).toBe(false);
    expect(isBottleFormDirty({ ...initial, name: "触った" }, initial, false)).toBe(true);
  });

  it("詳細の有無と表示", () => {
    expect(hasBottleDetails(INITIAL_BOTTLE_FORM)).toBe(false);
    expect(hasBottleDetails({ ...INITIAL_BOTTLE_FORM, vintage: "2020" })).toBe(true);
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
      vintage: 2020,
      purchasedOn: "2026-06-01",
      priceJpy: 3800,
      shop: null,
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
