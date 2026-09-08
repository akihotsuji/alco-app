import { AI_RECOGNIZE_MIN_CONFIDENCE } from "@/shared/constants.ts";
import type { NoteRecognizeFields } from "@/shared/note-recognize.ts";
import type { NoteFormState } from "./note-form.ts";

export const NOTE_RECOGNIZE_BANNER = {
  loading: "写真から銘柄を推測しています…",
  success: "写真から入れました",
  failure: "読み取れませんでした（手で入力してください）",
} as const;

export type NoteRecognizeTouched = {
  drinkName: boolean;
  drinkType: boolean;
  vintage: boolean;
};

export type ApplyNoteRecognizeResult = {
  next: NoteFormState;
  applied: Array<"drinkName" | "drinkType" | "vintage">;
};

function usable<T>(
  field: { value: T; confidence: number } | undefined,
): field is { value: T; confidence: number } {
  return field !== undefined && field.confidence >= AI_RECOGNIZE_MIN_CONFIDENCE;
}

/** 空欄にだけ入れる。触った欄とボトルで埋まった種類は上書きしない */
export function applyRecognizeToNoteForm(input: {
  state: NoteFormState;
  fields: NoteRecognizeFields;
  touched: NoteRecognizeTouched;
}): ApplyNoteRecognizeResult {
  const next = { ...input.state };
  const applied: ApplyNoteRecognizeResult["applied"] = [];
  const lockType = input.touched.drinkType || Boolean(input.state.bottleId);

  if (usable(input.fields.drinkName) && next.drinkName.trim() === "" && !input.touched.drinkName) {
    next.drinkName = input.fields.drinkName.value;
    applied.push("drinkName");
  }
  if (usable(input.fields.drinkType) && !lockType) {
    next.drinkType = input.fields.drinkType.value;
    applied.push("drinkType");
  }
  if (usable(input.fields.vintage) && next.vintage.trim() === "" && !input.touched.vintage) {
    next.vintage = String(input.fields.vintage.value);
    applied.push("vintage");
  }

  return { next, applied };
}

export function countNoteRecognizeFields(fields: NoteRecognizeFields): number {
  return (Object.keys(fields) as (keyof NoteRecognizeFields)[]).filter(
    (key) => fields[key] !== undefined,
  ).length;
}
