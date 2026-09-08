import { isApiClientError } from "@/client/lib/api.ts";
import {
  BOTTLE_VOLUME_CHIPS,
  calculateAlcoholGrams,
  DRINK_TYPE_PRESETS,
  displayAlcoholGrams,
  volumeChipsFor,
} from "@/shared/alcohol.ts";
import { DEFAULT_DRINK_TYPE, type DrinkType } from "@/shared/constants.ts";
import {
  abvPercentSchema,
  type CreateDrinkLogInput,
  DRINK_LOG_MESSAGES,
  DRINK_NAME_MAX_LENGTH,
  type DrinkLog,
  isDrunkAtAllowed,
  memoSchema,
  type UpdateDrinkLogInput,
  volumeMlSchema,
} from "@/shared/drink-logs.ts";
import {
  IDENTITY_MESSAGES,
  IDENTITY_TEXT_MAX_LENGTH,
  normalizeOptionalText,
  vintageSchema,
} from "@/shared/identity.ts";
import { PLACE_MESSAGES, placeCoordsArePaired } from "@/shared/place.ts";
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
  drinkName: string;
  volumeMl: number | null;
  abvPercent: number | null;
  /** UTC ISO。表示・入力は Asia/Tokyo 固定 */
  drunkAt: string;
  producer: string;
  origin: string;
  variety: string;
  vintage: string;
  placeName: string;
  placeLat: number | null;
  placeLng: number | null;
  memo: string;
  bottleId: string | null;
  bottleName: string | null;
};

export type LogFormField =
  | "drinkName"
  | "volumeMl"
  | "abvPercent"
  | "drunkAt"
  | "producer"
  | "origin"
  | "variety"
  | "vintage"
  | "placeName"
  | "memo"
  | "photoIds"
  | "bottleId";

export type LogFormErrors = Partial<Record<LogFormField, string>>;

export const ABV_STEP = 0.1;

export { DEFAULT_DRINK_TYPE };

export const SAVE_LABELS = {
  idle: "記録を保存",
  saving: "保存中",
  photoUploading: "写真を保存中",
} as const;

export const SAVE_DISABLED_HINTS = {
  volumeAbv: "量と度数を入力してください",
  photo: "写真の保存が終わるまでお待ちください",
  photoError: "写真を再試行するか削除してください",
  fields: "入力内容を確認してください",
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
    drinkName: "",
    volumeMl: preset.volumeMl,
    abvPercent: preset.abvPercent,
    drunkAt: initialDrunkAt(dateParam, now),
    producer: "",
    origin: "",
    variety: "",
    vintage: "",
    placeName: "",
    placeLat: null,
    placeLng: null,
    memo: "",
    bottleId: null,
    bottleName: null,
  };
}

/** N3: 種類を選ぶと量・度数を **その種類のデフォルトで上書き**（触った値は捨てる。「その他」は両方空） */
export function applyDrinkType(state: LogFormState, drinkType: DrinkType): LogFormState {
  const preset = DRINK_TYPE_PRESETS[drinkType];
  return { ...state, drinkType, volumeMl: preset.volumeMl, abvPercent: preset.abvPercent };
}

/**
 * N8: ボトル詳細・開栓後の初回引き継ぎは種類（と種類デフォルトの量・度数）を入れる。
 * 後からの関連付けは手入力を上書きしない。ボトル固有の度数は推測しない。
 */
