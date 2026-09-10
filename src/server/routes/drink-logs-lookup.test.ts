import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { aiUsage } from "@/db/schema.ts";
import { AI_RECOGNIZE_DAILY_LIMIT } from "@/shared/constants.ts";
import {
  drinkLookupResponseSchema,
  drinkRecognizeResponseSchema,
} from "@/shared/drink-recognize.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { makeJpeg } from "../image-fixtures.ts";
import { clearRecognitionCache } from "../services/ai-recognition/cache.ts";
import type { DrinkLookupRunner } from "../services/drink-recognizer/lookup-runner.ts";
import {
  createStubDrinkLookupRunner,
  createStubLabelRecognizer,
  createTestApp,
  createTestUser,
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

function postLookup(app: Ctx["app"], cookie: string, body: unknown) {
  return app.request("/api/drink-logs/recognize/lookup", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function usageCount(ctx: Ctx, userId: string) {
  const rows = await ctx.db
    .select({ count: aiUsage.count })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.usedOn, tokyoToday())));
  return rows[0]?.count ?? 0;
}

const validBody = {
  drinkName: "San Fereolo",
  producer: "San Fereolo",
  vintage: 2022,
  drinkType: "wine_red",
  appellation: "Dogliani",
};

const emptyUsage = {
  inputTokens: null,
  outputTokens: null,
  thinkingTokens: null,
  searchCount: null,
};

function matchedRunner(url = "https://example.com/sheet"): DrinkLookupRunner {
  return createStubDrinkLookupRunner(async () => ({
    payload: {
      matched: true,
      origin: { value: "Italy" },
      variety: { value: "Dolcetto" },
      sources: [{ url, title: "Tech sheet", supports: ["origin", "variety"] }],
    },
    sources: [{ url, title: "Tech sheet" }],
    usage: emptyUsage,
    searchUsed: true,
  }));
}

