import { isApiClientError } from "@/client/lib/api.ts";
import { FORM_ERROR_MESSAGES, type PhotoSaveStatus } from "@/client/lib/log-form.ts";
import {
  BOTTLE_COUNT_MAX,
  BOTTLE_COUNT_MIN,
  BOTTLE_MEMO_MAX_LENGTH,
  BOTTLE_MESSAGES,
  BOTTLE_NAME_MAX_LENGTH,
  BOTTLE_TEXT_MAX_LENGTH,
  BOTTLE_VINTAGE_MAX,
  BOTTLE_VINTAGE_MIN,
  type Bottle,
  type CreateBottleInput,
  type UpdateBottleInput,
  bottleMemoSchema,
  bottleNameSchema,
  bottleTextSchema,
  isPurchasedOnAllowed,
  normalizeOptionalText,
  priceJpySchema,
  vintageSchema,
} from "@/shared/bottles.ts";
import type { DrinkType } from "@/shared/constants.ts";
import { parseCalendarDate } from "@/shared/tokyo-date.ts";

export const DEFAULT_BOTTLE_DRINK_TYPE: DrinkType = "wine";

export type BottleFormState = {
  name: string;
  drinkType: DrinkType;
  count: number;
  producer: string;
  origin: string;
  vintage: string;
  purchasedOn: string;
  priceJpy: string;
  shop: string;
  storage: string;
  memo: string;
};

export type BottleFormField =
  | "name"
  | "drinkType"
  | "count"
  | "producer"
  | "origin"
  | "vintage"
  | "purchasedOn"
  | "priceJpy"
  | "shop"
  | "storage"
  | "memo"
  | "photoIds";

export type BottleFormErrors = Partial<Record<BottleFormField, string>>;

export const BOTTLE_SAVE_LABELS = {
  arrange: (count: number) => `棚に並べる（${count} 本）`,
  save: "保存する",
} as const;

export const INITIAL_BOTTLE_FORM: BottleFormState = {
  name: "",
  drinkType: DEFAULT_BOTTLE_DRINK_TYPE,
  count: 1,
  producer: "",
  origin: "",
  vintage: "",
  purchasedOn: "",
  priceJpy: "",
  shop: "",
  storage: "",
  memo: "",
};

export function bottleFormStateFromBottle(bottle: Bottle): BottleFormState {
  return {
    name: bottle.name,
    drinkType: bottle.drinkType,
    count: 1,
    producer: bottle.producer ?? "",
    origin: bottle.origin ?? "",
    vintage: bottle.vintage === null ? "" : String(bottle.vintage),
    purchasedOn: bottle.purchasedOn ?? "",
    priceJpy: bottle.priceJpy === null ? "" : String(bottle.priceJpy),
    shop: bottle.shop ?? "",
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

export function validateBottleForm(state: BottleFormState, now: Date = new Date()): BottleFormErrors {
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
  return (
    state.producer.trim().length > 0 ||
    state.origin.trim().length > 0 ||
    state.vintage.trim().length > 0 ||
    state.purchasedOn.trim().length > 0 ||
    state.priceJpy.trim().length > 0 ||
    state.shop.trim().length > 0 ||
    state.storage.trim().length > 0 ||
    state.memo.trim().length > 0
  );
}

function optionalFields(state: BottleFormState): {
  producer: string | null;
  origin: string | null;
  vintage: number | null;
  purchasedOn: string | null;
  priceJpy: number | null;
  shop: string | null;
  storage: string | null;
  memo: string | null;
} {
  const vintage = state.vintage.trim();
  const price = state.priceJpy.trim();
  return {
    producer: normalizeOptionalText(state.producer),
    origin: normalizeOptionalText(state.origin),
    vintage: vintage.length === 0 ? null : Number(vintage),
    purchasedOn: state.purchasedOn.trim() || null,
    priceJpy: price.length === 0 ? null : Number(price),
    shop: normalizeOptionalText(state.shop),
    storage: normalizeOptionalText(state.storage),
    memo: normalizeOptionalText(state.memo),
  };
}

export function toCreateBottleBody(
  state: BottleFormState,
  photoId: string | null,
): CreateBottleInput | null {
  if (!canSubmitBottleForm(state, validateBottleForm(state), photoId ? "ready" : "none")) {
    return null;
  }
  const body: CreateBottleInput = {
    name: state.name.trim(),
    drinkType: state.drinkType,
    count: state.count,
    ...optionalFields(state),
  };
  if (photoId) {
    body.photoIds = [photoId];
  }
  return body;
}

export function toUpdateBottleBody(
  state: BottleFormState,
  initial: BottleFormState,
  replacementPhotoId: string | null,
  clearPhoto: boolean,
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
  if (next.storage !== prev.storage) {
    body.storage = next.storage;
  }
  if (next.memo !== prev.memo) {
    body.memo = next.memo;
  }
  if (replacementPhotoId) {
    body.photoIds = [replacementPhotoId];
  } else if (clearPhoto) {
    body.photoIds = [];
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
    state.vintage !== initial.vintage ||
    state.purchasedOn !== initial.purchasedOn ||
    state.priceJpy !== initial.priceJpy ||
    state.shop !== initial.shop ||
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
  "vintage",
  "purchasedOn",
  "priceJpy",
  "shop",
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

export function vintageLabel(value: number | null): string {
  return value === null ? "NV" : String(value);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export const BOTTLE_MEMO_LIMIT = BOTTLE_MEMO_MAX_LENGTH;
