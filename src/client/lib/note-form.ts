import { isApiClientError } from "@/client/lib/api.ts";
import { vintageSchema } from "@/shared/bottles.ts";
import type { BottleStatus, DrinkType } from "@/shared/constants.ts";
import type { DrinkLog } from "@/shared/drink-logs.ts";
import {
  IDENTITY_MESSAGES,
  IDENTITY_TEXT_MAX_LENGTH,
  normalizeOptionalText,
  originInputError,
} from "@/shared/identity.ts";
import {
  type CreateTastingNoteInput,
  isTastedOnAllowed,
  isValidRatingX10,
  NOTE_DRINK_NAME_MAX_LENGTH,
  NOTE_TEXT_MAX_LENGTH,
  TASTING_NOTE_MESSAGES,
  type TastingNote,
  type UpdateTastingNoteInput,
} from "@/shared/tasting-notes.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";

export type NoteFormState = {
  bottleId: string | null;
  bottleName: string | null;
  bottleStatus: BottleStatus | null;
  drinkName: string;
  drinkType: DrinkType | null;
  vintage: string;
  producer: string;
  origin: string;
  variety: string;
  tastedOn: string;
  ratingX10: number | null;
  appearance: string;
  aroma: string;
  taste: string;
  finish: string;
};

export type NoteFormField =
  | "drinkName"
  | "drinkType"
  | "vintage"
  | "producer"
  | "origin"
  | "variety"
  | "tastedOn"
  | "ratingX10"
  | "appearance"
  | "aroma"
  | "taste"
  | "finish"
  | "photoIds"
  | "bottleId";

export type NoteFormErrors = Partial<Record<NoteFormField, string>>;

export type PhotoSaveStatus = "none" | "uploading" | "ready" | "error";

export const NOTE_SAVE_LABELS = {
  idle: "ノートを保存",
  saving: "保存中",
  photoUploading: "写真を保存中",
} as const;

export const NOTE_SAVE_DISABLED_HINT = "必須項目を入力してください";

export const NOTE_FORM_ERROR_MESSAGES = {
  generic: "保存できませんでした。もう一度試してください",
  offline: "オフラインです。接続してからもう一度試してください",
} as const;

export function initialNoteFormState(now: Date = new Date()): NoteFormState {
  return {
    bottleId: null,
    bottleName: null,
    bottleStatus: null,
    drinkName: "",
    drinkType: null,
    vintage: "",
    producer: "",
    origin: "",
    variety: "",
    tastedOn: tokyoToday(now),
    ratingX10: null,
    appearance: "",
    aroma: "",
    taste: "",
    finish: "",
  };
}

export function applySelectedBottle(
  state: NoteFormState,
  bottle: {
    id: string;
    name: string;
    drinkType: DrinkType;
    status: BottleStatus;
    vintage?: number | null;
    producer?: string | null;
    origin?: string | null;
    variety?: string | null;
  },
  options: { preserveEdits?: boolean } = {},
): NoteFormState {
  const keepName = options.preserveEdits && state.drinkName.trim().length > 0;
  const keepType = options.preserveEdits && state.drinkType !== null;
  const keepVintage = options.preserveEdits && state.vintage.trim().length > 0;
  const keepProducer = options.preserveEdits && state.producer.trim().length > 0;
  const keepOrigin = options.preserveEdits && state.origin.trim().length > 0;
  const keepVariety = options.preserveEdits && state.variety.trim().length > 0;
  return {
    ...state,
    bottleId: bottle.id,
    bottleName: bottle.name,
    bottleStatus: bottle.status,
    drinkName: keepName ? state.drinkName : bottle.name,
    drinkType: keepType ? state.drinkType : bottle.drinkType,
    vintage: keepVintage
      ? state.vintage
      : bottle.vintage === null || bottle.vintage === undefined
        ? ""
        : String(bottle.vintage),
    producer: keepProducer ? state.producer : (bottle.producer ?? ""),
    origin: keepOrigin ? state.origin : (bottle.origin ?? ""),
    variety: keepVariety ? state.variety : (bottle.variety ?? ""),
  };
}