export function applySelectedBottle(
  state: LogFormState,
  bottle: {
    id: string;
    name: string;
    drinkType: DrinkType;
    producer?: string | null;
    origin?: string | null;
    variety?: string | null;
    vintage?: number | null;
  },
  options: { preserveEdits?: boolean } = {},
): LogFormState {
  const linked = { ...state, bottleId: bottle.id, bottleName: bottle.name };
  const fillEmpty = (current: string, next: string | null | undefined) =>
    current.trim().length > 0 ? current : (next ?? "");
  const withIdentity = {
    ...linked,
    drinkName: fillEmpty(linked.drinkName, bottle.name),
    producer: fillEmpty(linked.producer, bottle.producer),
    origin: fillEmpty(linked.origin, bottle.origin),
    variety: fillEmpty(linked.variety, bottle.variety),
    vintage:
      linked.vintage.trim().length > 0
        ? linked.vintage
        : bottle.vintage === null || bottle.vintage === undefined
          ? ""
          : String(bottle.vintage),
  };
  if (options.preserveEdits) {
    return withIdentity;
  }
  const next =
    bottle.drinkType === withIdentity.drinkType
      ? withIdentity
      : applyDrinkType(withIdentity, bottle.drinkType);
  return {
    ...next,
    bottleId: bottle.id,
    bottleName: bottle.name,
    drinkName: fillEmpty(next.drinkName, bottle.name),
  };
}

/** 遅れて届いたボトル取得で、触った入力を上書きしない */
export function shouldPreserveBottlePrefill(state: LogFormState, initial: LogFormState): boolean {
  return (
    state.drinkType !== initial.drinkType ||
    state.volumeMl !== initial.volumeMl ||
    state.abvPercent !== initial.abvPercent ||
    state.memo !== initial.memo ||
    state.drunkAt !== initial.drunkAt ||
    state.drinkName !== initial.drinkName ||
    state.producer !== initial.producer ||
    state.origin !== initial.origin ||
    state.variety !== initial.variety ||
    state.vintage !== initial.vintage ||
    state.placeName !== initial.placeName ||
    state.placeLat !== initial.placeLat ||
    state.placeLng !== initial.placeLng ||
    state.bottleId !== initial.bottleId
  );
}

export function clearSelectedBottle(state: LogFormState): LogFormState {
  return { ...state, bottleId: null, bottleName: null };
}

/** N4 のチップ列。種類の量 + ボトル量 375 / 750 / 1500 */
export function volumeChipValues(drinkType: DrinkType): number[] {
  return volumeChipsFor(drinkType);
}

/** 種類のよく使う量（「その他」に隠さない） */
export function primaryVolumeChips(drinkType: DrinkType): number[] {
  return [...DRINK_TYPE_PRESETS[drinkType].volumeChips];
}

