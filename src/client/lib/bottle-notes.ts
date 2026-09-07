import { formatRatingX10 } from "@/shared/tasting-notes.ts";

/** T6 行。モックどおり日付 + 評価 */
export function bottleNoteRowText(tastedOn: string, ratingX10: number): string {
  return `${tastedOn}  ★${formatRatingX10(ratingX10)}`;
}

export function bottleNotesAllLabel(totalCount: number): string {
  return `すべて（${totalCount}）`;
}
