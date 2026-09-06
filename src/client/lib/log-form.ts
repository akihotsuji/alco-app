import { isApiClientError } from "@/client/lib/api.ts";
import {
  calculateAlcoholGrams,
  DRINK_TYPE_PRESETS,
  displayAlcoholGrams,
  volumeChipsFor,
} from "@/shared/alcohol.ts";
import type { DrinkType } from "@/shared/constants.ts";
import {
  abvPercentSchema,
  type CreateDrinkLogInput,
  DRINK_LOG_MESSAGES,
  isDrunkAtAllowed,
  memoSchema,
  volumeMlSchema,
} from "@/shared/drink-logs.ts";
import {
  formatMonthDay,
  formatTokyoTime,
  parseCalendarDate,
  tokyoEveningIso,
  tokyoToday,
} from "@/shared/tokyo-date.ts";

/**
 * `log-new` の入力状態と規則（spec/features/drink-log.md 3.2 / 3.7、screen-designs/03-log.md N3〜N10）。
 * 画面はここを呼ぶだけにし、規則の単体テストをこのファイルに対して書く。
 */

export type LogFormState = {
  drinkType: DrinkType;
  volumeMl: number | null;
  abvPercent: number | null;
  /** UTC ISO。表示・入力は Asia/Tokyo 固定 */
  drunkAt: string;
  memo: string;
};

export type LogFormField = "volumeMl" | "abvPercent" | "drunkAt" | "memo" | "photoIds";

export type LogFormErrors = Partial<Record<LogFormField, string>>;

export const ABV_STEP = 0.1;

export const DEFAULT_DRINK_TYPE: DrinkType = "wine";

export const SAVE_LABELS = {
  idle: "保存する",
  saving: "保存中",
  photoUploading: "写真を保存中",
} as const;

export const FORM_ERROR_MESSAGES = {
  generic: "保存できませんでした。もう一度試してください",
  offline: "オフラインです。接続してからもう一度試してください",
} as const;

/** `?date=` が過去日なら 20:00 JST、今日・未指定・未来日・不正なら「いま」（E5） */
export function initialDrunkAt(dateParam: string | null | undefined, now: Date): string {
  if (dateParam && parseCalendarDate(dateParam) && dateParam < tokyoToday(now)) {
    return tokyoEveningIso(dateParam);
  }
  return now.toISOString();
}

export function initialLogFormState(dateParam: string | null | undefined, now: Date): LogFormState {
  const preset = DRINK_TYPE_PRESETS[DEFAULT_DRINK_TYPE];
  return {
    drinkType: DEFAULT_DRINK_TYPE,
    volumeMl: preset.volumeMl,
    abvPercent: preset.abvPercent,
    drunkAt: initialDrunkAt(dateParam, now),
    memo: "",
  };
}

/** N3: 種類を選ぶと量・度数を **その種類のデフォルトで上書き**（触った値は捨てる。「その他」は両方空） */
export function applyDrinkType(state: LogFormState, drinkType: DrinkType): LogFormState {
  const preset = DRINK_TYPE_PRESETS[drinkType];
  return { ...state, drinkType, volumeMl: preset.volumeMl, abvPercent: preset.abvPercent };
}

/** N4 のチップ列。種類の量 + ボトル量 375 / 750 / 1500 */
export function volumeChipValues(drinkType: DrinkType): number[] {
  return volumeChipsFor(drinkType);
}

/** 量チップに無い値（または空）は「手入力」が選択状態になる */
export function isManualVolume(drinkType: DrinkType, volumeMl: number | null): boolean {
  return volumeMl === null || !volumeChipValues(drinkType).includes(volumeMl);
}

/** 度数ステッパー。0.1 刻みで 0〜100 に丸めて止める。空からは種類の既定（無ければ 0）を起点にする */
export function stepAbv(current: number | null, direction: 1 | -1): number {
  const base = current ?? 0;
  const next = Math.round((base + direction * ABV_STEP) * 10) / 10;
  return Math.min(100, Math.max(0, next));
}

/** 度数の表示。第 1 位まで、末尾 .0 は省く（「12」「12.5」） */
export function formatAbv(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return String(Math.round(value * 10) / 10);
}

/** N6: 量・度数が揃っていれば `displayAlcoholGrams(calculateAlcoholGrams())`、無ければ null（「—」） */
export function liveAlcoholGrams(
  state: Pick<LogFormState, "volumeMl" | "abvPercent">,
): number | null {
  if (state.volumeMl === null || state.abvPercent === null) {
    return null;
  }
  if (!volumeMlSchema.safeParse(state.volumeMl).success) {
    return null;
  }
  if (!abvPercentSchema.safeParse(state.abvPercent).success) {
    return null;
  }
  return displayAlcoholGrams(calculateAlcoholGrams(state.volumeMl, state.abvPercent));
}