/** ボトル量など、種類プリセット以外 */
export function extraVolumeChips(drinkType: DrinkType): number[] {
  const primary = new Set(primaryVolumeChips(drinkType));
  return BOTTLE_VOLUME_CHIPS.filter((chip) => !primary.has(chip));
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
  if (state.drinkName.length > DRINK_NAME_MAX_LENGTH) {
    errors.drinkName = DRINK_LOG_MESSAGES.drinkName;
  }
  for (const key of ["producer", "origin", "variety"] as const) {
    if (state[key].length > IDENTITY_TEXT_MAX_LENGTH) {
      errors[key] = IDENTITY_MESSAGES.text;
    }
  }
  const vintage = state.vintage.trim();
  if (vintage.length > 0 && !vintageSchema.safeParse(Number(vintage)).success) {
    errors.vintage = IDENTITY_MESSAGES.vintage;
  }
  if (
    !placeCoordsArePaired({
      placeLat: state.placeLat,
      placeLng: state.placeLng,
    })
  ) {
    errors.placeName = PLACE_MESSAGES.pair;
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

export function logSaveDisabledHint(
  state: LogFormState,
  errors: LogFormErrors,
  photo: PhotoSaveStatus,
): string | null {
  if (photo === "uploading") {
    return SAVE_DISABLED_HINTS.photo;
  }
  if (photo === "error") {
    return SAVE_DISABLED_HINTS.photoError;
  }
  if (state.volumeMl === null || state.abvPercent === null) {
    return SAVE_DISABLED_HINTS.volumeAbv;
  }
  if (Object.keys(errors).length > 0) {
    return SAVE_DISABLED_HINTS.fields;
  }
  return null;
}

/** 未操作の必須空欄は赤くしない。不正値と送信後だけ出す */
export function visibleLogFormErrors(
  errors: LogFormErrors,
  options: { submitted: boolean; touched: Partial<Record<LogFormField, boolean>> },
): LogFormErrors {
  if (options.submitted) {
    return errors;
  }
  const visible: LogFormErrors = {};
  for (const [key, message] of Object.entries(errors) as [LogFormField, string | undefined][]) {
    if (message && options.touched[key]) {
      visible[key] = message;
    }
  }
  return visible;
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
  if (state.bottleId) {
    body.bottleId = state.bottleId;
  }
  const drinkName = normalizeOptionalText(state.drinkName);
  if (drinkName) {
    body.drinkName = drinkName;
  }
  const producer = normalizeOptionalText(state.producer);
  if (producer) {
    body.producer = producer;
  }
  const origin = normalizeOptionalText(state.origin);
  if (origin) {
    body.origin = origin;
  }
  const variety = normalizeOptionalText(state.variety);
  if (variety) {
    body.variety = variety;
  }
  const vintage = state.vintage.trim();
  body.vintage = vintage.length === 0 ? null : Number(vintage);
  const placeName = normalizeOptionalText(state.placeName);
  if (placeName) {
    body.placeName = placeName;
  }
  if (state.placeLat !== null && state.placeLng !== null) {
    body.placeLat = state.placeLat;
    body.placeLng = state.placeLng;
  }
  return body;
}

export function logFormStateFromDrinkLog(log: DrinkLog): LogFormState {
  return {
    drinkType: log.drinkType,
    drinkName: log.drinkName ?? "",
    volumeMl: log.volumeMl,
    abvPercent: log.abvPercent,
    drunkAt: log.drunkAt,
    producer: log.producer ?? "",
    origin: log.origin ?? "",
    variety: log.variety ?? "",
    vintage: log.vintage === null ? "" : String(log.vintage),
    placeName: log.placeName ?? "",
    placeLat: log.placeLat,
    placeLng: log.placeLng,
    memo: log.memo ?? "",
    bottleId: log.bottleId,
    bottleName: log.bottleId ? (log.drinkName ?? null) : null,
  };
}

/** log-edit は変更したフィールドだけ送り、種類変更でも量・度数を上書きしない。 */
export function toUpdateDrinkLogBody(
  state: LogFormState,
  initial: LogFormState,
  replacementPhotoId: string | null,
): UpdateDrinkLogInput | null {
  const body: UpdateDrinkLogInput = {};
  if (state.drinkType !== initial.drinkType) {
    body.drinkType = state.drinkType;
  }
  if (state.volumeMl !== initial.volumeMl && state.volumeMl !== null) {
    body.volumeMl = state.volumeMl;
  }
  if (state.abvPercent !== initial.abvPercent && state.abvPercent !== null) {
    body.abvPercent = state.abvPercent;
  }
  if (state.drunkAt !== initial.drunkAt) {
    body.drunkAt = state.drunkAt;
  }
  if (state.memo.trim() !== initial.memo.trim()) {
    body.memo = state.memo.trim() || null;
  }
  if (replacementPhotoId) {
    body.photoIds = [replacementPhotoId];
  }
  if (state.bottleId !== initial.bottleId) {
    body.bottleId = state.bottleId;
  }
  if (state.drinkName.trim() !== initial.drinkName.trim()) {
    body.drinkName = normalizeOptionalText(state.drinkName);
  }
  if (state.producer.trim() !== initial.producer.trim()) {
    body.producer = normalizeOptionalText(state.producer);
  }
  if (state.origin.trim() !== initial.origin.trim()) {
    body.origin = normalizeOptionalText(state.origin);
  }
  if (state.variety.trim() !== initial.variety.trim()) {
    body.variety = normalizeOptionalText(state.variety);
  }
  if (state.vintage.trim() !== initial.vintage.trim()) {
    const vintage = state.vintage.trim();
    body.vintage = vintage.length === 0 ? null : Number(vintage);
  }
  if (state.placeName.trim() !== initial.placeName.trim()) {
    body.placeName = normalizeOptionalText(state.placeName);
  }
  if (state.placeLat !== initial.placeLat || state.placeLng !== initial.placeLng) {
    body.placeLat = state.placeLat;
    body.placeLng = state.placeLng;
  }
  return Object.keys(body).length > 0 ? body : null;
}

/** 初期状態から触ったか（戻るの確認に使う）。写真の有無は呼び元が足す */
export function isLogFormDirty(state: LogFormState, initial: LogFormState): boolean {
  return (
    state.drinkType !== initial.drinkType ||
    state.volumeMl !== initial.volumeMl ||
    state.abvPercent !== initial.abvPercent ||
    state.drunkAt !== initial.drunkAt ||
    state.memo.trim().length > 0 ||
    state.drinkName !== initial.drinkName ||
    state.producer !== initial.producer ||
    state.origin !== initial.origin ||
    state.variety !== initial.variety ||
    state.vintage !== initial.vintage ||
    state.placeName !== initial.placeName ||
    state.placeLat !== initial.placeLat ||
    state.placeLng !== initial.placeLng ||
    state.bottleId !== initial.bottleId
  );
}

export type SaveFailure = {
  /** フォーム上部の汎用文（無ければ null） */
  formMessage: string | null;
  /** 該当欄に出す文言 */
  fieldErrors: LogFormErrors;
  /** 写真の選択を解除すべきか（404） */
  dropPhoto: boolean;
  /** ボトルの選択を解除すべきか（404） */
  dropBottle: boolean;
};

const FIELD_KEYS: readonly LogFormField[] = [
  "drinkName",
  "volumeMl",
  "abvPercent",
  "drunkAt",
  "producer",
  "origin",
  "variety",
  "vintage",
  "placeName",
  "memo",
  "photoIds",
  "bottleId",
];

function isFormField(key: string): key is LogFormField {
  return (FIELD_KEYS as readonly string[]).includes(key);
}

/**
 * 保存失敗の振り分け（drink-log.md 4.5、00-common 2.4 / X4）。
 * 400 の `fields` は該当欄へ、キー `""` や未知キーは汎用文。404 は写真の解除 + 文言。
 * オフラインなら文言を差し替える。それ以外の理由は区別しない。
 */
export function describeSaveFailure(
  error: unknown,
  online: boolean,
  context: { hasPhoto?: boolean; hasBottle?: boolean } = {},
): SaveFailure {
  if (!online) {
    return {
      formMessage: FORM_ERROR_MESSAGES.offline,
      fieldErrors: {},
      dropPhoto: false,
      dropBottle: false,
    };
  }
  if (isApiClientError(error)) {
    if (error.code === "not_found") {
      const hasPhoto = context.hasPhoto ?? true;
      const hasBottle = context.hasBottle ?? false;
      const fieldErrors: LogFormErrors = {};
      if (hasPhoto) {
        fieldErrors.photoIds = DRINK_LOG_MESSAGES.photoNotFound;
      }
      if (hasBottle) {
        fieldErrors.bottleId = DRINK_LOG_MESSAGES.bottleNotFound;
      }
      return {
        formMessage: Object.keys(fieldErrors).length === 0 ? FORM_ERROR_MESSAGES.generic : null,
        fieldErrors,
        dropPhoto: hasPhoto,
        dropBottle: hasBottle,
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
        dropBottle: false,
      };
    }
  }
  return {
    formMessage: FORM_ERROR_MESSAGES.generic,
    fieldErrors: {},
    dropPhoto: false,
    dropBottle: false,
  };
}
