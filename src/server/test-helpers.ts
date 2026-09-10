import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { z } from "zod";
import * as schema from "@/db/schema.ts";
import { WORKERS_AI_VISION_MODEL } from "@/shared/constants.ts";
import { LEGAL_VERSION } from "@/shared/legal.ts";
import { createAuth } from "./auth.ts";
import type { GoogleOAuthConfig } from "./env.ts";
import { createApp } from "./index.ts";
import { createMemoryR2 } from "./memory-r2.ts";
import type { LabelRecognizer } from "./services/label-recognizer/index.ts";
import type { ResetPasswordMail, SendResetPasswordEmail } from "./services/reset-password-mail.ts";
import type { VerifyTurnstile } from "./services/turnstile.ts";

const TEST_AUTH_SECRET = "test-only-not-a-production-secret!!";
const TEST_ORIGIN = "http://localhost";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../db/migrations");

function applyMigrationSql(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function applyDrizzleMigrations(client: ReturnType<typeof createClient>) {
  const journal = JSON.parse(readFileSync(join(migrationsDir, "meta/_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };

  // 0000_init は user より先に FK 付きテーブルを作る。libsql では適用中だけ FK を切る。
  await client.execute("PRAGMA foreign_keys = OFF;");
  for (const entry of journal.entries) {
    const migration = readFileSync(join(migrationsDir, `${entry.tag}.sql`), "utf8");
    for (const statement of applyMigrationSql(migration)) {
      await client.execute(statement);
    }
  }
  await client.execute("PRAGMA foreign_keys = ON;");
}

type TestApp = ReturnType<typeof createApp>;
type TestUserInput = {
  name: string;
  email: string;
  password: string;
};

const testUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  ageVerified: z.boolean(),
});

export type TestUser = z.infer<typeof testUserSchema> & {
  cookie: string;
};

/** 既存 API テスト用。JST 当日で確実に満 20 歳以上。 */
export const TEST_VERIFIED_BIRTH_ON = "1990-01-15";

// Better Auth のレート制限ストアはモジュール共有（メモリ）。テスト間で 429 を踏まないよう
// アプリごとに別クライアント IP を名乗る
const clientIpByApp = new WeakMap<TestApp, string>();
let appCount = 0;

export function createStubLabelRecognizer(
  recognize: LabelRecognizer["recognize"] = async () => ({
    name: { value: "サンプル赤", confidence: 0.86 },
  }),
): LabelRecognizer {
  return {
    provider: "workers-ai",
    profile: "workers-ai-llama",
    modelId: WORKERS_AI_VISION_MODEL,
    recognize,
  };
}

export async function createTestApp(
  options: {
    labelRecognizer?: LabelRecognizer;
    drinkRecognizer?: LabelRecognizer;
    noteRecognizer?: LabelRecognizer;
    recognizeTimeoutMs?: number;
    sendResetPassword?: SendResetPasswordEmail;
    google?: GoogleOAuthConfig;
    verifyTurnstile?: VerifyTurnstile;
    turnstileSiteKey?: string | null;
    photoDailyLimit?: number;
  } = {},
) {
  const client = createClient({ url: ":memory:" });
  await applyDrizzleMigrations(client);

  const db = drizzle(client, { schema });
  const mailbox: ResetPasswordMail[] = [];
  const auth = createAuth({
    db,
    secret: TEST_AUTH_SECRET,
    baseURL: TEST_ORIGIN,
    trustedOrigins: [TEST_ORIGIN],
    useSecureCookies: false,
    sendResetPassword:
      options.sendResetPassword ??
      (async (mail) => {
        mailbox.push(mail);
      }),
    google: options.google,
    verifyTurnstile: options.verifyTurnstile,
  });

  const photos = createMemoryR2();
  const app = createApp({
    auth,
    db,
    photos,
    labelRecognizer: options.labelRecognizer ?? createStubLabelRecognizer(),
    drinkRecognizer:
      options.drinkRecognizer ??
      createStubLabelRecognizer(async () => ({
        drinkType: { value: "beer", confidence: 0.8 },
        volumeMl: { value: 350, confidence: 0.7 },
      })),
    noteRecognizer:
      options.noteRecognizer ??
      createStubLabelRecognizer(async () => ({
        drinkName: { value: "サンプル赤", confidence: 0.84 },
        drinkType: { value: "wine", confidence: 0.8 },
        vintage: { value: 2020, confidence: 0.7 },
      })),
    recognizeTimeoutMs: options.recognizeTimeoutMs,
    turnstileSiteKey: options.turnstileSiteKey,
    photoDailyLimit: options.photoDailyLimit,
  });
  appCount += 1;
  clientIpByApp.set(app, `10.0.${Math.floor(appCount / 256)}.${appCount % 256}`);
  return { app, auth, db, photos, mailbox };
}

function authHeaders(app: TestApp): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Origin: TEST_ORIGIN,
    "cf-connecting-ip": clientIpByApp.get(app) ?? "10.0.0.0",
  };
}

