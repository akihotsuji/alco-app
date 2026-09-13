import { z } from "zod";

export const FEEDBACK_CATEGORIES = ["improvement", "bug", "other"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  improvement: "改善案",
  bug: "不具合",
  other: "その他",
};

export const DEFAULT_FEEDBACK_CATEGORY: FeedbackCategory = "improvement";

export const FEEDBACK_BODY_MAX_LENGTH = 2000;
export const FEEDBACK_PHOTO_MAX = 3;
/** ユーザー / JST 日。UI / PP には数値を出さない */
export const FEEDBACK_DAILY_LIMIT = 3;

export const FEEDBACK_COPY = {
  title: "ご意見・ご要望",
  settingsRow: "ご意見・ご要望",
  categoryLabel: "種類",
  bodyLabel: "内容",
  bodyPlaceholder: "使いにくい点や欲しい機能",
  photosLabel: "画像",
  capture: "撮る",
  library: "選ぶ",
  note: "返信をお約束するものではありません。退会後も、どなたからのものか分からない形で改善の参考として残します。",
  submit: "送信する",
  submitting: "送信中",
  sent: "送りました",
  sendFailed: "送信できませんでした。もう一度試してください",
  rateLimited: "しばらく待ってから試してください",
  photoProcessing: "読み込み中",
  photoFailed: "画像を読み込めませんでした",
  removePhoto: "外す",
} as const;

export const feedbackCategorySchema = z.enum(FEEDBACK_CATEGORIES);

export const feedbackFieldsSchema = z
  .object({
    category: feedbackCategorySchema,
    body: z.string().trim().min(1).max(FEEDBACK_BODY_MAX_LENGTH),
  })
  .strict();

export type FeedbackFields = z.infer<typeof feedbackFieldsSchema>;

export const feedbackCreatedSchema = z.object({
  ok: z.literal(true),
});

export type FeedbackCreated = z.infer<typeof feedbackCreatedSchema>;
