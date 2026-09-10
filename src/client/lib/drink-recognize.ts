import { DRINK_TYPE_PRESETS } from "@/shared/alcohol.ts";
import { AI_RECOGNIZE_MIN_CONFIDENCE } from "@/shared/constants.ts";
import type {
  DrinkLookupRequest,
  DrinkRecognizeFields,
  DrinkRecognizeResponse,
} from "@/shared/drink-recognize.ts";
import type { LogFormState } from "./log-form.ts";

/**
 * 写真欄の下の読み取り状態（spec/screen-designs/03-log.md N2）。
 * loading: 欄側にも「読み取り中」ピルを出す。lookup: 抽出は済み、国・品種だけ照合中（二段階の後半）。
 * success: 入れた件数を出す。empty / failure: 黙らず 1 行で知らせ、手入力を続けられることを示す。
 */
export const DRINK_RECOGNIZE_BANNER = {
  loading: "写真を読み取っています…",
  lookup: "生産国・品種を調べています…",
  success: "写真から入れました",
  empty: "写真から読み取れる項目がありませんでした。手で入力できます",
  failure: "読み取れませんでした（手で入力してください）",
} as const;

export type DrinkRecognizeStatus = keyof typeof DRINK_RECOGNIZE_BANNER;

function appliedMessage(appliedCount: number): string {
  return `写真から ${appliedCount} 項目を入れました`;
}

export function drinkRecognizeBannerMessage(
  status: DrinkRecognizeStatus,
  appliedCount: number,
): string {
  if (status === "success") {
    return appliedCount > 0
      ? `${appliedMessage(appliedCount)}（AI 印の欄。修正できます）`
      : DRINK_RECOGNIZE_BANNER.success;
  }
  if (status === "lookup") {
    return appliedCount > 0
      ? `${appliedMessage(appliedCount)}。${DRINK_RECOGNIZE_BANNER.lookup}`
      : DRINK_RECOGNIZE_BANNER.lookup;
  }
  return DRINK_RECOGNIZE_BANNER[status];
}

/**
 * 抽出が終わったあとの結果文（照合が入らなかった / 失敗したときもここへ戻す）。
 * `anyApplied` は AI 印の無い欄（量・度数）だけが入ったときに「読み取れなかった」と言わないための印
 */
export function settledRecognizeStatus(
  appliedCount: number,
  anyApplied: boolean = appliedCount > 0,
): DrinkRecognizeStatus {
  return appliedCount > 0 || anyApplied ? "success" : "empty";
}

export type DrinkRecognizeTouched = {
  drinkName: boolean;
  drinkType: boolean;
  volumeMl: boolean;
  abvPercent: boolean;
  producer: boolean;
  origin: boolean;
  variety: boolean;
  vintage: boolean;
};

export type ApplyDrinkRecognizeInput = {
  state: LogFormState;
  fields: DrinkRecognizeFields;
  touched: DrinkRecognizeTouched;
  /** 直前の AI が入った識別欄。再読取ではここを上書きする */
  marks?: ReadonlySet<string>;
};

