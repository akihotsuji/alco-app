import { isApiClientError } from "@/client/lib/api.ts";
import { FORM_ERROR_MESSAGES, type PhotoSaveStatus } from "@/client/lib/log-form.ts";
import { capturedAtToCalendarDate } from "@/client/lib/photo/captured-at.ts";
import {
  BOTTLE_COUNT_MAX,
  BOTTLE_COUNT_MIN,
  BOTTLE_FIELD_LABELS,
  BOTTLE_MEMO_MAX_LENGTH,
  BOTTLE_MESSAGES,
  BOTTLE_NAME_MAX_LENGTH,
  BOTTLE_TEXT_MAX_LENGTH,
  type Bottle,
  bottleMemoSchema,
  bottleNameSchema,
  bottleTextSchema,
  type CreateBottleInput,
  DEFAULT_BOTTLE_STORAGE,
  isPurchasedOnAllowed,
  isStoredOnAllowed,
  normalizeOptionalText,
  priceJpySchema,
  type UpdateBottleInput,
  vintageSchema,
} from "@/shared/bottles.ts";
import type { DrinkType } from "@/shared/constants.ts";
import { originInputError } from "@/shared/identity.ts";
import { formatLongJapaneseDate, parseCalendarDate, tokyoToday } from "@/shared/tokyo-date.ts";

export const DEFAULT_BOTTLE_DRINK_TYPE: DrinkType = "wine_red";

export type BottleFormState = {
  name: string;
  drinkType: DrinkType;
  count: number;
  producer: string;
  origin: string;
  variety: string;
  vintage: string;
  purchasedOn: string;
  priceJpy: string;
  shop: string;
  storedOn: string;
  storage: string;
  memo: string;
};

export type BottleFormField =
  | "name"
  | "drinkType"
  | "count"
  | "producer"
  | "origin"
  | "variety"
  | "vintage"
  | "purchasedOn"
  | "priceJpy"
  | "shop"
  | "storedOn"
  | "storage"
  | "memo"
  | "photoIds";

export const BOTTLE_DETAILS_ERROR_FIELDS = [
  "storedOn",
  "storage",
  "purchasedOn",
  "priceJpy",
  "shop",
  "memo",
] as const satisfies readonly BottleFormField[];

export type BottleFormErrors = Partial<Record<BottleFormField, string>>;

export const BOTTLE_SAVE_LABELS = {
  arrange: (count: number) => `棚に並べる（${count} 本）`,
  save: "保存する",
} as const;

export function createEmptyBottleForm(now: Date = new Date()): BottleFormState {
  return {
    name: "",
    drinkType: DEFAULT_BOTTLE_DRINK_TYPE,
    count: 1,
    producer: "",
    origin: "",
    variety: "",
    vintage: "",
    purchasedOn: "",
    priceJpy: "",
    shop: "",
    storedOn: tokyoToday(now),
    storage: DEFAULT_BOTTLE_STORAGE,
    memo: "",
  };
}

export const INITIAL_BOTTLE_FORM: BottleFormState = createEmptyBottleForm();

export function bottleFormStateFromBottle(bottle: Bottle): BottleFormState {
  return {
    name: bottle.name,
    drinkType: bottle.drinkType,
    count: 1,
    producer: bottle.producer ?? "",
    origin: bottle.origin ?? "",
    variety: bottle.variety ?? "",
    vintage: bottle.vintage === null ? "" : String(bottle.vintage),
    purchasedOn: bottle.purchasedOn ?? "",
    priceJpy: bottle.priceJpy === null ? "" : String(bottle.priceJpy),
    shop: bottle.shop ?? "",
    storedOn: bottle.storedOn ?? "",
    storage: bottle.storage ?? "",
    memo: bottle.memo ?? "",
  };
}

function optionalTextError(value: string, max: number, message: string): string | undefined {
  if (value.length > max) {
    return message;
  }
  return undefined;
}

