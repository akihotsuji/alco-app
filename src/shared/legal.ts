import { z } from "zod";

/** 規約・PP の現行版。サインアップ同意と公開ページが同じ値を使う。 */
export const LEGAL_VERSION = "2026-09-10";
export const LEGAL_EFFECTIVE_ON = "2026-09-10";
export const LEGAL_DRAFT_NOTICE = "一般公開準備の草案です。法的な確定は運営者の承認後です。";

export const LEGAL_VERSION_MAX_LENGTH = 32;

export const LEGAL_FROM_VALUES = ["signup", "login", "settings"] as const;
export type LegalFrom = (typeof LEGAL_FROM_VALUES)[number];

export const legalFromSchema = z.enum(LEGAL_FROM_VALUES);

export const signupLegalAcceptanceSchema = z.object({
  acceptedLegal: z.literal(true),
  legalVersion: z.literal(LEGAL_VERSION),
});

export type SignupLegalAcceptance = z.infer<typeof signupLegalAcceptanceSchema>;

const LEGAL_FROM_FALLBACK: Record<LegalFrom, string> = {
  signup: "/signup",
  login: "/login",
  settings: "/settings",
};

/** 法務ページの戻り先。不正・無しはサインアップ。 */
export function legalBackFallback(from: string | null | undefined): string {
  const parsed = legalFromSchema.safeParse(from);
  if (!parsed.success) {
    return "/signup";
  }
  return LEGAL_FROM_FALLBACK[parsed.data];
}

export function legalHref(path: "/terms" | "/privacy", from: LegalFrom | null | undefined): string {
  if (!from) {
    return path;
  }
  return `${path}?from=${from}`;
}

export function parseLegalFromSearch(search: string): string | null {
  return new URLSearchParams(search).get("from");
}

/** `YYYY-MM-DD` を「2026年9月9日」にする。不正値はそのまま返す。 */
export function formatLegalEffectiveOn(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return isoDate;
  }
  const [, year, month, day] = match;
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}
