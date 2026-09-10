import { AGE_BIRTH_YEAR_MIN } from "@/shared/age.ts";
import { parseCalendarDate } from "@/shared/tokyo-date.ts";

/**
 * 年齢確認の生年月日は 年 / 月 / 日 の 3 欄に分けて数字キーボードで打つ
 * （`type=date` のカレンダーは今日から数十年戻す操作になり入れづらい。spec/screen-designs/01-auth.md A5）。
 */
export type BirthOnParts = {
  year: string;
  month: string;
  day: string;
};

export const EMPTY_BIRTH_ON_PARTS: BirthOnParts = { year: "", month: "", day: "" };

export const BIRTH_ON_PART_MAX_LENGTH: Record<keyof BirthOnParts, number> = {
  year: 4,
  month: 2,
  day: 2,
};

/** 全角数字を半角にし、数字以外を落として桁数で切る */
export function sanitizeBirthOnPart(part: keyof BirthOnParts, raw: string): string {
  return raw.normalize("NFKC").replace(/\D+/g, "").slice(0, BIRTH_ON_PART_MAX_LENGTH[part]);
}

/** 打ち終わったら次の欄へ移す（年は 4 桁、月・日は 2 桁、または 1 桁でも 4〜9 / 4〜9 なら確定） */
export function shouldAdvanceBirthOnPart(part: keyof BirthOnParts, value: string): boolean {
  if (value.length >= BIRTH_ON_PART_MAX_LENGTH[part]) {
    return true;
  }
  if (part === "month") {
    return value.length === 1 && Number(value) >= 2;
  }
  if (part === "day") {
    return value.length === 1 && Number(value) >= 4;
  }
  return false;
}

/**
 * 3 欄から `YYYY-MM-DD` を組む。欠け・実在しない日・1900 年より前・`today` より後は null。
 * 20 歳判定は含めない（サーバーが計算する）。
 */
export function composeBirthOn(parts: BirthOnParts, today: string): string | null {
  if (parts.year.length !== 4 || parts.month.length === 0 || parts.day.length === 0) {
    return null;
  }
  const candidate = `${parts.year}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`;
  const parsed = parseCalendarDate(candidate);
  if (!parsed || parsed.year < AGE_BIRTH_YEAR_MIN || candidate > today) {
    return null;
  }
  return candidate;
}

/** 全欄に何か入っているのに日付にならないとき（入力途中では出さない） */
export function birthOnPartsLookComplete(parts: BirthOnParts): boolean {
  return parts.year.length === 4 && parts.month.length > 0 && parts.day.length > 0;
}
