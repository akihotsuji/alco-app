import { AI_RECOGNIZE_MIN_CONFIDENCE } from "@/shared/constants.ts";
import type { RecognizeFields } from "@/shared/label-recognize.ts";
import type { BottleFormState } from "./bottle-form.ts";

export const RECOGNIZE_BANNER = {
  loading: "ラベルを読み取り中…",
  success: "ラベルから読み取りました。内容を確認して保存してください",
  failure: "読み取れませんでした（手で入力してください）",
} as const;

export type RecognizeBannerStatus = "loading" | "success" | "failure";

export type RecognizeMarkField = "name" | "producer" | "origin" | "variety" | "vintage";

export type ApplyRecognizeInput = {
  state: BottleFormState;
  fields: RecognizeFields;
  drinkTypeTouched: boolean;
  marks: ReadonlySet<RecognizeMarkField>;
};

export type ApplyRecognizeResult = {
  next: BottleFormState;
  marks: Set<RecognizeMarkField>;
  openDetails: boolean;
  applied: RecognizeMarkField[];
};

function usable<T>(
  field: { value: T; confidence: number } | undefined,
): field is { value: T; confidence: number } {
  return field !== undefined && field.confidence >= AI_RECOGNIZE_MIN_CONFIDENCE;
}

function canFillText(current: string, marked: boolean): boolean {
  return current.trim() === "" || marked;
}

/** 空欄、または直前に AI が入った欄は再読取で上書きする。`abvPercent` は捨てる。確度 0.5 未満は捨てる */
export function applyRecognizeToForm(input: ApplyRecognizeInput): ApplyRecognizeResult {
  const next = { ...input.state };
  const marks = new Set(input.marks);
  const applied: RecognizeMarkField[] = [];

  if (usable(input.fields.name) && canFillText(next.name, marks.has("name"))) {
    next.name = input.fields.name.value;
    marks.add("name");
    applied.push("name");
  }
  if (usable(input.fields.producer) && canFillText(next.producer, marks.has("producer"))) {
    next.producer = input.fields.producer.value;
    marks.add("producer");
    applied.push("producer");
  }
  if (usable(input.fields.origin) && canFillText(next.origin, marks.has("origin"))) {
    next.origin = input.fields.origin.value;
    marks.add("origin");
    applied.push("origin");
  }
  if (usable(input.fields.variety) && canFillText(next.variety, marks.has("variety"))) {
    next.variety = input.fields.variety.value;
    marks.add("variety");
    applied.push("variety");
  }
  if (usable(input.fields.vintage) && canFillText(next.vintage, marks.has("vintage"))) {
    next.vintage = String(input.fields.vintage.value);
    marks.add("vintage");
    applied.push("vintage");
  }
  if (usable(input.fields.drinkType) && !input.drinkTypeTouched) {
    next.drinkType = input.fields.drinkType.value;
  }

  return {
    next,
    marks,
    openDetails: applied.some(
      (key) => key === "producer" || key === "origin" || key === "variety" || key === "vintage",
    ),
    applied,
  };
}

export function countRecognizeFields(fields: RecognizeFields): number {
  return (Object.keys(fields) as (keyof RecognizeFields)[]).filter(
    (key) => fields[key] !== undefined,
  ).length;
}
