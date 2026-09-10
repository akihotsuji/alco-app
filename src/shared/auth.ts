import { z } from "zod";
import { signupLegalAcceptanceSchema } from "./legal.ts";

export const AUTH_PASSWORD_MIN_LENGTH = 8;
export const AUTH_PASSWORD_MAX_LENGTH = 128;
export const AUTH_NAME_MAX_LENGTH = 40;
export const AUTH_NAME_MESSAGE = `${AUTH_NAME_MAX_LENGTH}文字以内で入力してください`;
export const RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS = 60 * 60;
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";

/** Better Auth `session.expiresIn`（秒）。確認時の延長は、その時点からこの秒数後へ書き換える。 */
export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;
/** Better Auth `session.updateAge`（秒）。前回更新からこの秒数以上経過した確認でのみ延長する。 */
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

const emailSchema = z.pipe(z.string().trim(), z.email());

/** 表示名（任意。空は未設定。1〜40。spec/screen-designs/06-settings.md S1） */
export const displayNameSchema = z.string().trim().max(AUTH_NAME_MAX_LENGTH);

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const signupFormSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: z.string().min(AUTH_PASSWORD_MIN_LENGTH).max(AUTH_PASSWORD_MAX_LENGTH),
  acceptedLegal: signupLegalAcceptanceSchema.shape.acceptedLegal,
});

export const forgotPasswordFormSchema = z.object({
  email: emailSchema,
});

export const resetPasswordFormSchema = z
  .object({
    password: z.string().min(AUTH_PASSWORD_MIN_LENGTH).max(AUTH_PASSWORD_MAX_LENGTH),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
  });

export type LoginForm = z.infer<typeof loginFormSchema>;
export type SignupForm = z.infer<typeof signupFormSchema>;
export type ForgotPasswordForm = z.infer<typeof forgotPasswordFormSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordFormSchema>;

const AUTH_PAGE_PATHS = new Set([
  "/login",
  "/signup",
  "/age",
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
]);

/** オープンリダイレクト対策。不正値は `/`。 */
export function resolveSafeRedirect(value: string | null | undefined): string {
  if (!value) {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/";
  }
  if (value.includes("\\")) {
    return "/";
  }
  const path = value.split(/[?#]/, 1)[0] ?? "/";
  if (AUTH_PAGE_PATHS.has(path)) {
    return "/";
  }
  return value;
}
