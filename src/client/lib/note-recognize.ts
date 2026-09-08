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
  marks: Set<string>;
};

function usable<T>(
  field: { value: T; confidence: number } | undefined,
): field is { value: T; confidence: number } {
  return field !== undefined && field.confidence >= AI_RECOGNIZE_MIN_CONFIDENCE;
}

function empty(value: string): boolean {
  return value.trim().length === 0;
}

function canFillText(current: string, touched: boolean, marked: boolean): boolean {
  return !touched && (empty(current) || marked);
}

/** 空欄または直前の AI 値は再読取で上書き。触った欄とボトルで埋まった種類は上書きしない */
export function applyRecognizeToNoteForm(input: {
  state: NoteFormState;
  fields: NoteRecognizeFields;
  touched: NoteRecognizeTouched;
  marks?: ReadonlySet<string>;
}): ApplyNoteRecognizeResult {
  const next = { ...input.state };
  const applied: ApplyNoteRecognizeResult["applied"] = [];
  const marks = new Set(input.marks);
  const lockType = input.touched.drinkType || Boolean(input.state.bottleId);

  if (
    usable(input.fields.drinkName) &&
    canFillText(next.drinkName, input.touched.drinkName, marks.has("drinkName"))
  ) {
    next.drinkName = input.fields.drinkName.value;
    applied.push("drinkName");
    marks.add("drinkName");
  }
  if (usable(input.fields.drinkType) && !lockType) {
    next.drinkType = input.fields.drinkType.value;
    applied.push("drinkType");
  }
  if (
    usable(input.fields.vintage) &&
    canFillText(next.vintage, input.touched.vintage, marks.has("vintage"))
  ) {
    next.vintage = String(input.fields.vintage.value);
    applied.push("vintage");
    marks.add("vintage");
  }
  if (
    usable(input.fields.producer) &&
    canFillText(next.producer, input.touched.producer, marks.has("producer"))
  ) {
    next.producer = input.fields.producer.value;
    applied.push("producer");
    marks.add("producer");
  }
  if (
    usable(input.fields.origin) &&
    canFillText(next.origin, input.touched.origin, marks.has("origin"))
  ) {
    next.origin = input.fields.origin.value;
    applied.push("origin");
    marks.add("origin");
  }
  if (
    usable(input.fields.variety) &&
    canFillText(next.variety, input.touched.variety, marks.has("variety"))
  ) {
    next.variety = input.fields.variety.value;
    applied.push("variety");
    marks.add("variety");
  }

  return { next, applied, marks };
}

export function latestNoteRecognizeJpeg(
  items: readonly { recognizeJpeg?: Blob | null }[],
): Blob | undefined {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const jpeg = items[i]?.recognizeJpeg;
    if (jpeg) {
      return jpeg;
    }
  }
  return undefined;
}

export function countNoteRecognizeFields(fields: NoteRecognizeFields): number {
  return (Object.keys(fields) as (keyof NoteRecognizeFields)[]).filter(
    (key) => fields[key] !== undefined,
  ).length;
}