export function validateBottleForm(
  state: BottleFormState,
  now: Date = new Date(),
  options: { existingOrigin?: string } = {},
): BottleFormErrors {
  const errors: BottleFormErrors = {};
  if (!bottleNameSchema.safeParse(state.name).success) {
    errors.name = BOTTLE_MESSAGES.name;
  }
  if (state.count < BOTTLE_COUNT_MIN || state.count > BOTTLE_COUNT_MAX) {
    errors.count = BOTTLE_MESSAGES.count;
  }
  if (optionalTextError(state.producer, BOTTLE_TEXT_MAX_LENGTH, BOTTLE_MESSAGES.text)) {
    errors.producer = BOTTLE_MESSAGES.text;
  } else if (!bottleTextSchema.safeParse(state.producer).success) {
    errors.producer = BOTTLE_MESSAGES.text;
  }
  if (!bottleTextSchema.safeParse(state.origin).success) {
    errors.origin = BOTTLE_MESSAGES.text;
  } else {
    const originError = originInputError(state.origin, options.existingOrigin);
    if (originError) {
      errors.origin = originError;
    }
  }
  if (!bottleTextSchema.safeParse(state.variety).success) {
    errors.variety = BOTTLE_MESSAGES.text;
  }
  if (!bottleTextSchema.safeParse(state.shop).success) {
    errors.shop = BOTTLE_MESSAGES.text;
  }
  if (!bottleTextSchema.safeParse(state.storage).success) {
    errors.storage = BOTTLE_MESSAGES.text;
  }
  if (!bottleMemoSchema.safeParse(state.memo).success) {
    errors.memo = BOTTLE_MESSAGES.memo;
  }
  const vintage = state.vintage.trim();
  if (vintage.length > 0) {
    const parsed = Number(vintage);
    if (!vintageSchema.safeParse(parsed).success) {
      errors.vintage = BOTTLE_MESSAGES.vintage;
    }
  }
  const purchasedOn = state.purchasedOn.trim();
  if (purchasedOn.length > 0) {
    if (parseCalendarDate(purchasedOn) === null) {
      errors.purchasedOn = BOTTLE_MESSAGES.purchasedOn;
    } else if (!isPurchasedOnAllowed(purchasedOn, now)) {
      errors.purchasedOn = BOTTLE_MESSAGES.purchasedOnFuture;
    }
  }
  const storedOn = state.storedOn.trim();
  if (storedOn.length > 0) {
    if (parseCalendarDate(storedOn) === null) {
      errors.storedOn = BOTTLE_MESSAGES.storedOn;
    } else if (!isStoredOnAllowed(storedOn, now)) {
      errors.storedOn = BOTTLE_MESSAGES.storedOnFuture;
    }
  }
  const price = state.priceJpy.trim();
  if (price.length > 0) {
    const parsed = Number(price);
    if (!priceJpySchema.safeParse(parsed).success) {
      errors.priceJpy = BOTTLE_MESSAGES.priceJpy;
    }
  }
  return errors;
}

export function canSubmitBottleForm(
  state: BottleFormState,
  errors: BottleFormErrors,
  photo: PhotoSaveStatus,
): boolean {
  if (state.name.trim().length === 0 || state.name.trim().length > BOTTLE_NAME_MAX_LENGTH) {
    return false;
  }
  if (Object.keys(errors).length > 0) {
    return false;
  }
  return photo === "none" || photo === "ready";
}

export function hasBottleDetails(state: BottleFormState): boolean {
  const storage = state.storage.trim();
  return (
    state.purchasedOn.trim().length > 0 ||
    state.priceJpy.trim().length > 0 ||
    state.shop.trim().length > 0 ||
    (storage.length > 0 && storage !== DEFAULT_BOTTLE_STORAGE) ||
    state.memo.trim().length > 0
  );
}

