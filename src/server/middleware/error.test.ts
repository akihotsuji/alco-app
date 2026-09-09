import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import "@/shared/zod-config.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError } from "../errors.ts";
import { resetErrorAlertCooldownForTests } from "../services/error-alert.ts";
import { errorHandler, fieldsFromZodIssues, notFoundHandler } from "./error.ts";

const SECRET_MARKER = "super-secret-cookie-value";

function buildApp() {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.get("/api-error", () => {
    throw new ApiError("not_found");
  });
  app.get("/api-error-fields", () => {
    throw new ApiError("validation_error", { fields: { volumeMl: ["1以上で入力してください"] } });
  });
  app.get("/zod-error", () => {
    z.object({ volumeMl: z.number().int().min(1) }).parse({ volumeMl: 0 });
    return new Response("unreachable");
  });
  app.get("/http-413", () => {
    throw new HTTPException(413, { message: "Payload Too Large" });
  });
  app.get("/http-400", () => {
    throw new HTTPException(400, { message: "Malformed JSON in request body" });
  });
  app.get("/http-403", () => {
    throw new HTTPException(403, { message: "Forbidden" });
  });
  app.get("/boom", () => {
    throw new Error(
      `D1_ERROR: SELECT * FROM user WHERE token = '${SECRET_MARKER}' at /src/server/x.ts`,
    );
  });
  return app;
}

describe("errorHandler", () => {
  afterEach(() => {
    resetErrorAlertCooldownForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ApiError はコードとステータスをそのまま返す", async () => {
    const res = await buildApp().request("/api-error");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("ApiError の fields は 400 でそのまま返す", async () => {
    const res = await buildApp().request("/api-error-fields");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "validation_error",
      fields: { volumeMl: ["1以上で入力してください"] },
    });
  });

  it("ハンドラ内で投げられた ZodError は 400 validation_error（日本語メッセージ）", async () => {
    const res = await buildApp().request("/zod-error");
    expect(res.status).toBe(400);
    const body = apiErrorBodySchema.parse(await res.json());
    expect(body.error).toBe("validation_error");
    expect(Object.keys(body.fields ?? {})).toEqual(["volumeMl"]);
    expect(body.fields?.volumeMl?.[0]).toMatch(/[ぁ-んァ-ン一-龥]/);
  });

  it("HTTPException はステータスからコードへ寄せる", async () => {
    const res413 = await buildApp().request("/http-413");
    expect(res413.status).toBe(413);
    expect(await res413.json()).toEqual({ error: "payload_too_large" });

    const res400 = await buildApp().request("/http-400");
    expect(res400.status).toBe(400);
    const body = apiErrorBodySchema.parse(await res400.json());
    expect(body.error).toBe("validation_error");
    expect(body.fields?.[""]).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("Malformed JSON");
  });

  it("ApiError の年齢ゲートは 403 をそのまま返す", async () => {
    const app = new Hono<AppEnv>();
    app.onError(errorHandler);
    app.get("/age-required", () => {
      throw new ApiError("age_required");
    });
    app.get("/age-restricted", () => {
      throw new ApiError("age_restricted");
    });
    const required = await app.request("/age-required");
    expect(required.status).toBe(403);
    expect(await required.json()).toEqual({ error: "age_required" });
    const restricted = await app.request("/age-restricted");
    expect(restricted.status).toBe(403);
    expect(await restricted.json()).toEqual({ error: "age_restricted" });
  });

  it("対応表にないステータス（汎用 HTTP 403 等）は 500 internal_error にし、403 を出さない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await buildApp().request("/http-403");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });

  it("想定外の例外は 500 で汎用本文。メッセージ・スタック・パスを出さずログにだけ残す", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await buildApp().request("/boom?token=query-should-not-be-logged");
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "internal_error" });
    expect(text).not.toContain(SECRET_MARKER);
    expect(text).not.toContain("D1_ERROR");
    expect(text).not.toContain("/src/");
    expect(text).not.toContain("at ");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [prefix] = errorSpy.mock.calls[0] ?? [];
    expect(prefix).toBe("[api] unhandled error: GET /boom");
    expect(String(prefix)).not.toContain("query-should-not-be-logged");
  });

  it("想定外 500 だけウェブフックを送り、本文に秘密を載せない", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const env = { ALERT_WEBHOOK_URL: "https://alert.example/hook" };
    const boom = await buildApp().request("/boom?token=query-should-not-be-logged", {}, env);
    expect(boom.status).toBe(500);
    expect(await boom.json()).toEqual({ error: "internal_error" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const posted = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(posted).toEqual({
      source: "alco-app",
      worker: "alco-app-dev",
      kind: "unhandled_error",
      method: "GET",
      path: "/boom",
      errorName: "Error",
    });
    expect(JSON.stringify(posted)).not.toContain(SECRET_MARKER);
    expect(JSON.stringify(posted)).not.toContain("query-should-not-be-logged");

    fetchSpy.mockClear();
    const notFound = await buildApp().request("/api-error", {}, env);
    expect(notFound.status).toBe(404);
    const validation = await buildApp().request("/zod-error", {}, env);
    expect(validation.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('未定義ルートは { error: "not_found" }', async () => {
    const res = await buildApp().request("/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

describe("fieldsFromZodIssues", () => {
  it("ネストと配列の path は '.' 区切り、ルートは ''", () => {
    const result = z
      .object({
        photoIds: z.array(z.uuid()).max(1),
        log: z.object({ volumeMl: z.number().int() }),
      })
      .strict()
      .safeParse({ photoIds: ["x"], log: { volumeMl: 1.5 }, userId: "u" });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    const fields = fieldsFromZodIssues(result.error.issues);
    expect(Object.keys(fields).sort()).toEqual(["", "log.volumeMl", "photoIds.0"]);
    expect(fields[""]?.[0]).toContain("userId");
  });

  it("同じフィールドの複数エラーは配列にまとめる", () => {
    const result = z
      .object({
        name: z
          .string()
          .min(3)
          .regex(/^[a-z]+$/),
      })
      .safeParse({ name: "A1" });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    const fields = fieldsFromZodIssues(result.error.issues);
    expect(fields.name).toHaveLength(2);
  });
});