describe("POST /api/drink-logs/recognize（二段階の前半）", () => {
  it("検索対応プロファイルで品名・生産者があり国が無ければ lookupSuggested。候補国も返す", async () => {
    clearRecognitionCache();
    const ctx = await createTestApp({
      drinkRecognizer: {
        provider: "gemini",
        profile: "gemini-3.5-flash-lite",
        modelId: "google/gemini-3.5-flash-lite",
        recognize: async () => ({
          subject: "label",
          drinkName: { value: "San Fereolo", confidence: 0.9, evidence: "label" },
          producer: { value: "San Fereolo", confidence: 0.9, evidence: "label" },
          vintage: { value: 2022, confidence: 0.9, evidence: "label" },
          appellation: { value: "Somewhere Unknown" },
          origin: { value: "Italy", confidence: 0.6, evidence: "unverified_guess" },
          drinkType: { value: "wine_red", confidence: 0.8 },
        }),
      },
    });
    const a = await session(ctx.app, "a@example.com");
    const form = new FormData();
    form.set(
      "file",
      new File([Uint8Array.from(makeJpeg(320, 400))], "d.jpg", { type: "image/jpeg" }),
    );
    const res = await ctx.app.request("/api/drink-logs/recognize", {
      method: "POST",
      headers: { Cookie: a.cookie },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = drinkRecognizeResponseSchema.parse(await res.json());
    expect(body.fields.origin).toBeUndefined();
    expect(body.lookupSuggested).toBe(true);
    expect(body.searchUsed).toBe(false);
    expect(body.originCandidate).toEqual({ value: "イタリア", evidence: "unverified_guess" });
    expect(body.appellation).toBe("Somewhere Unknown");
    expect(await usageCount(ctx, a.userId)).toBe(1);
  });

  it("検索非対応の Llama では lookupSuggested にならない", async () => {
    clearRecognitionCache();
    const ctx = await createTestApp({
      drinkRecognizer: createStubLabelRecognizer(async () => ({
        drinkName: { value: "サンプル", confidence: 0.9 },
        producer: { value: "生産者", confidence: 0.9 },
      })),
    });
    const a = await session(ctx.app, "a@example.com");
    const form = new FormData();
    form.set(
      "file",
      new File([Uint8Array.from(makeJpeg(320, 400))], "d.jpg", { type: "image/jpeg" }),
    );
    const res = await ctx.app.request("/api/drink-logs/recognize", {
      method: "POST",
      headers: { Cookie: a.cookie },
      body: form,
    });
    const body = drinkRecognizeResponseSchema.parse(await res.json());
    expect(body.lookupSuggested).toBe(false);
    expect(body.originCandidate).toBeUndefined();
  });
});

describe("POST /api/drink-logs/recognize/lookup", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await postLookup(app, "", validBody);
    expect(res.status).toBe(401);
  });

  it("品名・生産者が無い、長すぎる、未知のキーは 400 で回数を消費しない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    expect((await postLookup(ctx.app, a.cookie, { drinkName: "x" })).status).toBe(400);
    expect(
      (await postLookup(ctx.app, a.cookie, { ...validBody, producer: "p".repeat(101) })).status,
    ).toBe(400);
    expect((await postLookup(ctx.app, a.cookie, { ...validBody, drinkType: "vodka" })).status).toBe(
      400,
    );
    expect((await postLookup(ctx.app, a.cookie, { ...validBody, userId: "x" })).status).toBe(400);
    expect(await usageCount(ctx, a.userId)).toBe(0);
  });

  it("出典付きで一致したら国を日本語名に正規化して返し、回数を 1 消費する", async () => {
    clearRecognitionCache();
    const ctx = await createTestApp({ drinkLookup: matchedRunner() });
    const a = await session(ctx.app, "a@example.com");
    const res = await postLookup(ctx.app, a.cookie, validBody);
    expect(res.status).toBe(200);
    const body = drinkLookupResponseSchema.parse(await res.json());
    expect(body.matched).toBe(true);
    expect(body.fields).toEqual({
      origin: { value: "イタリア", confidence: 0.8 },
      variety: { value: "Dolcetto", confidence: 0.8 },
    });
    expect(body.sources[0]?.url).toBe("https://example.com/sheet");
    expect(body.searchUsed).toBe(true);
    expect(body.remainingToday).toBe(AI_RECOGNIZE_DAILY_LIMIT - 1);
    expect(await usageCount(ctx, a.userId)).toBe(1);
  });

  it("grounding に無い URL や http の出典は採用せず matched=false", async () => {
    clearRecognitionCache();
    const ctx = await createTestApp({
      drinkLookup: createStubDrinkLookupRunner(async () => ({
        payload: {
          matched: true,
          origin: { value: "Italy" },
          sources: [{ url: "http://example.com/x", supports: ["origin"] }],
        },
        sources: [{ url: "https://example.com/other" }],
        usage: emptyUsage,
        searchUsed: true,
      })),
    });
    const a = await session(ctx.app, "a@example.com");
    const body = drinkLookupResponseSchema.parse(
      await (await postLookup(ctx.app, a.cookie, validBody)).json(),
    );
    expect(body.matched).toBe(false);
    expect(body.fields).toEqual({});
    expect(await usageCount(ctx, a.userId)).toBe(1);
  });

  it("検索非対応の設定では消費せず matched=false", async () => {
    const ctx = await createTestApp({
      drinkLookup: createStubDrinkLookupRunner(undefined, { supportsSearch: false }),
    });
    const a = await session(ctx.app, "a@example.com");
    const res = await postLookup(ctx.app, a.cookie, validBody);
    expect(res.status).toBe(200);
    const body = drinkLookupResponseSchema.parse(await res.json());
    expect(body.matched).toBe(false);
    expect(body.searchUsed).toBe(false);
    expect(await usageCount(ctx, a.userId)).toBe(0);
  });

  it("日次上限に達していれば 429", async () => {
    const ctx = await createTestApp({ drinkLookup: matchedRunner() });
    const a = await session(ctx.app, "a@example.com");
    await ctx.db.insert(aiUsage).values({
      userId: a.userId,
      usedOn: tokyoToday(),
      count: AI_RECOGNIZE_DAILY_LIMIT,
    });
    const res = await postLookup(ctx.app, a.cookie, validBody);
    expect(res.status).toBe(429);
    expect(await usageCount(ctx, a.userId)).toBe(AI_RECOGNIZE_DAILY_LIMIT);
  });

  it("上流失敗は 502 で返金し、本文にモデル名を出さない", async () => {
    clearRecognitionCache();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const ctx = await createTestApp({
        drinkLookup: createStubDrinkLookupRunner(async () => {
          throw Object.assign(new Error("gemini-3.5-flash-lite boom"), { status: 502 });
        }),
      });
      const a = await session(ctx.app, "a@example.com");
      const res = await postLookup(ctx.app, a.cookie, validBody);
      expect(res.status).toBe(502);
      const text = await res.text();
      expect(text).toBe(JSON.stringify({ error: "upstream_error" }));
      expect(text).not.toContain("boom");
      expect(await usageCount(ctx, a.userId)).toBe(0);
      const line = info.mock.calls
        .map((args) => String(args[0]))
        .find((entry) => entry.includes("[drink-lookup]"));
      expect(line).toContain("ok=false");
    } finally {
      info.mockRestore();
    }
  });

  it("時間予算を超えたら 502 で返金する", async () => {
    clearRecognitionCache();
    const ctx = await createTestApp({
      lookupTimeoutMs: 20,
      drinkLookup: createStubDrinkLookupRunner(() => new Promise(() => {})),
    });
    const a = await session(ctx.app, "a@example.com");
    const res = await postLookup(ctx.app, a.cookie, { ...validBody, drinkName: "timeout" });
    expect(res.status).toBe(502);
    expect(await usageCount(ctx, a.userId)).toBe(0);
  });

  it("未設定のモデルは 503 で消費しない", async () => {
    const ctx = await createTestApp({
      drinkLookup: {
        provider: "gemini",
        profile: "",
        modelId: "",
        supportsSearch: true,
        timeoutMs: 1000,
        lookup: async () => {
          throw new Error("should not run");
        },
      },
    });
    const a = await session(ctx.app, "a@example.com");
    const res = await postLookup(ctx.app, a.cookie, validBody);
    expect(res.status).toBe(503);
    expect(await usageCount(ctx, a.userId)).toBe(0);
  });

  it("同じ入力は利用者ごとにキャッシュし、別の利用者には混ぜない", async () => {
    clearRecognitionCache();
    let calls = 0;
    const runner = createStubDrinkLookupRunner(async () => {
      calls += 1;
      return {
        payload: {
          matched: true,
          origin: { value: "Italy" },
          sources: [{ url: "https://example.com/s", supports: ["origin"] }],
        },
        sources: [{ url: "https://example.com/s" }],
        usage: emptyUsage,
        searchUsed: true,
      };
    });
    const ctx = await createTestApp({ drinkLookup: runner });
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const body = { ...validBody, drinkName: "cache-check" };
    await postLookup(ctx.app, a.cookie, body);
    await postLookup(ctx.app, a.cookie, body);
    expect(calls).toBe(1);
    await postLookup(ctx.app, b.cookie, body);
    expect(calls).toBe(2);
  });
});