export function firstBottleDetailsErrorField(
  errors: BottleFormErrors,
): (typeof BOTTLE_DETAILS_ERROR_FIELDS)[number] | undefined {
  return BOTTLE_DETAILS_ERROR_FIELDS.find((field) => errors[field]);
}

export function resolveCreateStoredOn(
  state: BottleFormState,
  storedOnTouched: boolean,
  now: Date = new Date(),
  capturedAt?: string | null,
): string | null {
  if (!storedOnTouched) {
    return capturedAt ? capturedAtToCalendarDate(capturedAt, now) : tokyoToday(now);
  }
  return state.storedOn.trim() || null;
}

function optionalFields(state: BottleFormState): {
  producer: string | null;
  origin: string | null;
  variety: string | null;
  vintage: number | null;
  purchasedOn: string | null;
  priceJpy: number | null;
  shop: string | null;
  storedOn: string | null;
  storage: string | null;
  memo: string | null;
} {
  const vintage = state.vintage.trim();
  const price = state.priceJpy.trim();
  return {
    producer: normalizeOptionalText(state.producer),
    origin: normalizeOptionalText(state.origin),
    variety: normalizeOptionalText(state.variety),
    vintage: vintage.length === 0 ? null : Number(vintage),
    purchasedOn: state.purchasedOn.trim() || null,
    priceJpy: price.length === 0 ? null : Number(price),
    shop: normalizeOptionalText(state.shop),
    storedOn: state.storedOn.trim() || null,
    storage: normalizeOptionalText(state.storage),
    memo: normalizeOptionalText(state.memo),
  };
}

/** `photoIds` は常に [表面, 裏面?]。表面が無ければ裏面も送らない（裏面だけの登録はできない） */
export function bottlePhotoIds(frontPhotoId: string | null, backPhotoId?: string | null): string[] {
  if (!frontPhotoId) {
    return [];
  }
  return backPhotoId ? [frontPhotoId, backPhotoId] : [frontPhotoId];
}

export function toCreateBottleBody(
  state: BottleFormState,
  photoId: string | null,
  options: {
    now?: Date;
    storedOnTouched?: boolean;
    capturedAt?: string | null;
    backPhotoId?: string | null;
  } = {},
): CreateBottleInput | null {
  const now = options.now ?? new Date();
  const storedOnTouched = options.storedOnTouched ?? false;
  const resolved = {
    ...state,
    storedOn: resolveCreateStoredOn(state, storedOnTouched, now, options.capturedAt) ?? "",
  };
  if (
    !canSubmitBottleForm(resolved, validateBottleForm(resolved, now), photoId ? "ready" : "none")
  ) {
    return null;
  }
  const body: CreateBottleInput = {
    name: resolved.name.trim(),
    drinkType: resolved.drinkType,
    count: resolved.count,
    ...optionalFields(resolved),
  };
  if (photoId) {
    body.photoIds = bottlePhotoIds(photoId, options.backPhotoId);
  }
  return body;
}

/**
 * `photoIds` は写真構成が変わったときだけ、[表面, 裏面?] の全体で送る（`null` = 変更なし）。
 */
export function toUpdateBottleBody(
  state: BottleFormState,
  initial: BottleFormState,
  photoIds: readonly string[] | null,
): UpdateBottleInput | null {
  const next = optionalFields(state);
  const prev = optionalFields(initial);
  const body: UpdateBottleInput = {};
  if (state.name.trim() !== initial.name.trim()) {
    body.name = state.name.trim();
  }
  if (state.drinkType !== initial.drinkType) {
    body.drinkType = state.drinkType;
  }
  if (next.producer !== prev.producer) {
    body.producer = next.producer;
  }
  if (next.origin !== prev.origin) {
    body.origin = next.origin;
  }
  if (next.variety !== prev.variety) {
    body.variety = next.variety;
  }
  if (next.vintage !== prev.vintage) {
    body.vintage = next.vintage;
  }
  if (next.purchasedOn !== prev.purchasedOn) {
    body.purchasedOn = next.purchasedOn;
  }
  if (next.priceJpy !== prev.priceJpy) {
    body.priceJpy = next.priceJpy;
  }
  if (next.shop !== prev.shop) {
    body.shop = next.shop;
  }
  if (next.storedOn !== prev.storedOn) {
    body.storedOn = next.storedOn;
  }
  if (next.storage !== prev.storage) {
    body.storage = next.storage;
  }
  if (next.memo !== prev.memo) {
    body.memo = next.memo;
  }
  if (photoIds) {
    body.photoIds = [...photoIds];
  }
  return Object.keys(body).length > 0 ? body : null;
}

