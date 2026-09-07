import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { aiUsage } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { AI_RECOGNIZE_DAILY_LIMIT, PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import { drinkRecognizeResponseSchema } from "@/shared/drink-recognize.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { makeHtml, makeJpeg, makePng } from "../image-fixtures.ts";
import {
  createStubLabelRecognizer,
  createTestApp,
  createTestUser,
  createTestUserPair,
} from "../test-helpers.ts";

type Ctx = Awaited<ReturnType<typeof createTestApp>>;

async function session(app: Ctx["app"], email: string) {
  const user = await createTestUser(app, {
    name: email.split("@")[0] ?? "user",
    email,
    password: "password1",
  });
  return { cookie: user.cookie, userId: user.id };
}

function postRecognize(
  app: Ctx["app"],
  cookie: string,
  bytes: Uint8Array,
  fileName = "drink.jpg",
  type = "image/jpeg",
) {
  const form = new FormData();
  form.set("file", new File([Uint8Array.from(bytes)], fileName, { type }));
  return app.request("/api/drink-logs/recognize", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
}

async function usageCount(ctx: Ctx, userId: string) {
  const rows = await ctx.db
    .select({ count: aiUsage.count })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.usedOn, tokyoToday())));
  return rows[0]?.count ?? 0;
}

describe("POST /api/drink-logs/recognize", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await postRecognize(app, "", makeJpeg(320, 400));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("JPEG を読み取り、検証済み fields と remainingToday を返す", async () => {
    const ctx = await createTestApp({
      drinkRecognizer: createStubLabelRecognizer(async () => ({
        drinkType: { value: "beer", confidence: 0.82 },
        volumeMl: { value: 350, confidence: 0.7 },
        abvPercent: { value: 5, confidence: 0.6 },
      })),
    });
    const a = await session(ctx.app, "a@example.com");
    const res = await postRecognize(ctx.app, a.cookie, makeJpeg(320, 400));
    expect(res.status).toBe(200);
    const body = drinkRecognizeResponseSchema.parse(await res.json());
    expect(body.provider).toBe("workers-ai");
    expect(body.remainingToday).toBe(AI_RECOGNIZE_DAILY_LIMIT - 1);
    expect(body.fields.drinkType?.value).toBe("beer");
    expect(body.fields.volumeMl?.value).toBe(350);
    expect(body.fields.abvPercent?.value).toBe(5);
    expect(await usageCount(ctx, a.userId)).toBe(1);
  });

  it("モデル出力が壊れていても 200 で空 fields。回数は加算する", async () => {
    const ctx = await createTestApp({
      drinkRecognizer: createStubLabelRecognizer(async () => "definitely not json"),
    });
    const a = await session(ctx.app, "a@example.com");
    const res = await postRecognize(ctx.app, a.cookie, makeJpeg(200, 250));
    expect(res.status).toBe(200);
    expect(drinkRecognizeResponseSchema.parse(await res.json()).fields).toEqual({});
    expect(await usageCount(ctx, a.userId)).toBe(1);
  });

  it("範囲外の欄は省く", async () => {
    const ctx = await createTestApp({
      drinkRecognizer: createStubLabelRecognizer(async () => ({
        drinkType: { value: "vodka", confidence: 0.9 },
        volumeMl: { value: 350, confidence: 0.8 },
      })),
    });
    const a = await session(ctx.app, "a@example.com");
    const res = await postRecognize(ctx.app, a.cookie, makeJpeg(200, 250));
    const body = drinkRecognizeResponseSchema.parse(await res.json());
    expect(body.fields).toEqual({ volumeMl: { value: 350, confidence: 0.8 } });
  });

  it("PNG は 415。回数は加算しない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const res = await postRecognize(ctx.app, a.cookie, makePng(200, 250), "x.png", "image/png");
    expect(res.status).toBe(415);
    expect(apiErrorBodySchema.parse(await res.json()).error).toBe("unsupported_media_type");
    expect(await usageCount(ctx, a.userId)).toBe(0);
  });

  it("日次 31 回目は 429。セラー読み取りと枠を共有する", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "a", email: "a@example.com", password: "password1" },
      { name: "b", email: "b@example.com", password: "password1" },
    ]);
    await ctx.db.insert(aiUsage).values({
      userId: a.id,
      usedOn: tokyoToday(),
      count: AI_RECOGNIZE_DAILY_LIMIT,
    });
    const limited = await postRecognize(ctx.app, a.cookie, makeJpeg(200, 250));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    expect(await usageCount(ctx, a.id)).toBe(AI_RECOGNIZE_DAILY_LIMIT);

    const other = await postRecognize(ctx.app, b.cookie, makeJpeg(200, 250));
    expect(other.status).toBe(200);
    expect(await usageCount(ctx, b.id)).toBe(1);
  });

  it("Workers AI 失敗は 502 で加算しない。本文にモデル名を出さない", async () => {
    const ctx = await createTestApp({
      drinkRecognizer: createStubLabelRecognizer(async () => {
        throw new Error("@cf/meta/llama-4-scout-17b-16e-instruct boom");
      }),
    });
    const a = await session(ctx.app, "a@example.com");
    const res = await postRecognize(ctx.app, a.cookie, makeJpeg(200, 250));
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).toBe(JSON.stringify({ error: "upstream_error" }));
    expect(text).not.toContain("llama");
    expect(text).not.toContain("boom");
    expect(await usageCount(ctx, a.userId)).toBe(0);
  });

  it("20ms でタイムアウトしたら 502。加算しない", async () => {
    const ctx = await createTestApp({
      recognizeTimeoutMs: 20,
      drinkRecognizer: createStubLabelRecognizer(() => new Promise(() => {})),
    });
    const a = await session(ctx.app, "a@example.com");
    const res = await postRecognize(ctx.app, a.cookie, makeJpeg(200, 250));
    expect(res.status).toBe(502);
    expect(await usageCount(ctx, a.userId)).toBe(0);
  });

  it("HTML は 415。1MB 超は 413。回数は加算しない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const html = await postRecognize(ctx.app, a.cookie, makeHtml(), "x.html", "text/html");
    expect(html.status).toBe(415);
    const large = await postRecognize(ctx.app, a.cookie, makeJpeg(10, 10, PHOTO_MAX_BYTES));
    expect(large.status).toBe(413);
    expect(await usageCount(ctx, a.userId)).toBe(0);
  });
});
