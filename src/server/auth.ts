import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as authSchema from "@/db/auth-schema.ts";
import { type AppDb, createD1Db } from "@/db/index.ts";
import type * as schema from "@/db/schema.ts";
import { legalConsents } from "@/db/schema.ts";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  clipDisplayName,
  RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
  SESSION_COOKIE_CACHE_MAX_AGE_SECONDS,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  SIGNUPS_CLOSED_MESSAGE,
} from "@/shared/auth.ts";
import { LEGAL_VERSION, signupLegalAcceptanceSchema } from "@/shared/legal.ts";
import { googleSignupAdditionalDataSchema, readSocialSignInLegal } from "@/shared/oauth.ts";
import { isTurnstileProtectedAuthPath, TURNSTILE_TOKEN_HEADER } from "@/shared/turnstile.ts";
import {
  type GoogleOAuthConfig,
  readAuthSecret,
  readGoogleOAuthConfig,
  readSignupsClosed,
  readTurnstileConfig,
  resolveAuthBaseURL,
} from "./env.ts";
import {
  createResetPasswordMailer,
  type SendResetPasswordEmail,
} from "./services/reset-password-mail.ts";
import { createTurnstileVerifier, type VerifyTurnstile } from "./services/turnstile.ts";

export type AuthDb = AppDb | LibSQLDatabase<typeof schema>;

export type CreateAuthOptions = {
  db: AuthDb;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  useSecureCookies: boolean;
  sendResetPassword?: SendResetPasswordEmail;
  google?: GoogleOAuthConfig;
  verifyTurnstile?: VerifyTurnstile;
  signupsClosed?: boolean;
};

function readHookHeader(ctx: { headers?: Headers; request?: Request }, name: string): string {
  return ctx.headers?.get(name)?.trim() ?? ctx.request?.headers.get(name)?.trim() ?? "";
}

/** Better Auth 既定の sign-up/sign-in は 10 秒 3 回。E2E は同一 IP から連続登録するため HTTP だけ緩める。 */
export function authRateLimitConfig(useSecureCookies: boolean) {
  return {
    enabled: true as const,
    ...(useSecureCookies
      ? {}
      : {
          customRules: {
            "/sign-up/email": { window: 10, max: 100 },
            "/sign-in/email": { window: 10, max: 100 },
            "/request-password-reset": { window: 10, max: 100 },
            "/sign-in/social": { window: 10, max: 100 },
          },
        }),
  };
}

function googleSocialProviders(google: GoogleOAuthConfig | undefined) {
  if (!google) {
    return undefined;
  }
  return {
    google: {
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      disableImplicitSignUp: true,
      prompt: "select_account" as const,
      mapProfileToUser: (profile: { name?: string }) => ({
        name: clipDisplayName(profile.name),
        image: "",
      }),
    },
  };
}

export function createAuth(options: CreateAuthOptions) {
  const sendReset = options.sendResetPassword ?? (async () => {});
  return betterAuth({
    database: drizzleAdapter(options.db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: AUTH_PASSWORD_MIN_LENGTH,
      maxPasswordLength: AUTH_PASSWORD_MAX_LENGTH,
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendReset({ email: user.email, resetUrl: url });
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      disableSessionRefresh: false,
      // 保護 API は毎回 getSession する。D1 が遠いと session + user の 2 往復だけで数百 ms かかるため、
      // 短時間だけ署名付き Cookie（httpOnly）から復元する。DB セッションは維持し JWT には移行しない
      cookieCache: {
        enabled: false,
        maxAge: SESSION_COOKIE_CACHE_MAX_AGE_SECONDS,
        strategy: "compact",
      },
    },
    // 2-01 の Auth スキーマに rate_limit が無いため、ストレージはメモリ（標準）
    rateLimit: authRateLimitConfig(options.useSecureCookies),
    advanced: {
      useSecureCookies: options.useSecureCookies,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: options.useSecureCookies,
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      database: {
        generateId: "uuid",
      },
    },
    telemetry: {
      enabled: false,
    },
    socialProviders: googleSocialProviders(options.google),
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        requireLocalEmailVerified: true,
        trustedProviders: [],
        allowDifferentEmails: false,
      },
      encryptOAuthTokens: true,
    },
    user: {
      validateUserInfo: ({ user, source }) => {
        if (source.method !== "oauth" || source.oauth?.providerId !== "google") {
          return;
        }
        if (user.emailVerified === true) {
          return;
        }
        return { error: "email_not_verified" };
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (options.signupsClosed) {
          if (ctx.path === "/sign-up/email") {
            throw new APIError("BAD_REQUEST", { message: SIGNUPS_CLOSED_MESSAGE });
          }
          if (ctx.path === "/sign-in/social" && readSocialSignInLegal(ctx.body).requestSignUp) {
            throw new APIError("BAD_REQUEST", { message: SIGNUPS_CLOSED_MESSAGE });
          }
        }
        if (ctx.path === "/sign-up/email") {
          const parsed = signupLegalAcceptanceSchema.safeParse(ctx.body);
          if (!parsed.success) {
            throw new APIError("BAD_REQUEST", {
              message: "利用規約への同意が必要です",
            });
          }
        } else if (ctx.path === "/sign-in/social") {
          const social = readSocialSignInLegal(ctx.body);
          if (social.requestSignUp) {
            const parsed = googleSignupAdditionalDataSchema.safeParse(social.additionalData);
            if (!parsed.success) {
              throw new APIError("BAD_REQUEST", {
                message: "利用規約への同意が必要です",
              });
            }
          }
        }

        if (!options.verifyTurnstile || !isTurnstileProtectedAuthPath(ctx.path)) {
          return;
        }
        const ok = await options.verifyTurnstile({
          token: readHookHeader(ctx, TURNSTILE_TOKEN_HEADER),
          remoteIp: readHookHeader(ctx, "cf-connecting-ip") || undefined,
        });
        if (!ok) {
          throw new APIError("BAD_REQUEST", {
            message: "確認を完了してください",
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const now = new Date();
            await options.db.insert(legalConsents).values({
              id: crypto.randomUUID(),
              userId: user.id,
              documentVersion: LEGAL_VERSION,
              acceptedAt: now,
              createdAt: now,
              updatedAt: now,
            });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export function createAuthFromEnv(env: Env, requestUrl: string): Auth {
  const baseURL = resolveAuthBaseURL(env, requestUrl);
  const requestOrigin = new URL(requestUrl).origin;
  const trustedOrigins = Array.from(new Set([baseURL, requestOrigin]));
  const turnstile = readTurnstileConfig(env);
  return createAuth({
    db: createD1Db(env.DB),
    secret: readAuthSecret(env),
    baseURL,
    trustedOrigins,
    useSecureCookies: new URL(baseURL).protocol === "https:",
    sendResetPassword: createResetPasswordMailer(env),
    google: readGoogleOAuthConfig(env),
    verifyTurnstile: turnstile ? createTurnstileVerifier(turnstile.secret) : undefined,
    signupsClosed: readSignupsClosed(env),
  });
}