export function isBottleFormDirty(
  state: BottleFormState,
  initial: BottleFormState,
  includeCount: boolean,
): boolean {
  if (state.name.trim() !== initial.name.trim()) {
    return true;
  }
  if (state.drinkType !== initial.drinkType) {
    return true;
  }
  if (includeCount && state.count !== initial.count) {
    return true;
  }
  return (
    state.producer !== initial.producer ||
    state.origin !== initial.origin ||
    state.variety !== initial.variety ||
    state.vintage !== initial.vintage ||
    state.purchasedOn !== initial.purchasedOn ||
    state.priceJpy !== initial.priceJpy ||
    state.shop !== initial.shop ||
    state.storedOn !== initial.storedOn ||
    state.storage !== initial.storage ||
    state.memo !== initial.memo
  );
}

export type BottleSaveFailure = {
  formMessage: string | null;
  fieldErrors: BottleFormErrors;
  dropPhoto: boolean;
};

const FIELD_KEYS: readonly BottleFormField[] = [
  "name",
  "drinkType",
  "count",
  "producer",
  "origin",
  "variety",
  "vintage",
  "purchasedOn",
  "priceJpy",
  "shop",
  "storedOn",
  "storage",
  "memo",
  "photoIds",
];

function isFormField(key: string): key is BottleFormField {
  return (FIELD_KEYS as readonly string[]).includes(key);
}

export function describeBottleSaveFailure(error: unknown, online: boolean): BottleSaveFailure {
  if (!online) {
    return { formMessage: FORM_ERROR_MESSAGES.offline, fieldErrors: {}, dropPhoto: false };
  }
  if (isApiClientError(error)) {
    if (error.code === "not_found") {
      return {
        formMessage: null,
        fieldErrors: { photoIds: BOTTLE_MESSAGES.photoNotFound },
        dropPhoto: true,
      };
    }
    if (error.code === "validation_error" && error.fields) {
      const fieldErrors: BottleFormErrors = {};
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

export function formatPriceJpy(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

/** 未入力は null。既存データは NV と未入力を区別できないため推測しない。 */
export function vintageLabel(value: number | null): string | null {
  return value === null ? null : String(value);
}

const STACKED_BOTTLE_PROP_LABELS = new Set([
  BOTTLE_FIELD_LABELS.name,
  "生産者",
  "購入場所",
  BOTTLE_FIELD_LABELS.storage,
]);

export type BottlePropLayout = "inline" | "stack" | "memo";

export function bottlePropLayout(label: string): BottlePropLayout {
  if (label === "メモ") {
    return "memo";
  }
  if (STACKED_BOTTLE_PROP_LABELS.has(label)) {
    return "stack";
  }
  return "inline";
}

export function formatBottleDisplayDate(value: string): string {
  return formatLongJapaneseDate(value);
}

export function bottleStatusPill(input: { status: Bottle["status"]; consumedOn: string | null }): {
  label: string;
  consumed: boolean;
} {
  if (input.status === "consumed" && input.consumedOn) {
    return {
      label: `開栓（${formatBottleDisplayDate(input.consumedOn)}）`,
      consumed: true,
    };
  }
  return { label: "未開栓", consumed: false };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export const BOTTLE_MEMO_LIMIT = BOTTLE_MEMO_MAX_LENGTH;
