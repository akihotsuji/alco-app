import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { z } from "zod";
import * as schema from "@/db/schema.ts";
import { createAuth } from "./auth.ts";
import { createApp } from "./index.ts";
import { createMemoryR2 } from "./memory-r2.ts";

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
});

export type TestUser = z.infer<typeof testUserSchema> & {
  cookie: string;
};

// Better Auth のレート制限ストアはモジュール共有（メモリ）。テスト間で 429 を踏まないよう
// アプリごとに別クライアント IP を名乗る
const clientIpByApp = new WeakMap<TestApp, string>();
let appCount = 0;

export async function createTestApp() {
  const client = createClient({ url: ":memory:" });
  await applyDrizzleMigrations(client);

  const db = drizzle(client, { schema });
  const auth = createAuth({
    db,
    secret: TEST_AUTH_SECRET,
    baseURL: TEST_ORIGIN,
    trustedOrigins: [TEST_ORIGIN],
    useSecureCookies: false,
  });

  const photos = createMemoryR2();
  const app = createApp({ auth, db, photos });
  appCount += 1;
  clientIpByApp.set(app, `10.0.${Math.floor(appCount / 256)}.${appCount % 256}`);
  return { app, auth, db, photos };
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

export async function signUp(app: TestApp, input: TestUserInput) {
  return app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: authHeaders(app),
    body: JSON.stringify(input),
  });
}

export async function signIn(app: TestApp, input: { email: string; password: string }) {
  return app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: authHeaders(app),
    body: JSON.stringify(input),
  });
}

export async function createTestUser(app: TestApp, input: TestUserInput): Promise<TestUser> {
  const signUpResponse = await signUp(app, input);
  if (!signUpResponse.ok) {
    throw new Error("テストユーザーの作成に失敗しました");
  }

  const cookie = cookieHeaderFrom(signUpResponse);
  if (!cookie) {
    throw new Error("テストユーザーのセッション Cookie を取得できませんでした");
  }

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

/** リソース API の IDOR テストで使う、別セッションの 2 ユーザーを順番に作成する。 */
export async function createTestUserPair(
  app: TestApp,
  inputs: readonly [TestUserInput, TestUserInput],
): Promise<[TestUser, TestUser]> {
  return [await createTestUser(app, inputs[0]), await createTestUser(app, inputs[1])];
}
