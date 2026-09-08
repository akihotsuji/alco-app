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
  producer: boolean;
  origin: boolean;
  variety: boolean;
};

export type ApplyNoteRecognizeResult = {
  next: NoteFormState;
  applied: Array<"drinkName" | "drinkType" | "vintage" | "producer" | "origin" | "variety">;
};

function usable<T>(
  field: { value: T; confidence: number } | undefined,
): field is { value: T; confidence: number } {
  return field !== undefined && field.confidence >= AI_RECOGNIZE_MIN_CONFIDENCE;
}

function empty(value: string): boolean {
  return value.trim().length === 0;
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

  if (usable(input.fields.drinkName) && empty(next.drinkName) && !input.touched.drinkName) {
    next.drinkName = input.fields.drinkName.value;
    applied.push("drinkName");
  }
  if (usable(input.fields.drinkType) && !lockType) {
    next.drinkType = input.fields.drinkType.value;
    applied.push("drinkType");
  }
  if (usable(input.fields.vintage) && empty(next.vintage) && !input.touched.vintage) {
    next.vintage = String(input.fields.vintage.value);
    applied.push("vintage");
  }
  if (usable(input.fields.producer) && empty(next.producer) && !input.touched.producer) {
    next.producer = input.fields.producer.value;
    applied.push("producer");
  }
  if (usable(input.fields.origin) && empty(next.origin) && !input.touched.origin) {
    next.origin = input.fields.origin.value;
    applied.push("origin");
  }
  if (usable(input.fields.variety) && empty(next.variety) && !input.touched.variety) {
    next.variety = input.fields.variety.value;
    applied.push("variety");
  }

  return { next, applied };
}

export function countNoteRecognizeFields(fields: NoteRecognizeFields): number {
  return (Object.keys(fields) as (keyof NoteRecognizeFields)[]).filter(
    (key) => fields[key] !== undefined,
  ).length;
}