/** × で都度入力へ。スナップショットを初期値として残す */
export function clearSelectedBottle(state: NoteFormState): NoteFormState {
  return {
    ...state,
    bottleId: null,
    bottleName: null,
    bottleStatus: null,
  };
}

export function noteFormStateFromNote(note: TastingNote): NoteFormState {
  return {
    bottleId: note.bottleId,
    bottleName: note.bottle?.name ?? (note.bottleId ? note.drinkName : null),
    bottleStatus: note.bottle?.status ?? null,
    drinkName: note.drinkName,
    drinkType: note.drinkType,
    vintage: note.vintage === null ? "" : String(note.vintage),
    producer: note.producer ?? "",
    origin: note.origin ?? "",
    variety: note.variety ?? "",
    tastedOn: note.tastedOn,
    ratingX10: note.ratingX10,
    appearance: note.appearance ?? "",
    aroma: note.aroma ?? "",
    taste: note.taste ?? "",
    finish: note.finish ?? "",
  };
}

/** `log-new` 保存後の連続導線。評価は未選択のまま */
export function noteFormStateFromDrinkLog(log: DrinkLog, now: Date = new Date()): NoteFormState {
  return {
    ...initialNoteFormState(now),
    bottleId: log.bottleId,
    bottleName: log.bottleId ? (log.drinkName ?? null) : null,
    bottleStatus: null,
    drinkName: log.drinkName ?? "",
    drinkType: log.drinkType,
    vintage: log.vintage === null ? "" : String(log.vintage),
    producer: log.producer ?? "",
    origin: log.origin ?? "",
    variety: log.variety ?? "",
    tastedOn: log.drunkOn,
  };
}

export function noteDetailOpen(state: NoteFormState): boolean {
  return (
    state.appearance.trim().length > 0 ||
    state.aroma.trim().length > 0 ||
    state.finish.trim().length > 0
  );
}

export function bottleRowLabel(name: string, status: BottleStatus | null): string {
  return `${name}（${status === "consumed" ? "貯蔵庫" : "セラー"}）`;
}

export function validateNoteForm(
  state: NoteFormState,
  now: Date = new Date(),
  options: { existingOrigin?: string } = {},
): NoteFormErrors {
  const errors: NoteFormErrors = {};
  if (state.ratingX10 === null || !isValidRatingX10(state.ratingX10)) {
    errors.ratingX10 = TASTING_NOTE_MESSAGES.rating;
  }
  if (!isTastedOnAllowed(state.tastedOn, now)) {
    errors.tastedOn = state.tastedOn
      ? TASTING_NOTE_MESSAGES.tastedOnFuture
      : TASTING_NOTE_MESSAGES.tastedOnFormat;
  }
  if (!state.bottleId) {
    const name = state.drinkName.trim();
    if (name.length < 1 || name.length > NOTE_DRINK_NAME_MAX_LENGTH) {
      errors.drinkName = TASTING_NOTE_MESSAGES.drinkName;
    }
    if (!state.drinkType) {
      errors.drinkType = TASTING_NOTE_MESSAGES.drinkType;
    }
  }
  const vintage = state.vintage.trim();
  if (vintage.length > 0 && !vintageSchema.safeParse(Number(vintage)).success) {
    errors.vintage = TASTING_NOTE_MESSAGES.vintage;
  }
  for (const key of ["producer", "variety"] as const) {
    if (state[key].length > IDENTITY_TEXT_MAX_LENGTH) {
      errors[key] = IDENTITY_MESSAGES.text;
    }
  }
  if (state.origin.length > IDENTITY_TEXT_MAX_LENGTH) {
    errors.origin = IDENTITY_MESSAGES.text;
  } else {
    const originError = originInputError(state.origin, options.existingOrigin);
    if (originError) {
      errors.origin = originError;
    }
  }
  for (const key of ["appearance", "aroma", "taste", "finish"] as const) {
    if (state[key].length > NOTE_TEXT_MAX_LENGTH) {
      errors[key] = TASTING_NOTE_MESSAGES.noteText;
    }
  }
  return errors;
}

export function canSubmitNoteForm(
  state: NoteFormState,
  errors: NoteFormErrors,
  photoStatus: PhotoSaveStatus,
): boolean {
  return (
    Object.keys(errors).length === 0 &&
    photoStatus !== "uploading" &&
    photoStatus !== "error" &&
    state.ratingX10 !== null
  );
}

