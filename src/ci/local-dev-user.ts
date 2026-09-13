import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUTH_PASSWORD_MIN_LENGTH } from "../shared/auth.ts";
import { LEGAL_VERSION } from "../shared/legal.ts";

export const LOCAL_DEV_USER_FILE = ".local-dev-user.json";
export const LOCAL_DEV_USER_EMAIL = "local.dev@example.com";
export const LOCAL_DEV_USER_NAME = "ローカル開発";
export const LOCAL_DEV_ORIGIN = "http://127.0.0.1:5173";
export const LOCAL_DEV_BIRTH_ON = "1990-01-15";

const HEALTH_PATH = "/api/health";
const SEED_BOTTLES = [
  { name: "ローカル赤", drinkType: "wine_red" as const },
  { name: "ローカル白", drinkType: "wine_white" as const },
] as const;

export type LocalDevUser = {
  email: string;
  password: string;
  name: string;
};

export function parseLocalDevUser(raw: string): LocalDevUser | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.email !== "string" ||
      typeof record.password !== "string" ||
      typeof record.name !== "string"
    ) {
      return null;
    }
    if (record.email.length === 0 || record.password.length < AUTH_PASSWORD_MIN_LENGTH) {
      return null;
    }
    return { email: record.email, password: record.password, name: record.name };
  } catch {
    return null;
  }
}

export function createLocalDevUser(): LocalDevUser {
  return {
    email: LOCAL_DEV_USER_EMAIL,
    password: `LocalDev-${randomBytes(16).toString("hex")}`,
    name: LOCAL_DEV_USER_NAME,
  };
}

export function readLocalDevUserFile(repoRoot: string): LocalDevUser | null {
  const filePath = path.join(repoRoot, LOCAL_DEV_USER_FILE);
  if (!existsSync(filePath)) {
    return null;
  }
  return parseLocalDevUser(readFileSync(filePath, "utf8"));
}

export function writeLocalDevUserFile(repoRoot: string, user: LocalDevUser): string {
  const filePath = path.join(repoRoot, LOCAL_DEV_USER_FILE);
  writeFileSync(filePath, `${JSON.stringify(user, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return filePath;
}

export function cookieHeaderFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .filter((part): part is string => Boolean(part))
    .join("; ");
}

async function jsonRequest(
  origin: string,
  pathName: string,
  init: {
    method?: string;
    cookie?: string;
    body?: unknown;
  } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    Origin: origin,
    Accept: "application/json",
  };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (init.cookie) {
    headers.Cookie = init.cookie;
  }
  return fetch(`${origin}${pathName}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export async function waitForHealth(
  origin: string,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 90;
  const delayMs = options.delayMs ?? 2000;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${origin}${HEALTH_PATH}`, {
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // 起動待ち
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      const message = body.message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }
  } catch {
    // 本文は必須ではない
  }
  return `HTTP ${response.status}`;
}

async function signIn(origin: string, user: LocalDevUser): Promise<string | null> {
  const response = await jsonRequest(origin, "/api/auth/sign-in/email", {
    method: "POST",
    body: { email: user.email, password: user.password },
  });
  if (!response.ok) {
    return null;
  }
  const cookie = cookieHeaderFrom(response);
  return cookie.length > 0 ? cookie : null;
}

async function signUp(origin: string, user: LocalDevUser): Promise<string> {
  const response = await jsonRequest(origin, "/api/auth/sign-up/email", {
    method: "POST",
    body: {
      name: user.name,
      email: user.email,
      password: user.password,
      acceptedLegal: true,
      legalVersion: LEGAL_VERSION,
    },
  });
  if (!response.ok) {
    throw new Error(
      `ローカル開発ユーザーの登録に失敗しました: ${await readErrorMessage(response)}`,
    );
  }
  const cookie = cookieHeaderFrom(response);
  if (!cookie) {
    throw new Error("ローカル開発ユーザーのセッション Cookie を取得できませんでした");
  }
  return cookie;
}

async function ensureAgeVerified(origin: string, cookie: string): Promise<void> {
  const me = await jsonRequest(origin, "/api/me", { cookie });
  if (!me.ok) {
    throw new Error("ローカル開発ユーザーの /api/me に失敗しました");
  }
  const body: unknown = await me.json();
  if (
    typeof body === "object" &&
    body !== null &&
    "ageVerified" in body &&
    body.ageVerified === true
  ) {
    return;
  }
  const verify = await jsonRequest(origin, "/api/me/age-verification", {
    method: "POST",
    cookie,
    body: { birthOn: LOCAL_DEV_BIRTH_ON },
  });
  if (!verify.ok) {
    throw new Error("ローカル開発ユーザーの年齢確認に失敗しました");
  }
}

async function seedBottles(origin: string, cookie: string): Promise<void> {
  const list = await jsonRequest(origin, "/api/bottles?view=cellar&limit=1", { cookie });
  if (list.ok) {
    const body: unknown = await list.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "items" in body &&
      Array.isArray(body.items) &&
      body.items.length > 0
    ) {
      return;
    }
  }
  for (const bottle of SEED_BOTTLES) {
    const created = await jsonRequest(origin, "/api/bottles", {
      method: "POST",
      cookie,
      body: { name: bottle.name, drinkType: bottle.drinkType, count: 1 },
    });
    if (!created.ok) {
      throw new Error("ローカル開発用ボトルの作成に失敗しました");
    }
  }
}

export async function ensureLocalDevUser(
  repoRoot: string,
  origin = LOCAL_DEV_ORIGIN,
): Promise<{ user: LocalDevUser; created: boolean }> {
  const stored = readLocalDevUserFile(repoRoot);
  const user = stored ?? createLocalDevUser();
  let cookie = stored ? await signIn(origin, user) : null;
  if (!cookie) {
    cookie = await signUp(origin, user);
  }
  await ensureAgeVerified(origin, cookie);
  await seedBottles(origin, cookie);
  writeLocalDevUserFile(repoRoot, user);
  return { user, created: stored === null };
}