export function cookieHeaderFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .filter((part): part is string => Boolean(part))
    .join("; ");
}

export async function signUpWithBody(
  app: TestApp,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { ...authHeaders(app), ...extraHeaders },
    body: JSON.stringify(body),
  });
}

export async function signUp(app: TestApp, input: TestUserInput) {
  return signUpWithBody(app, {
    ...input,
    acceptedLegal: true,
    legalVersion: LEGAL_VERSION,
  });
}

export async function signInSocial(app: TestApp, body: Record<string, unknown>, cookie?: string) {
  const headers: Record<string, string> = { ...authHeaders(app) };
  if (cookie) {
    headers.Cookie = cookie;
  }
  return app.request("/api/auth/sign-in/social", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function signIn(app: TestApp, input: { email: string; password: string }) {
  return app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: authHeaders(app),
    body: JSON.stringify(input),
  });
}

export async function requestPasswordReset(app: TestApp, email: string) {
  return app.request("/api/auth/request-password-reset", {
    method: "POST",
    headers: authHeaders(app),
    body: JSON.stringify({
      email,
      redirectTo: "/reset-password",
    }),
  });
}

export async function resetPassword(app: TestApp, input: { token: string; newPassword: string }) {
  return app.request("/api/auth/reset-password", {
    method: "POST",
    headers: authHeaders(app),
    body: JSON.stringify(input),
  });
}

export function resetTokenFromUrl(resetUrl: string): string {
  const token = new URL(resetUrl).pathname.split("/").filter(Boolean).at(-1);
  if (!token) {
    throw new Error("リセット URL からトークンを取れませんでした");
  }
  return token;
}

export async function updateUserName(app: TestApp, cookie: string | undefined, name: string) {
  const headers: Record<string, string> = { ...authHeaders(app) };
  if (cookie) {
    headers.Cookie = cookie;
  }
  return app.request("/api/auth/update-user", {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  });
}

export async function verifyTestUserAge(
  app: TestApp,
  cookie: string,
  birthOn = TEST_VERIFIED_BIRTH_ON,
): Promise<void> {
  const response = await app.request("/api/me/age-verification", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ birthOn }),
  });
  if (!response.ok) {
    throw new Error("テストユーザーの年齢確認に失敗しました");
  }
}

async function fetchTestUser(app: TestApp, cookie: string): Promise<TestUser> {
  const meResponse = await app.request("/api/me", {
    headers: { Cookie: cookie },
  });
  if (!meResponse.ok) {
    throw new Error("作成したテストユーザーを取得できませんでした");
  }
  return {
    ...testUserSchema.parse(await meResponse.json()),
    cookie,
  };
}

/** サインアップのみ。年齢未確認。機能 API の 403 テスト用。 */
export async function createUnverifiedTestUser(
  app: TestApp,
  input: TestUserInput,
): Promise<TestUser> {
  const signUpResponse = await signUp(app, input);
  if (!signUpResponse.ok) {
    throw new Error("テストユーザーの作成に失敗しました");
  }

  const cookie = cookieHeaderFrom(signUpResponse);
  if (!cookie) {
    throw new Error("テストユーザーのセッション Cookie を取得できませんでした");
  }

  return fetchTestUser(app, cookie);
}

/** 既存の API テスト向け。サインアップ後に年齢確認済みにする。 */
export async function createTestUser(app: TestApp, input: TestUserInput): Promise<TestUser> {
  const user = await createUnverifiedTestUser(app, input);
  await verifyTestUserAge(app, user.cookie);
  return fetchTestUser(app, user.cookie);
}

/** リソース API の IDOR テストで使う、別セッションの 2 ユーザーを順番に作成する。 */
export async function createTestUserPair(
  app: TestApp,
  inputs: readonly [TestUserInput, TestUserInput],
): Promise<[TestUser, TestUser]> {
  return [await createTestUser(app, inputs[0]), await createTestUser(app, inputs[1])];
}
