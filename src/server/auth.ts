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
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from "@/shared/auth.ts";
import { LEGAL_VERSION, signupLegalAcceptanceSchema } from "@/shared/legal.ts";
import { readAuthSecret, resolveAuthBaseURL } from "./env.ts";

export type AuthDb = AppDb | LibSQLDatabase<typeof schema>;

export type CreateAuthOptions = {
  db: AuthDb;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  useSecureCookies: boolean;
};

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
          },
        }),
  };
}

export function createAuth(options: CreateAuthOptions) {
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
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      disableSessionRefresh: false,
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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") {
          return;
        }
        const parsed = signupLegalAcceptanceSchema.safeParse(ctx.body);
        if (!parsed.success) {
          throw new APIError("BAD_REQUEST", {
            message: "利用規約への同意が必要です",
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            if (ctx?.path !== "/sign-up/email") {
              return;
            }
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
  return createAuth({
    db: createD1Db(env.DB),
    secret: readAuthSecret(env),
    baseURL,
    trustedOrigins,
    useSecureCookies: new URL(baseURL).protocol === "https:",
  });
}
