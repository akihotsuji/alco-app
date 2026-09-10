import { RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS } from "@/shared/auth.ts";
import { SERVICE_NAME_JA } from "@/shared/prod-canonical.ts";

export const RESEND_API_KEY_KEY = "RESEND_API_KEY";
export const EMAIL_FROM_KEY = "EMAIL_FROM";
export const RESEND_API_URL = "https://api.resend.com/emails";
export const RESET_PASSWORD_EMAIL_SUBJECT = "パスワードの再設定";

export type ResetPasswordMail = {
  email: string;
  resetUrl: string;
};

export type SendResetPasswordEmail = (mail: ResetPasswordMail) => Promise<void>;

function readOptionalString(env: object, key: string): string | undefined {
  const value = Reflect.get(env, key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function isSafeResetUrl(resetUrl: string): boolean {
  try {
    const parsed = new URL(resetUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function buildResetPasswordEmailText(resetUrl: string): string {
  const hours = RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS / 3600;
  const expiry = hours === 1 ? "1時間" : `${hours}時間`;
  return [
    `${SERVICE_NAME_JA}のパスワード再設定の手続きです。`,
    `次のリンクから、${expiry}以内に新しいパスワードを設定してください。`,
    "",
    resetUrl,
    "",
    "このメールに心当たりがない場合は、無視してください。",
    "リンクを他人に教えないでください。",
  ].join("\n");
}

export function createResetPasswordMailer(
  env: object,
  fetchImpl: typeof fetch = fetch,
): SendResetPasswordEmail {
  const apiKey = readOptionalString(env, RESEND_API_KEY_KEY);
  const from = readOptionalString(env, EMAIL_FROM_KEY);
  if (!apiKey || !from) {
    return async () => {};
  }

  return async (mail) => {
    if (!isSafeResetUrl(mail.resetUrl)) {
      console.error("reset email send failed");
      return;
    }
    try {
      const response = await fetchImpl(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [mail.email],
          subject: RESET_PASSWORD_EMAIL_SUBJECT,
          text: buildResetPasswordEmailText(mail.resetUrl),
        }),
      });
      if (!response.ok) {
        console.error("reset email send failed");
      }
    } catch {
      console.error("reset email send failed");
    }
  };
}
