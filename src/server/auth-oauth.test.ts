import { afterEach, describe, expect, it, vi } from "vitest";
import { account, legalConsents, user } from "@/db/schema.ts";
import { LEGAL_VERSION } from "@/shared/legal.ts";
import { GOOGLE_AUTHORIZATION_HOST, GOOGLE_OAUTH_CALLBACK_PATH } from "@/shared/oauth.ts";
import { cookieHeaderFrom, createTestApp, signIn, signInSocial, signUp } from "./test-helpers.ts";

const TEST_GOOGLE_CLIENT_ID = "test-google-client.apps.googleusercontent.com";
const TEST_GOOGLE_CLIENT_SECRET = "test-google-client-secret";
const TEST_ORIGIN = "http://localhost";

function unsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function googleIdToken(overrides: Record<string, unknown> = {}) {
  return unsignedJwt({
    iss: "https://accounts.google.com",
    aud: TEST_GOOGLE_CLIENT_ID,
    sub: "google-sub-1",
    email: "guser@example.com",
    email_verified: true,
    name: "Google User",
    picture: "https://lh3.googleusercontent.com/photo",
    ...overrides,
  });
}

function stubGoogleTokenEndpoint(idToken: string) {
  const originalFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({
          token_type: "Bearer",
          access_token: "ya29.test-access",
          id_token: idToken,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return originalFetch(input, init);
  });
}

async function startGoogleOAuth(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  body: Record<string, unknown>,
) {
  const response = await signInSocial(app, {
    provider: "google",
    callbackURL: "/",
    newUserCallbackURL: "/age",
    errorCallbackURL: "/login",
    disableRedirect: true,
    ...body,
  });
  return response;
}

async function completeGoogleCallback(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  startResponse: Response,
) {
  expect(startResponse.status).toBe(200);
  const payload = (await startResponse.json()) as { url?: string };
  expect(payload.url).toBeTypeOf("string");
  const authorization = new URL(payload.url ?? "");
  const state = authorization.searchParams.get("state");
  expect(state).toBeTruthy();
  return app.request(
    `${GOOGLE_OAUTH_CALLBACK_PATH}?code=test-code&state=${encodeURIComponent(state ?? "")}`,
    {
      redirect: "manual",
      headers: {
        Origin: TEST_ORIGIN,
        Cookie: cookieHeaderFrom(startResponse),
      },
    },
  );
}

