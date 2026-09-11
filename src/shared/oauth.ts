import { signupLegalAcceptanceSchema } from "./legal.ts";

export const GOOGLE_OAUTH_PROVIDER = "google";
export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/callback/google";
export const GOOGLE_AUTHORIZATION_HOST = "accounts.google.com";

export const OAUTH_ERROR_MESSAGE = "ログインできませんでした。時間をおいて再度お試しください";
export const OAUTH_SIGNUP_ERROR_MESSAGE = "登録できませんでした。入力内容を確認してください";
export const GOOGLE_LOGIN_LABEL = "Googleアカウントでログインする";
export const GOOGLE_SIGNUP_LABEL = "Googleアカウントで登録する";

export function googleSignInLabel(mode: "login" | "signup"): string {
  return mode === "signup" ? GOOGLE_SIGNUP_LABEL : GOOGLE_LOGIN_LABEL;
}

/**
 * ログイン／サインアップの Google 導線を出すか。
 * 同意画面の警告が出ている間は `false`。警告が消えたら `true`（2026-09-11 復活）。
 * spec/features/oauth-login.md 2 章。
 */
export const GOOGLE_SIGN_IN_VISIBLE = true;

export const googleSignupAdditionalDataSchema = signupLegalAcceptanceSchema;

export type SocialSignInLegalInput = {
  requestSignUp: boolean;
  additionalData: unknown;
};

/** Better Auth が未知キーを落とすため、同意は `additionalData` に載せる。 */
export function readSocialSignInLegal(body: unknown): SocialSignInLegalInput {
  if (!body || typeof body !== "object") {
    return { requestSignUp: false, additionalData: undefined };
  }
  const record = body as Record<string, unknown>;
  return {
    requestSignUp: record.requestSignUp === true,
    additionalData: record.additionalData,
  };
}

export function isGoogleOAuthUserCreatePath(path: string | undefined): boolean {
  return path === "/callback/google" || path === "/sign-in/social";
}