export function noteSaveButtonLabel(pending: boolean, photoStatus: PhotoSaveStatus): string {
  if (pending) {
    return NOTE_SAVE_LABELS.saving;
  }
  if (photoStatus === "uploading") {
    return NOTE_SAVE_LABELS.photoUploading;
  }
  return NOTE_SAVE_LABELS.idle;
}

export function noteSaveDisabledHint(
  state: NoteFormState,
  errors: NoteFormErrors,
  photoStatus: PhotoSaveStatus,
): string | null {
  if (photoStatus === "uploading") {
    return "写真の保存が終わるまでお待ちください";
  }
  if (photoStatus === "error") {
    return "写真を再試行するか削除してください";
  }
  if (!canSubmitNoteForm(state, errors, photoStatus)) {
    return NOTE_SAVE_DISABLED_HINT;
  }
  return null;
}

const EMPTY_REQUIRED_NOTE_FIELDS = new Set<NoteFormField>(["ratingX10", "drinkName", "drinkType"]);

export function visibleNoteFormErrors(
  errors: NoteFormErrors,
  options: { submitted: boolean; touched: Partial<Record<NoteFormField, boolean>> },
): NoteFormErrors {
  if (options.submitted) {
    return errors;
  }
  const visible: NoteFormErrors = {};
  for (const [key, message] of Object.entries(errors) as [NoteFormField, string | undefined][]) {
    if (!message) {
      continue;
    }
    if (EMPTY_REQUIRED_NOTE_FIELDS.has(key) && !options.touched[key]) {
      continue;
    }
    if (options.touched[key] || !EMPTY_REQUIRED_NOTE_FIELDS.has(key)) {
      visible[key] = message;
    }
  }
  return visible;
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toCreateTastingNoteBody(
  state: NoteFormState,
  photoIds: readonly string[] = [],
): CreateTastingNoteInput | null {
  if (state.ratingX10 === null) {
    return null;
  }
  const body: CreateTastingNoteInput = {
    tastedOn: state.tastedOn,
    ratingX10: state.ratingX10,
  };
  if (state.bottleId) {
    body.bottleId = state.bottleId;
  } else if (!state.drinkType) {
    return null;
  }
  if (state.drinkType) {
    body.drinkType = state.drinkType;
  }
  const name = state.drinkName.trim();
  if (name.length > 0) {
    body.drinkName = name;
  }
  const vintage = state.vintage.trim();
  body.vintage = vintage.length === 0 ? null : Number(vintage);
  body.producer = normalizeOptionalText(state.producer);
  body.origin = normalizeOptionalText(state.origin);
  body.variety = normalizeOptionalText(state.variety);
  const appearance = optionalText(state.appearance);
  const aroma = optionalText(state.aroma);
  const taste = optionalText(state.taste);
  const finish = optionalText(state.finish);
  if (appearance) {
    body.appearance = appearance;
  }
  if (aroma) {
    body.aroma = aroma;
  }
  if (taste) {
    body.taste = taste;
  }
  if (finish) {
    body.finish = finish;
  }
  if (photoIds.length > 0) {
    body.photoIds = [...photoIds];
  }
  return body;
}

export function toUpdateTastingNoteBody(
  state: NoteFormState,
  initial: NoteFormState,
  photoIds?: readonly string[],
): UpdateTastingNoteInput | null {
  const body: UpdateTastingNoteInput = {};
  if (state.tastedOn !== initial.tastedOn) {
    body.tastedOn = state.tastedOn;
  }
  if (state.vintage.trim() !== initial.vintage.trim()) {
    const vintage = state.vintage.trim();
    body.vintage = vintage.length === 0 ? null : Number(vintage);
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
  if (state.ratingX10 !== initial.ratingX10 && state.ratingX10 !== null) {
    body.ratingX10 = state.ratingX10;
  }
  if (state.appearance.trim() !== initial.appearance.trim()) {
    body.appearance = state.appearance.trim() || null;
  }
  if (state.aroma.trim() !== initial.aroma.trim()) {
    body.aroma = state.aroma.trim() || null;
  }
  if (state.taste.trim() !== initial.taste.trim()) {
    body.taste = state.taste.trim() || null;
  }
  if (state.finish.trim() !== initial.finish.trim()) {
    body.finish = state.finish.trim() || null;
  }
  if (state.bottleId !== initial.bottleId) {
    if (state.bottleId) {
      body.bottleId = state.bottleId;
    } else if (state.drinkType) {
      body.bottleId = null;
      body.drinkName = state.drinkName.trim();
      body.drinkType = state.drinkType;
    }
  } else if (!state.bottleId) {
    if (state.drinkName.trim() !== initial.drinkName.trim()) {
      body.drinkName = state.drinkName.trim();
    }
    if (state.drinkType && state.drinkType !== initial.drinkType) {
      body.drinkType = state.drinkType;
    }
  }
  if (photoIds !== undefined) {
    body.photoIds = [...photoIds];
  }
  return Object.keys(body).length > 0 ? body : null;
}

export function isNoteFormDirty(state: NoteFormState, initial: NoteFormState): boolean {
  return (
    state.bottleId !== initial.bottleId ||
    state.drinkName !== initial.drinkName ||
    state.drinkType !== initial.drinkType ||
    state.vintage !== initial.vintage ||
    state.producer !== initial.producer ||
    state.origin !== initial.origin ||
    state.variety !== initial.variety ||
    state.tastedOn !== initial.tastedOn ||
    state.ratingX10 !== initial.ratingX10 ||
    state.appearance !== initial.appearance ||
    state.aroma !== initial.aroma ||
    state.taste !== initial.taste ||
    state.finish !== initial.finish
  );
}

export type NoteSaveFailure = {
  formMessage: string | null;
  fieldErrors: NoteFormErrors;
  dropPhoto: boolean;
  dropBottle: boolean;
};

const FIELD_KEYS: readonly NoteFormField[] = [
  "drinkName",
  "drinkType",
  "vintage",
  "producer",
  "origin",
  "variety",
  "tastedOn",
  "ratingX10",
  "appearance",
  "aroma",
  "taste",
  "finish",
  "photoIds",
  "bottleId",
];

function isFormField(key: string): key is NoteFormField {
  return (FIELD_KEYS as readonly string[]).includes(key);
}

export function describeNoteSaveFailure(
  error: unknown,
  online: boolean,
  context: { hasPhoto?: boolean; hasBottle?: boolean } = {},
): NoteSaveFailure {
  if (!online) {
    return {
      formMessage: NOTE_FORM_ERROR_MESSAGES.offline,
      fieldErrors: {},
      dropPhoto: false,
      dropBottle: false,
    };
  }
  if (isApiClientError(error)) {
    if (error.code === "not_found") {
      const hasPhoto = context.hasPhoto ?? false;
      const hasBottle = context.hasBottle ?? false;
      const fieldErrors: NoteFormErrors = {};
      if (hasPhoto) {
        fieldErrors.photoIds = TASTING_NOTE_MESSAGES.photoNotFound;
      }
      if (hasBottle) {
        fieldErrors.bottleId = TASTING_NOTE_MESSAGES.bottleNotFound;
      }
      return {
        formMessage:
          Object.keys(fieldErrors).length === 0 ? NOTE_FORM_ERROR_MESSAGES.generic : null,
        fieldErrors,
        dropPhoto: hasPhoto,
        dropBottle: hasBottle,
      };
    }
    if (error.code === "validation_error" && error.fields) {
      const fieldErrors: NoteFormErrors = {};
      let formMessage: string | null = null;
      for (const [key, messages] of Object.entries(error.fields)) {
        const message = messages[0];
        if (!message) {
          continue;
        }
        if (key === "" || !isFormField(key)) {
          formMessage = message;
        } else {
          fieldErrors[key] = message;
        }
      }
      return {
        formMessage:
          formMessage ??
          (Object.keys(fieldErrors).length === 0 ? NOTE_FORM_ERROR_MESSAGES.generic : null),
        fieldErrors,
        dropPhoto: false,
        dropBottle: false,
      };
    }
  }
  return {
    formMessage: NOTE_FORM_ERROR_MESSAGES.generic,
    fieldErrors: {},
    dropPhoto: false,
    dropBottle: false,
  };
}
