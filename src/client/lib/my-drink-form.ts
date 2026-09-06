import { DRINK_TYPE_PRESETS } from "@/shared/alcohol.ts";
import type { DrinkType } from "@/shared/constants.ts";
import { abvPercentSchema, volumeMlSchema } from "@/shared/drink-logs.ts";

export const MY_DRINK_NAME_MAX_LENGTH = 40;
export const MY_DRINK_NAME_MESSAGE = "1文字以上40文字以内で入力してください";

export type MyDrinkFormState = {
  name: string;
  drinkType: DrinkType;
  volumeMl: number | null;
  abvPercent: number | null;
};

export type MyDrinkFormErrors = Partial<
  Record<"name" | "volumeMl" | "abvPercent" | "form", string>
>;

export const INITIAL_MY_DRINK_FORM: MyDrinkFormState = {
  name: "",
  drinkType: "wine",
  volumeMl: DRINK_TYPE_PRESETS.wine.volumeMl,
  abvPercent: DRINK_TYPE_PRESETS.wine.abvPercent,
};

export function applyMyDrinkType(state: MyDrinkFormState, drinkType: DrinkType): MyDrinkFormState {
  const preset = DRINK_TYPE_PRESETS[drinkType];
  return {
    ...state,
    drinkType,
    volumeMl: preset.volumeMl,
    abvPercent: preset.abvPercent,
  };
}

export function validateMyDrinkForm(state: MyDrinkFormState): MyDrinkFormErrors {
  const errors: MyDrinkFormErrors = {};
  const name = state.name.trim();
  if (name.length < 1 || name.length > MY_DRINK_NAME_MAX_LENGTH) {
    errors.name = MY_DRINK_NAME_MESSAGE;
  }
  if (state.volumeMl === null || !volumeMlSchema.safeParse(state.volumeMl).success) {
    errors.volumeMl = "1以上5000以下で入力してください";
  }
  if (state.abvPercent === null) {
    errors.abvPercent = "0以上100以下で入力してください";
  } else {
    const parsed = abvPercentSchema.safeParse(state.abvPercent);
    if (!parsed.success) {
      errors.abvPercent = parsed.error.issues[0]?.message ?? "0以上100以下で入力してください";
    }
  }
  return errors;
}

export function toMyDrinkBody(state: MyDrinkFormState) {
  const errors = validateMyDrinkForm(state);
  if (Object.keys(errors).length > 0 || state.volumeMl === null || state.abvPercent === null) {
    return null;
  }
  return {
    name: state.name.trim(),
    drinkType: state.drinkType,
    volumeMl: state.volumeMl,
    abvPercent: state.abvPercent,
  };
}
