import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from "@/shared/feedback.ts";
import { SERVICE_NAME_JA } from "@/shared/prod-canonical.ts";
import { formatMonthDay, tokyoToday } from "@/shared/tokyo-date.ts";
import { EMAIL_FROM_KEY, RESEND_API_KEY_KEY, RESEND_API_URL } from "./reset-password-mail.ts";

export const FEEDBACK_TO_KEY = "FEEDBACK_TO";

export type FeedbackMailAttachment = {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
};

export type FeedbackMail = {
  category: FeedbackCategory;
  body: string;
  userId: string;
  userEmail: string;
  createdAt: Date;
  attachments: readonly FeedbackMailAttachment[];
};

export type SendFeedbackEmail = (mail: FeedbackMail) => Promise<void>;

function readOptionalString(env: object, key: string): string | undefined {
  const value = Reflect.get(env, key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** 1 アドレスだけ。改行やカンマ区切りは拒否する */
export function readFeedbackTo(env: object): string | undefined {
  const value = readOptionalString(env, FEEDBACK_TO_KEY);
  if (!value || value.length > 254 || /[\s,;]/.test(value)) {
    return undefined;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return undefined;
  }
  return value;
}

export function feedbackMailSubject(category: FeedbackCategory): string {
  return `【${SERVICE_NAME_JA}】ご意見（${FEEDBACK_CATEGORY_LABELS[category]}）`;
}

export function buildFeedbackEmailText(mail: FeedbackMail): string {
  const day = tokyoToday(mail.createdAt);
  return [
    `種類: ${FEEDBACK_CATEGORY_LABELS[mail.category]}`,
    `送信日: ${formatMonthDay(day)}`,
    `利用者ID: ${mail.userId}`,
    `メール: ${mail.userEmail}`,
    `添付: ${mail.attachments.length}枚`,
    "",
    mail.body,
  ].join("\n");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    const slice = bytes.subarray(offset, offset + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function createFeedbackMailer(
  env: object,
  fetchImpl: typeof fetch = fetch,
): SendFeedbackEmail {
  const apiKey = readOptionalString(env, RESEND_API_KEY_KEY);
  const from = readOptionalString(env, EMAIL_FROM_KEY);
  const to = readFeedbackTo(env);
  if (!apiKey || !from || !to) {
    return async () => {};
  }

  return async (mail) => {
    try {
      const response = await fetchImpl(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: mail.userEmail,
          subject: feedbackMailSubject(mail.category),
          text: buildFeedbackEmailText(mail),
          attachments: mail.attachments.map((attachment, index) => ({
            filename: `${index + 1}.${attachment.filename.split(".").pop() ?? "jpg"}`,
            content: bytesToBase64(attachment.bytes),
            content_type: attachment.contentType,
          })),
        }),
      });
      if (!response.ok) {
        console.error("feedback email send failed");
      }
    } catch {
      console.error("feedback email send failed");
    }
  };
}
