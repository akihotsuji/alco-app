import { z } from "zod";
import { ORIGIN_MESSAGES, resolveWritableOrigin } from "./origin-countries.ts";

/**
 * 記録・ノート・セラーで共通の識別項目。
 * 正本: spec/features/register-identity.md
 */

export const IDENTITY_TEXT_MAX_LENGTH = 100;
export const VINTAGE_MIN = 1800;
export const VINTAGE_MAX = 2100;

export const IDENTITY_MESSAGES = {
  text: `${IDENTITY_TEXT_MAX_LENGTH}文字以内で入力してください`,
  vintage: `${VINTAGE_MIN}以上${VINTAGE_MAX}以下のヴィンテージを入力してください`,
} as const;

export const IDENTITY_FIELD_LABELS = {
  drinkName: "品名",
  name: "品名",
  variety: "品種",
  vintage: "ヴィンテージ",
  origin: "生産国",
  producer: "生産者",
} as const;

/** 前後空白を除いて空なら null */
export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export const identityTextSchema = z
  .string({ error: IDENTITY_MESSAGES.text })
  .max(IDENTITY_TEXT_MAX_LENGTH, { error: IDENTITY_MESSAGES.text });

export const vintageSchema = z
  .number({ error: IDENTITY_MESSAGES.vintage })
  .int({ error: IDENTITY_MESSAGES.vintage })
  .min(VINTAGE_MIN, { error: IDENTITY_MESSAGES.vintage })
  .max(VINTAGE_MAX, { error: IDENTITY_MESSAGES.vintage });

export const optionalIdentityText = identityTextSchema.nullable().optional();
export const optionalVintage = vintageSchema.nullable().optional();

export type IdentitySnapshot = {
  producer: string | null;
  origin: string | null;
  variety: string | null;
  vintage: number | null;
};

export function emptyIdentity(): IdentitySnapshot {
  return { producer: null, origin: null, variety: null, vintage: null };
}

/** 手入力の生産国エラー。既存不正値を変えていなければ通す */
export function originInputError(
  raw: string,
  current?: string | null,
): string | undefined {
  const resolved = resolveWritableOrigin(raw.length === 0 ? null : raw, current);
  return resolved.status === "invalid" ? ORIGIN_MESSAGES.invalid : undefined;
}

/** ボディにあれば採用、省略時はボトル（または null） */
export function resolveIdentityFields(
  body: {
    producer?: string | null;
    origin?: string | null;
    variety?: string | null;
    vintage?: number | null;
  },
  fallback: IdentitySnapshot | null,
): IdentitySnapshot {
  const base = fallback ?? emptyIdentity();
  return {
    producer: body.producer !== undefined ? normalizeOptionalText(body.producer) : base.producer,
    origin: body.origin !== undefined ? normalizeOptionalText(body.origin) : base.origin,
    variety: body.variety !== undefined ? normalizeOptionalText(body.variety) : base.variety,
    vintage: body.vintage !== undefined ? body.vintage : base.vintage,
  };
}
