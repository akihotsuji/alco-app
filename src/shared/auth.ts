import { z } from "zod";

export const AUTH_PASSWORD_MIN_LENGTH = 8;
export const AUTH_PASSWORD_MAX_LENGTH = 128;
export const AUTH_NAME_MAX_LENGTH = 40;
export const AUTH_NAME_MESSAGE = `${AUTH_NAME_MAX_LENGTH}文字以内で入力してください`;

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
});

export type LoginForm = z.infer<typeof loginFormSchema>;
export type SignupForm = z.infer<typeof signupFormSchema>;

const AUTH_PAGE_PATHS = new Set(["/login", "/signup"]);

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
