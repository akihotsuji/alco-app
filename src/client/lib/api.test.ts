import { describe, expect, expectTypeOf, it } from "vitest";
import { cookieHeaderFrom, createTestApp, signUp } from "@/server/test-helpers.ts";
import { ApiRequestError, createRpcClient, isUnauthorizedError, unwrap } from "./api.ts";

type TestApp = Awaited<ReturnType<typeof createTestApp>>["app"];

/** ブラウザの `fetch` の代わりに Hono アプリへ直接届ける。Cookie は呼び出し側が渡す。 */
function fetchVia(app: TestApp, cookie?: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookie) {
      headers.set("Cookie", cookie);
    }
    return app.request(input, { ...init, headers });
  };
}

async function signedUpCookie(app: TestApp) {
  const res = await signUp(app, {
    name: "太郎",
    email: "taro@example.com",
    password: "password-taro",
  });
  expect(res.status).toBe(200);
  return cookieHeaderFrom(res);
}

describe("createRpcClient", () => {
  it("同一オリジンの相対 URL に credentials: include で送る", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const client = createRpcClient(async (input, init) => {
      calls.push({ url: String(input), init });
      return Response.json({ ok: true });
    });

    await client.api.health.$get();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/health");
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.init?.credentials).toBe("include");
  });
});

describe("unwrap", () => {
  it("GET /api/me が型付きで取れる", async () => {
    const { app } = await createTestApp();
    const cookie = await signedUpCookie(app);
    const client = createRpcClient(fetchVia(app, cookie));

    const me = await unwrap(client.api.me.$get());

    expectTypeOf(me).toEqualTypeOf<{ id: string; email: string; name: string }>();
    expect(me).toEqual({
      id: expect.any(String),
      email: "taro@example.com",
      name: "太郎",
    });
  });

  it("未ログインの 401 を ApiRequestError(unauthorized) にする", async () => {
    const { app } = await createTestApp();
    const client = createRpcClient(fetchVia(app));

    const error = await unwrap(client.api.me.$get()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    if (!(error instanceof ApiRequestError)) {
      return;
    }
    expect(error.status).toBe(401);
    expect(error.code).toBe("unauthorized");
    expect(error.fields).toBeUndefined();
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("400 の fields を保持する", async () => {
    const client = createRpcClient(async () =>
      Response.json(
        { error: "validation_error", fields: { volumeMl: ["1 以上で入力してください"] } },
        { status: 400 },
      ),
    );

    const error = await unwrap(client.api.me.$get()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    if (!(error instanceof ApiRequestError)) {
      return;
    }
    expect(error.status).toBe(400);
    expect(error.code).toBe("validation_error");
    expect(error.fields).toEqual({ volumeMl: ["1 以上で入力してください"] });
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it("共通エラー形式でない本文は status から code を補う", async () => {
    const client = createRpcClient(
      async () =>
        new Response("<html>Bad Gateway</html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    );

    const error = await unwrap(client.api.me.$get()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    if (!(error instanceof ApiRequestError)) {
      return;
    }
    expect(error.status).toBe(502);
    expect(error.code).toBe("internal_error");
    expect(error.message).not.toContain("<html>");
  });

  it("本文の無い 401 も unauthorized として扱う", async () => {
    const client = createRpcClient(async () => new Response(null, { status: 401 }));

    const error = await unwrap(client.api.me.$get()).catch((e: unknown) => e);

    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("ネットワーク断（fetch の TypeError）はそのまま投げる", async () => {
    const client = createRpcClient(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(unwrap(client.api.me.$get())).rejects.toBeInstanceOf(TypeError);
  });
});
