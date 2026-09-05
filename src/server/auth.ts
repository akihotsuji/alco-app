import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as authSchema from "@/db/auth-schema.ts";
import { type AppDb, createD1Db } from "@/db/index.ts";
import type * as schema from "@/db/schema.ts";
import { AUTH_PASSWORD_MAX_LENGTH, AUTH_PASSWORD_MIN_LENGTH } from "@/shared/auth.ts";
import { readAuthSecret, resolveAuthBaseURL } from "./env.ts";

export type AuthDb = AppDb | LibSQLDatabase<typeof schema>;

export type CreateAuthOptions = {
  db: AuthDb;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  useSecureCookies: boolean;
};

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
    // 2-01 の Auth スキーマに rate_limit が無いため、ストレージはメモリ（標準）
    rateLimit: {
      enabled: true,
    },
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
