import { signupLegalAcceptanceSchema } from "./legal.ts";

export const GOOGLE_OAUTH_PROVIDER = "google";
export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/callback/google";
export const GOOGLE_AUTHORIZATION_HOST = "accounts.google.com";

export const OAUTH_ERROR_MESSAGE = "ログインできませんでした。時間をおいて再度お試しください";
export const OAUTH_SIGNUP_ERROR_MESSAGE = "登録できませんでした。入力内容を確認してください";
export const GOOGLE_CONTINUE_LABEL = "Google で続行";

/**
 * ログイン／サインアップの「Google で続行」導線を出すか。
 * Google 側の同意画面が未確認アプリの警告を出す間は隠す（サーバー側の設定・API は残す）。
 * spec/features/oauth-login.md 2 章。
 */
export const GOOGLE_SIGN_IN_VISIBLE = false;

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