describe("Google OAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requestSignUp は同意なし・旧版で 400。ユーザーを作らない", async () => {
    const { app, db } = await createTestApp({
      google: { clientId: TEST_GOOGLE_CLIENT_ID, clientSecret: TEST_GOOGLE_CLIENT_SECRET },
    });
    const missing = await startGoogleOAuth(app, { requestSignUp: true });
    expect(missing.status).toBe(400);
    const stale = await startGoogleOAuth(app, {
      requestSignUp: true,
      additionalData: { acceptedLegal: true, legalVersion: "2010-01-01" },
    });
    expect(stale.status).toBe(400);
    expect(await db.select({ email: user.email }).from(user)).toEqual([]);
  });

  it("設定ありなら認可 URL に PKCE と callback 完全一致がある", async () => {
    const { app } = await createTestApp({
      google: { clientId: TEST_GOOGLE_CLIENT_ID, clientSecret: TEST_GOOGLE_CLIENT_SECRET },
    });
    const response = await startGoogleOAuth(app, {
      requestSignUp: true,
      additionalData: { acceptedLegal: true, legalVersion: LEGAL_VERSION },
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { url?: string };
    const authorization = new URL(payload.url ?? "");
    expect(authorization.hostname).toBe(GOOGLE_AUTHORIZATION_HOST);
    expect(authorization.searchParams.get("client_id")).toBe(TEST_GOOGLE_CLIENT_ID);
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      `${TEST_ORIGIN}${GOOGLE_OAUTH_CALLBACK_PATH}`,
    );
    expect(authorization.searchParams.get("code_challenge")).toBeTruthy();
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("state")).toBeTruthy();
    expect(authorization.searchParams.get("prompt")).toBe("select_account");
  });

  it("モック callback で新規 Google ユーザーが同意済み・画像なし・年齢未確認になる", async () => {
    stubGoogleTokenEndpoint(googleIdToken());
    const { app, db } = await createTestApp({
      google: { clientId: TEST_GOOGLE_CLIENT_ID, clientSecret: TEST_GOOGLE_CLIENT_SECRET },
    });
    const start = await startGoogleOAuth(app, {
      requestSignUp: true,
      additionalData: { acceptedLegal: true, legalVersion: LEGAL_VERSION },
    });
    const callback = await completeGoogleCallback(app, start);
    expect(callback.status).toBeGreaterThanOrEqual(300);
    expect(callback.status).toBeLessThan(400);
    expect(callback.headers.get("location") ?? "").toMatch(/\/age/);

    const cookie = cookieHeaderFrom(callback);
    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(200);
    const me = (await meRes.json()) as {
      id: string;
      email: string;
      name: string;
      ageVerified: boolean;
      image?: unknown;
    };
    expect(me).toMatchObject({
      email: "guser@example.com",
      name: "Google User",
      ageVerified: false,
    });
    expect(me).not.toHaveProperty("image");

    const rows = await db.select().from(user);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.image).toBe("");
    const consents = await db.select().from(legalConsents);
    expect(consents).toHaveLength(1);
    expect(consents[0]?.userId).toBe(me.id);
    expect(consents[0]?.documentVersion).toBe(LEGAL_VERSION);

    const drink = await app.request("/api/drink-logs", { headers: { Cookie: cookie } });
    expect(drink.status).toBe(403);
    expect(await drink.json()).toEqual({ error: "age_required" });
  });

  it("同じメールのパスワードユーザーへはリンクしない", async () => {
    stubGoogleTokenEndpoint(googleIdToken({ email: "same@example.com" }));
    const { app, db } = await createTestApp({
      google: { clientId: TEST_GOOGLE_CLIENT_ID, clientSecret: TEST_GOOGLE_CLIENT_SECRET },
    });
    const signUpRes = await signUp(app, {
      name: "既存",
      email: "same@example.com",
      password: "password1",
    });
    expect(signUpRes.status).toBe(200);
    const start = await startGoogleOAuth(app, {
      requestSignUp: true,
      additionalData: { acceptedLegal: true, legalVersion: LEGAL_VERSION },
    });
    const callback = await completeGoogleCallback(app, start);
    const location = callback.headers.get("location") ?? "";
    expect(location).toMatch(/error=/);

    const users = await db.select({ email: user.email }).from(user);
    expect(users).toEqual([{ email: "same@example.com" }]);
    const accounts = await db.select({ providerId: account.providerId }).from(account);
    expect(accounts.every((row) => row.providerId !== "google")).toBe(true);

    const passwordLogin = await signIn(app, {
      email: "same@example.com",
      password: "password1",
    });
    expect(passwordLogin.status).toBe(200);
  });

  it("requestSignUp なしの新規はユーザーを作らない", async () => {
    stubGoogleTokenEndpoint(googleIdToken({ email: "new-login@example.com", sub: "google-sub-2" }));
    const { app, db } = await createTestApp({
      google: { clientId: TEST_GOOGLE_CLIENT_ID, clientSecret: TEST_GOOGLE_CLIENT_SECRET },
    });
    const start = await startGoogleOAuth(app, {});
    const callback = await completeGoogleCallback(app, start);
    expect(callback.headers.get("location") ?? "").toMatch(/error=/);
    expect(await db.select({ email: user.email }).from(user)).toEqual([]);
  });

  it("未検証の Google メールは拒否する", async () => {
    stubGoogleTokenEndpoint(
      googleIdToken({
        email: "unverified@example.com",
        email_verified: false,
        sub: "google-sub-3",
      }),
    );
    const { app, db } = await createTestApp({
      google: { clientId: TEST_GOOGLE_CLIENT_ID, clientSecret: TEST_GOOGLE_CLIENT_SECRET },
    });
    const start = await startGoogleOAuth(app, {
      requestSignUp: true,
      additionalData: { acceptedLegal: true, legalVersion: LEGAL_VERSION },
    });
    const callback = await completeGoogleCallback(app, start);
    expect(callback.headers.get("location") ?? "").toMatch(/error=/);
    expect(await db.select({ email: user.email }).from(user)).toEqual([]);
  });

  it("自前の token 交換を持たない", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
    expect(source).toContain("socialProviders");
    expect(source).not.toContain("oauth2.googleapis.com/token");
    expect(source).not.toContain("accounts.google.com/o/oauth2");
  });
});