export type ApplyDrinkRecognizeResult = {
  next: LogFormState;
  applied: Array<
    | "drinkName"
    | "drinkType"
    | "volumeMl"
    | "abvPercent"
    | "producer"
    | "origin"
    | "variety"
    | "vintage"
  >;
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

export const DRINK_RECOGNIZE_TEXT_FIELDS = [
  "drinkName",
  "producer",
  "origin",
  "variety",
  "vintage",
] as const satisfies readonly (keyof DrinkRecognizeTouched)[];

/** 照合（二段階の後半）が入れうる欄 */
export const DRINK_LOOKUP_FIELDS = ["origin", "variety"] as const satisfies readonly (
  | "origin"
  | "variety"
)[];

/**
 * 読み取り中に「AI が入れるかもしれない欄」。空欄と直前の AI 値の欄で、ユーザーが触っていないもの。
 * 欄側に「読み取り中」ピルを出して、まだ反映されていないことを示す（種類は行ピルで別扱い）。
 * 照合中は `fields` を国・品種だけに絞る。
 */
export function pendingDrinkRecognizeFields(
  state: Pick<LogFormState, (typeof DRINK_RECOGNIZE_TEXT_FIELDS)[number]>,
  touched: DrinkRecognizeTouched,
  marks: ReadonlySet<string>,
  fields: readonly (typeof DRINK_RECOGNIZE_TEXT_FIELDS)[number][] = DRINK_RECOGNIZE_TEXT_FIELDS,
): Set<string> {
  const pending = new Set<string>();
  for (const field of fields) {
    if (canFillText(state[field], touched[field], marks.has(field))) {
      pending.add(field);
    }
  }
  return pending;
}

/**
 * 抽出のあと照合を呼ぶか（ai-recognition.md 7a）。サーバーが勧め、品名・生産者が取れていて、
 * 国か品種のどちらかがまだ AI で埋められる欄のときだけ。呼ぶなら送る本文を返す。
 */
export function planDrinkLookup(
  result: Pick<DrinkRecognizeResponse, "fields" | "lookupSuggested" | "appellation">,
  state: Pick<LogFormState, (typeof DRINK_RECOGNIZE_TEXT_FIELDS)[number]>,
  touched: DrinkRecognizeTouched,
  marks: ReadonlySet<string>,
): DrinkLookupRequest | null {
  if (!result.lookupSuggested) {
    return null;
  }
  const drinkName = result.fields.drinkName?.value.trim();
  const producer = result.fields.producer?.value.trim();
  if (!drinkName || !producer) {
    return null;
  }
  if (pendingDrinkRecognizeFields(state, touched, marks, DRINK_LOOKUP_FIELDS).size === 0) {
    return null;
  }
  const vintage = result.fields.vintage?.value;
  const drinkType = result.fields.drinkType?.value;
  const appellation = result.appellation?.trim();
  return {
    drinkName,
    producer,
    ...(vintage !== undefined ? { vintage } : {}),
    ...(drinkType !== undefined ? { drinkType } : {}),
    ...(appellation ? { appellation } : {}),
  };
}

/**
 * 空欄、または直前に AI が入った欄は再読取で上書きする。
 * ユーザーが触った欄と、ボトル等で埋まった AI 印なしの値は上書きしない。
 * 種類を推測したら量は推測値を優先し、無ければ種類のデフォルトを入れる（applyDrinkType で潰さない）。
 */
export function applyRecognizeToLogForm(
  input: ApplyDrinkRecognizeInput,
): ApplyDrinkRecognizeResult {
  const next = { ...input.state };
  const applied: ApplyDrinkRecognizeResult["applied"] = [];
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
  if (
    usable(input.fields.vintage) &&
    canFillText(next.vintage, input.touched.vintage, marks.has("vintage"))
  ) {
    next.vintage = String(input.fields.vintage.value);
    applied.push("vintage");
    marks.add("vintage");
  }

  if (usable(input.fields.drinkType) && !lockType) {
    next.drinkType = input.fields.drinkType.value;
    applied.push("drinkType");
    marks.add("drinkType");
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

  return { next, applied, marks };
}

/**
 * 状態行「写真から N 項目を入れました（AI 印の欄）」の N。
 * 量・度数は AI 印を付けずに黙って補完するので、印の付いた欄だけを数える（印の無い欄を数えると
 * 見える AI 印より多い件数になる）
 */
export function countMarkedApplied(
  result: Pick<ApplyDrinkRecognizeResult, "applied" | "marks">,
): number {
  return result.applied.filter((field) => result.marks.has(field)).length;
}

/** ボトルから埋まった欄と、編集時の既存値を AI 上書きから守る */
export function lockInheritedRecognizeFields(
  touched: DrinkRecognizeTouched,
  state: LogFormState,
  options: { lockDrinkType?: boolean; lockVolume?: boolean } = {},
): void {
  if (options.lockDrinkType || state.bottleId) {
    touched.drinkType = true;
  }
  if (options.lockVolume) {
    touched.volumeMl = true;
    touched.abvPercent = true;
  }
  if (state.drinkName.trim()) {
    touched.drinkName = true;
  }
  if (state.producer.trim()) {
    touched.producer = true;
  }
  if (state.origin.trim()) {
    touched.origin = true;
  }
  if (state.variety.trim()) {
    touched.variety = true;
  }
  if (state.vintage.trim()) {
    touched.vintage = true;
  }
}

export function countDrinkRecognizeFields(fields: DrinkRecognizeFields): number {
  return (Object.keys(fields) as (keyof DrinkRecognizeFields)[]).filter(
    (key) => fields[key] !== undefined,
  ).length;
}
