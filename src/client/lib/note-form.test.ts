import { describe, expect, it } from "vitest";
import { TASTING_NOTE_MESSAGES } from "@/shared/tasting-notes.ts";
import {
  applySelectedBottle,
  canSubmitNoteForm,
  clearSelectedBottle,
  initialNoteFormState,
  isNoteFormDirty,
  toCreateTastingNoteBody,
  toUpdateTastingNoteBody,
  validateNoteForm,
} from "./note-form.ts";

const NOW = new Date("2026-09-07T03:00:00.000Z");

describe("validateNoteForm / canSubmitNoteForm", () => {
  it("評価未選択と銘柄空では保存できない", () => {
    const state = initialNoteFormState(NOW);
    const errors = validateNoteForm(state, NOW);
    expect(errors.ratingX10).toBe(TASTING_NOTE_MESSAGES.rating);
    expect(errors.drinkName).toBe(TASTING_NOTE_MESSAGES.drinkName);
    expect(errors.drinkType).toBe(TASTING_NOTE_MESSAGES.drinkType);
    expect(canSubmitNoteForm(state, errors, "none")).toBe(false);
  });

  it("評価と銘柄があれば写真なしでも保存できる", () => {
    const state = {
      ...initialNoteFormState(NOW),
      drinkName: "サンプル赤",
      drinkType: "wine" as const,
      ratingX10: 45,
    };
    const errors = validateNoteForm(state, NOW);
    expect(errors).toEqual({});
    expect(canSubmitNoteForm(state, errors, "none")).toBe(true);
    expect(canSubmitNoteForm(state, errors, "uploading")).toBe(false);
  });

  it("未来の飲んだ日は不可", () => {
    const state = {
      ...initialNoteFormState(NOW),
      drinkName: "赤",
      drinkType: "wine" as const,
      ratingX10: 40,
      tastedOn: "2026-09-08",
    };
    expect(validateNoteForm(state, NOW).tastedOn).toBe(TASTING_NOTE_MESSAGES.tastedOnFuture);
  });
});

describe("toCreateTastingNoteBody / toUpdateTastingNoteBody", () => {
  it("ボトルありでは銘柄を送らず、一言は taste に入る", () => {
    const state = applySelectedBottle(initialNoteFormState(NOW), {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "棚の赤",
      drinkType: "wine",
      status: "sealed",
    });
    state.ratingX10 = 40;
    state.taste = "  酸がきれい  ";
    const body = toCreateTastingNoteBody(state, [
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ]);
    expect(body).toMatchObject({
      bottleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ratingX10: 40,
      taste: "酸がきれい",
      photoIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
    });
    expect(body && "drinkName" in body).toBe(false);
  });

  it("PATCH は変えた欄とボトル解除だけ送る", () => {
    const initial = {
      ...initialNoteFormState(NOW),
      bottleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      bottleName: "棚の赤",
      bottleStatus: "sealed" as const,
      drinkName: "棚の赤",
      drinkType: "wine" as const,
      ratingX10: 40,
    };
    const cleared = clearSelectedBottle(initial);
    const body = toUpdateTastingNoteBody(cleared, initial);
    expect(body).toEqual({
      bottleId: null,
      drinkName: "棚の赤",
      drinkType: "wine",
    });
  });

  it("既存写真を外すと photoIds 空配列だけ送る", () => {
    const initial = {
      ...initialNoteFormState(NOW),
      drinkName: "サンプル赤",
      drinkType: "wine" as const,
      ratingX10: 40,
    };
    expect(toUpdateTastingNoteBody(initial, initial, [])).toEqual({
      photoIds: [],
    });
    expect(
      toUpdateTastingNoteBody(initial, initial, [
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ]),
    ).toEqual({
      photoIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    });
  });

  it("初期状態から評価を入れると dirty", () => {
    const initial = initialNoteFormState(NOW);
    expect(isNoteFormDirty(initial, initial)).toBe(false);
    expect(isNoteFormDirty({ ...initial, ratingX10: 40 }, initial)).toBe(true);
  });
});