export function formatGrams(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

/** N7 の行ラベル。今日は「今日 HH:MM」、他は「9月4日 20:00」（JST 固定） */
export function formatDrunkAtLabel(drunkAt: string, now: Date): string {
  const instant = new Date(drunkAt);
  const date = tokyoToday(instant);
  const day = date === tokyoToday(now) ? "今日" : formatMonthDay(date);
  return `${day} ${formatTokyoTime(instant)}`;
}

/** クライアント側の即時判定。サーバーの 400 が最終判定 */
export function validateLogForm(state: LogFormState, now: Date): LogFormErrors {
  const errors: LogFormErrors = {};
  if (state.volumeMl !== null && !volumeMlSchema.safeParse(state.volumeMl).success) {
    errors.volumeMl = DRINK_LOG_MESSAGES.volumeMl;
  }
  if (state.abvPercent !== null) {
    const result = abvPercentSchema.safeParse(state.abvPercent);
    if (!result.success) {
      errors.abvPercent = result.error.issues[0]?.message ?? DRINK_LOG_MESSAGES.abvPercent;
    }
  }
  const drunkAt = new Date(state.drunkAt);
  if (Number.isNaN(drunkAt.getTime())) {
    errors.drunkAt = DRINK_LOG_MESSAGES.drunkAtFormat;
  } else if (!isDrunkAtAllowed(drunkAt, now)) {
    errors.drunkAt = DRINK_LOG_MESSAGES.drunkAtFuture;
  }
  if (!memoSchema.safeParse(state.memo).success) {
    errors.memo = DRINK_LOG_MESSAGES.memo;
  }
  return errors;
}

export type PhotoSaveStatus = "none" | "uploading" | "ready" | "error";

/** N10 の無効条件: 量または度数が空 / 範囲外、日時が範囲外、写真アップロード中・失敗中 */
export function canSubmitLogForm(
  state: LogFormState,
  errors: LogFormErrors,
  photo: PhotoSaveStatus,
): boolean {
  if (state.volumeMl === null || state.abvPercent === null) {
    return false;
  }
  if (Object.keys(errors).length > 0) {
    return false;
  }
  return photo === "none" || photo === "ready";
}

export function saveButtonLabel(pending: boolean, photo: PhotoSaveStatus): string {
  if (pending) {
    return SAVE_LABELS.saving;
  }
  if (photo === "uploading") {
    return SAVE_LABELS.photoUploading;
  }
  return SAVE_LABELS.idle;
}

/** 送信ボディ。`alcoholG` / `drunkOn` は含めない（サーバー計算） */
export function toCreateDrinkLogBody(
  state: LogFormState,
  photoId: string | null,
): CreateDrinkLogInput | null {
  if (state.volumeMl === null || state.abvPercent === null) {
    return null;
  }
  const body: CreateDrinkLogInput = {
    drinkType: state.drinkType,
    volumeMl: state.volumeMl,
    abvPercent: state.abvPercent,
    drunkAt: state.drunkAt,
  };
  const memo = state.memo.trim();
  if (memo.length > 0) {
    body.memo = memo;
  }
  if (photoId) {
    body.photoIds = [photoId];
  }
  return body;
}

/** 初期状態から触ったか（戻るの確認に使う）。写真の有無は呼び元が足す */
export function isLogFormDirty(state: LogFormState, initial: LogFormState): boolean {
  return (
    state.drinkType !== initial.drinkType ||
    state.volumeMl !== initial.volumeMl ||
    state.abvPercent !== initial.abvPercent ||
    state.drunkAt !== initial.drunkAt ||
    state.memo.trim().length > 0
  );
}

export type SaveFailure = {
  /** フォーム上部の汎用文（無ければ null） */
  formMessage: string | null;
  /** 該当欄に出す文言 */
  fieldErrors: LogFormErrors;
  /** 写真の選択を解除すべきか（404） */
  dropPhoto: boolean;
};

const FIELD_KEYS: readonly LogFormField[] = [
  "volumeMl",
  "abvPercent",
  "drunkAt",
  "memo",
  "photoIds",
];

function isFormField(key: string): key is LogFormField {
  return (FIELD_KEYS as readonly string[]).includes(key);
}

/**
 * 保存失敗の振り分け（drink-log.md 4.5、00-common 2.4 / X4）。
 * 400 の `fields` は該当欄へ、キー `""` や未知キーは汎用文。404 は写真の解除 + 文言。
 * オフラインなら文言を差し替える。それ以外の理由は区別しない。
 */
export function describeSaveFailure(error: unknown, online: boolean): SaveFailure {
  if (!online) {
    return { formMessage: FORM_ERROR_MESSAGES.offline, fieldErrors: {}, dropPhoto: false };
  }
  if (isApiClientError(error)) {
    if (error.code === "not_found") {
      return {
        formMessage: null,
        fieldErrors: { photoIds: DRINK_LOG_MESSAGES.photoNotFound },
        dropPhoto: true,
      };
    }
    if (error.code === "validation_error" && error.fields) {
      const fieldErrors: LogFormErrors = {};
      let generic = false;
      for (const [key, messages] of Object.entries(error.fields)) {
        const field = key.split(".")[0] ?? "";
        if (isFormField(field) && messages[0]) {
          fieldErrors[field] = messages[0];
        } else {
          generic = true;
        }
      }
      return {
        formMessage:
          generic || Object.keys(fieldErrors).length === 0 ? FORM_ERROR_MESSAGES.generic : null,
        fieldErrors,
        dropPhoto: false,
      };
    }
  }
  return { formMessage: FORM_ERROR_MESSAGES.generic, fieldErrors: {}, dropPhoto: false };
}
