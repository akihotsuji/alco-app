import { z } from "zod";

export const AUTH_PASSWORD_MIN_LENGTH = 8;
export const AUTH_PASSWORD_MAX_LENGTH = 128;
export const AUTH_NAME_MAX_LENGTH = 40;

const emailSchema = z.pipe(z.string().trim(), z.email());

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const signupFormSchema = z.object({
  name: z.string().trim().max(AUTH_NAME_MAX_LENGTH),
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
