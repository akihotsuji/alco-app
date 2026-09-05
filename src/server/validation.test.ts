import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import "@/shared/zod-config.ts";
import type { AppEnv } from "./app-env.ts";
import { errorHandler } from "./middleware/error.ts";
import { validate } from "./validation.ts";

// spec/api-design.md 2.2: 入力スキーマに userId を置かない。送られてきたら strict で 400
const createSchema = z
  .object({
    drinkType: z.enum(["beer", "wine"]),
    volumeMl: z.number().int().min(1).max(5000),
    memo: z.string().max(500).nullable().optional(),
  })
  .strict();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function buildApp() {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);
  return app
    .post("/items", validate("json", createSchema), (c) => {
      const input = c.req.valid("json");
      return c.json({ received: input.volumeMl, type: input.drinkType }, 201);
    })
    .get("/items", validate("query", listQuerySchema), (c) => {
      const { limit } = c.req.valid("query");
      return c.json({ limit });
    });
}

function postJson(app: ReturnType<typeof buildApp>, body: string) {
  return app.request("/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("validate()", () => {
  it("正常な入力は型付きで取り出せる", async () => {
    const res = await postJson(buildApp(), JSON.stringify({ drinkType: "wine", volumeMl: 125 }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ received: 125, type: "wine" });
  });

  it("失敗は 400 validation_error。fields のキーは入力名、メッセージは日本語", async () => {
    const res = await postJson(
      buildApp(),
      JSON.stringify({ drinkType: "sake", volumeMl: 0, memo: 1 }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; fields: Record<string, string[]> };
    expect(body.error).toBe("validation_error");
    expect(Object.keys(body.fields).sort()).toEqual(["drinkType", "memo", "volumeMl"]);
    for (const messages of Object.values(body.fields)) {
      for (const message of messages) {
        expect(message).toMatch(/[ぁ-んァ-ン一-龥]/);
      }
    }
    const text = JSON.stringify(body);
    expect(text).not.toContain("/src/");
    expect(text).not.toContain("ZodError");
  });

  it("userId を送っても無視せず 400（IDOR 対策の入り口）", async () => {
    const res = await postJson(
      buildApp(),
      JSON.stringify({ drinkType: "wine", volumeMl: 125, userId: "someone-else" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; fields: Record<string, string[]> };
    expect(body.fields[""]?.[0]).toContain("userId");
  });

  it("壊れた JSON は 400 validation_error（Hono の文言をエコーしない）", async () => {
    const res = await postJson(buildApp(), "{ not json");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; fields: Record<string, string[]> };
    expect(body.error).toBe("validation_error");
    expect(body.fields[""]).toEqual(["リクエストの形式が正しくありません"]);
  });

  it("クエリは coerce と既定値が効き、範囲外は 400", async () => {
    const ok = await buildApp().request("/items?limit=10");
    expect(await ok.json()).toEqual({ limit: 10 });

    const defaulted = await buildApp().request("/items");
    expect(await defaulted.json()).toEqual({ limit: 50 });

    const tooLarge = await buildApp().request("/items?limit=101");
    expect(tooLarge.status).toBe(400);
    const body = (await tooLarge.json()) as { fields: Record<string, string[]> };
    expect(Object.keys(body.fields)).toEqual(["limit"]);
  });
});
