import { describe, expect, expectTypeOf, it } from "vitest";
import { cookieHeaderFrom, createTestApp, signUp } from "@/server/test-helpers.ts";
import {
  ApiClientError,
  createApiClient,
  isUnauthorizedError,
  toApiClientError,
  unwrap,
} from "./api.ts";

/** ブラウザの fetch の代わりに Hono の `app.request` へ流す。URL は本番と同じ相対 `/api/...`。 */
async function createBoundClient() {
  const { app } = await createTestApp();
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const client = createApiClient({
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), init });
      return app.request(input, init);
    },
  });
  return { app, client, seen };
}

describe("createApiClient", () => {
  it("同一オリジンの相対パス /api/... を credentials: include で呼ぶ", async () => {
    const { client, seen } = await createBoundClient();
    const res = await client.api.health.$get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe("/api/health");
    expect(seen[0]?.init?.credentials).toBe("include");
    expect(seen[0]?.init?.method).toBe("GET");
  });

  it("$path も同一オリジン相対で解決する", () => {
    const client = createApiClient();
    expect(client.api.me.$path()).toBe("/api/me");
  });
});

describe("unwrap", () => {
  it("/api/me をサーバーと同じ型で受け取る", async () => {
    const { app, client } = await createBoundClient();
    const signUpRes = await signUp(app, {
      name: "ユーザーA",
      email: "a@example.com",
      password: "password1",
    });
    expect(signUpRes.status).toBe(200);

    const me = await unwrap(
      client.api.me.$get({}, { headers: { Cookie: cookieHeaderFrom(signUpRes) } }),
    );
    expectTypeOf(me).toEqualTypeOf<{ id: string; email: string; name: string }>();
    expect(me).toEqual({
      id: expect.any(String),
      email: "a@example.com",
      name: "ユーザーA",
    });
  });

  it("未認証の 401 は code=unauthorized の ApiClientError になる", async () => {
    const { client } = await createBoundClient();
    const error = await unwrap(client.api.me.$get()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    if (!(error instanceof ApiClientError)) {
      throw new Error("unreachable");
    }
    expect(error.status).toBe(401);
    expect(error.code).toBe("unauthorized");
    expect(error.fields).toBeUndefined();
    expect(isUnauthorizedError(error)).toBe(true);
  });
});

describe("toApiClientError", () => {
  it("共通エラー形式の fields を保持する", async () => {
    const error = await toApiClientError(
      new Response(JSON.stringify({ error: "validation_error", fields: { email: ["必須です"] } }), {
        status: 400,
      }),
    );
    expect(error.status).toBe(400);
    expect(error.code).toBe("validation_error");
    expect(error.fields).toEqual({ email: ["必須です"] });
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it("本文が共通エラー形式でない 401 でも unauthorized に寄せる", async () => {
    const error = await toApiClientError(
      new Response("<html>Unauthorized</html>", { status: 401 }),
    );
    expect(error.code).toBe("unauthorized");
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("本文が共通エラー形式でない 5xx は internal_error にする", async () => {
    const error = await toApiClientError(new Response("Bad Gateway", { status: 502 }));
    expect(error.status).toBe(502);
    expect(error.code).toBe("internal_error");
  });

  it("未知のコードは受け付けず internal_error にする（サーバー本文をそのまま信用しない）", async () => {
    const error = await toApiClientError(
      new Response(JSON.stringify({ error: "something_else" }), { status: 418 }),
    );
    expect(error.code).toBe("internal_error");
  });

  it("メッセージにサーバー本文を含めない", async () => {
    const error = await toApiClientError(
      new Response(JSON.stringify({ error: "internal_error", stack: "at /src/server" }), {
        status: 500,
      }),
    );
    expect(error.message).not.toContain("/src/server");
  });
});

describe("isUnauthorizedError", () => {
  it("ApiClientError 以外は false", () => {
    expect(isUnauthorizedError(new Error("unauthorized"))).toBe(false);
    expect(isUnauthorizedError(undefined)).toBe(false);
    expect(isUnauthorizedError({ code: "unauthorized" })).toBe(false);
  });
});
