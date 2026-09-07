import { DRINK_TYPE_PRESETS } from "@/shared/alcohol.ts";
import { AI_RECOGNIZE_MIN_CONFIDENCE } from "@/shared/constants.ts";
import type { DrinkRecognizeFields } from "@/shared/drink-recognize.ts";
import type { LogFormState } from "./log-form.ts";

export const DRINK_RECOGNIZE_BANNER = {
  loading: "写真から種類と量を推測しています…",
  success: "写真から入れました",
} as const;

export type DrinkRecognizeTouched = {
  drinkType: boolean;
  volumeMl: boolean;
  abvPercent: boolean;
};

export type ApplyDrinkRecognizeInput = {
  state: LogFormState;
  fields: DrinkRecognizeFields;
  touched: DrinkRecognizeTouched;
};

export type ApplyDrinkRecognizeResult = {
  next: LogFormState;
  applied: Array<"drinkType" | "volumeMl" | "abvPercent">;
};

function usable<T>(
  field: { value: T; confidence: number } | undefined,
): field is { value: T; confidence: number } {
  return field !== undefined && field.confidence >= AI_RECOGNIZE_MIN_CONFIDENCE;
}

/**
 * ユーザーが先に触った欄は上書きしない。
 * 種類を推測したら量は推測値を優先し、無ければ種類のデフォルトを入れる（applyDrinkType で潰さない）。
 */
export function applyRecognizeToLogForm(
  input: ApplyDrinkRecognizeInput,
): ApplyDrinkRecognizeResult {
  const next = { ...input.state };
  const applied: ApplyDrinkRecognizeResult["applied"] = [];
  const lockType = input.touched.drinkType || Boolean(input.state.bottleId);

  if (usable(input.fields.drinkType) && !lockType) {
    next.drinkType = input.fields.drinkType.value;
    applied.push("drinkType");
  }

  if (usable(input.fields.volumeMl) && !input.touched.volumeMl) {
    next.volumeMl = input.fields.volumeMl.value;
    applied.push("volumeMl");
  } else if (
    applied.includes("drinkType") &&
    !input.touched.volumeMl &&
    !usable(input.fields.volumeMl)
  ) {
    next.volumeMl = DRINK_TYPE_PRESETS[next.drinkType].volumeMl;
  }

  if (usable(input.fields.abvPercent) && !input.touched.abvPercent) {
    next.abvPercent = input.fields.abvPercent.value;
    applied.push("abvPercent");
  } else if (
    applied.includes("drinkType") &&
    !input.touched.abvPercent &&
    !usable(input.fields.abvPercent)
  ) {
    next.abvPercent = DRINK_TYPE_PRESETS[next.drinkType].abvPercent;
  }

  return { next, applied };
}

export function countDrinkRecognizeFields(fields: DrinkRecognizeFields): number {
  return (Object.keys(fields) as (keyof DrinkRecognizeFields)[]).filter(
    (key) => fields[key] !== undefined,
  ).length;
}
