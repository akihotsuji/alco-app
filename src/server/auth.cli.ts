/**
 * Better Auth CLI（`pnpm dlx auth generate`）専用。
 * Workers の D1 は CLI から触れないため、ダミーの in-memory DB を渡す。
 * ランタイムは `createAuth`（auth.ts）を使う。
 */
import { createClient } from "@libsql/client";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { drizzle } from "drizzle-orm/libsql";

const dummyDb = drizzle(createClient({ url: ":memory:" }));

export const auth = betterAuth({
  database: drizzleAdapter(dummyDb, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false,
  },
  rateLimit: {
    enabled: true,
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
    },
  },
});
