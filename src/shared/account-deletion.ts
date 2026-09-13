import { z } from "zod";
import { AUTH_PASSWORD_MAX_LENGTH } from "./auth.ts";

/** Google のみの本人確認。セッション `createdAt` からの経過。`updatedAt` は使わない。 */
export const ACCOUNT_DELETION_GOOGLE_SESSION_MAX_AGE_MS = 5 * 60 * 1000;
/** 本人確認試行と削除要求。ユーザーあたり。isolate メモリ。 */
export const ACCOUNT_DELETION_RATE_WINDOW_MS = 10 * 60 * 1000;
export const ACCOUNT_DELETION_RATE_MAX = 5;

export const PHOTO_RESERVATION_LEASE_MS = 2 * 60 * 1000;
export const ACCOUNT_DELETION_TASK_LEASE_MS = 60 * 1000;
export const ACCOUNT_DELETION_TASK_BATCH_SIZE = 50;
export const ACCOUNT_DELETION_LEDGER_PREFIX = "account-deletion-ledger/";
export const ACCOUNT_DELETION_CHANNEL = "alco-account-deletion";
export const ACCOUNT_DELETION_PENDING_USER_KEY = "account-deletion.pendingUserId";

export const PHOTO_TASK_STATUSES = ["pending", "leased", "succeeded"] as const;
export type PhotoTaskStatus = (typeof PHOTO_TASK_STATUSES)[number];

export const CREDENTIAL_PROVIDER_ID = "credential";
export const GOOGLE_ACCOUNT_PROVIDER_ID = "google";

export const accountDeletionBodySchema = z
  .object({
    confirmed: z.literal(true),
    password: z.string().min(1).max(AUTH_PASSWORD_MAX_LENGTH).optional(),
  })
  .strict();

export type AccountDeletionBody = z.infer<typeof accountDeletionBodySchema>;

export const accountDeletionAcceptedSchema = z.object({
  status: z.literal("accepted"),
});

export type AccountDeletionAccepted = z.infer<typeof accountDeletionAcceptedSchema>;

export const ACCOUNT_DELETION_COPY = {
  title: "アカウントを削除",
  body: "飲酒記録、セラーのボトル、テイスティングノート、マイドリンク、保存した写真、アカウント情報を削除します。設定から送ったご意見・ご要望の本文と添付画像は、どなたからのものか分からない形で残します。削除後は元に戻せません。Googleアカウント自体や、端末の写真アプリにある写真は削除されません。",
  note: "削除を受け付けると、このアカウントは利用できなくなります。保存データの削除は順次行います。バックアップ等の保管期間についてはプライバシーポリシーをご確認ください。",
  confirm: "データを復元できないことを確認しました",
  submit: "アカウントとデータを削除",
  submitting: "削除を受け付けています…",
  cancel: "キャンセル",
  googleReauth: "Googleで本人確認する",
  passwordLabel: "パスワード",
  wrongAccount: "別のアカウントでログインしたため、削除手続きを中止しました。",
  reauthRequired: "本人確認が必要です。パスワードを確認するか、Googleで再ログインしてください。",
  rateLimited: "しばらく待ってから試してください",
  disconnect: "通信が途切れたため、受付結果を確認できません",
  generic: "削除を受け付けできませんでした。時間をおいて再度お試しください",
  acceptedTitle: "アカウント削除を受け付けました",
  acceptedBody: "このアカウントは利用できません。保存した写真などの削除を進めています。",
  login: "ログインへ",
} as const;
