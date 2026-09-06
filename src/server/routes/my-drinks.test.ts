import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { drinkLogs, myDrinks } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { DRUNK_AT_FUTURE_TOLERANCE_MS, drinkLogSchema } from "@/shared/drink-logs.ts";
import {
  MY_DRINK_MAX_COUNT,
  MY_DRINK_MESSAGES,
  myDrinkSchema,
  myDrinksResponseSchema,
} from "@/shared/my-drinks.ts";
import { createTestApp, createTestUserPair, type TestUser } from "../test-helpers.ts";

type Ctx = Awaited<ReturnType<typeof createTestApp>>;

const BASE = {
  name: "いつものワイン",
  drinkType: "wine",
  volumeMl: 125,
  abvPercent: 12,
} as const;

async function users(ctx: Ctx): Promise<[TestUser, TestUser]> {
  return createTestUserPair(ctx.app, [
    { name: "A", email: "a@example.com", password: "password1" },
    { name: "B", email: "b@example.com", password: "password1" },
  ]);
}

function requestJson(
  ctx: Ctx,
  path: string,
  method: "POST" | "PATCH",
  cookie: string,
  body: unknown,
) {
  return ctx.app.request(path, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createPreset(ctx: Ctx, user: TestUser, body: object = {}) {
  const response = await requestJson(ctx, "/api/my-drinks", "POST", user.cookie, {
    ...BASE,
    ...body,
  });
  expect(response.status).toBe(201);
  return myDrinkSchema.parse(await response.json());
}

async function validationFields(response: Response) {
  const body = apiErrorBodySchema.parse(await response.json());
  expect(body.error).toBe("validation_error");
  return body.fields ?? {};
}

async function seedPresets(ctx: Ctx, userId: string, count: number) {
  const now = new Date();
  await ctx.db.insert(myDrinks).values(
    Array.from({ length: count }, (_, index) => ({
      id: crypto.randomUUID(),
      userId,
      name: `preset-${index}`,
      drinkType: "beer" as const,
      volumeMl: 350,
      abvPercent: 5,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

describe("/api/my-drinks CRUD", () => {
  it("保護ルートは未認証で 401", async () => {
    const ctx = await createTestApp();
    for (const [path, method] of [
      ["/api/my-drinks", "GET"],
      ["/api/my-drinks", "POST"],
      ["/api/my-drinks/11111111-1111-4111-8111-111111111111", "GET"],
      ["/api/my-drinks/11111111-1111-4111-8111-111111111111", "PATCH"],
      ["/api/my-drinks/11111111-1111-4111-8111-111111111111", "DELETE"],
      ["/api/my-drinks/11111111-1111-4111-8111-111111111111/log", "POST"],
    ] as const) {
      const response = await ctx.app.request(path, { method });
      expect(response.status, `${method} ${path}`).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("作成・一覧・詳細・更新・削除を userId スコープで行う", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    const late = await createPreset(ctx, a, { name: "  後ろ  ", sortOrder: 5 });
    const tail = await createPreset(ctx, a, { name: "末尾" });
    const first = await createPreset(ctx, a, { name: "先頭", sortOrder: 0 });

    expect(late.name).toBe("後ろ");
    expect(tail.sortOrder).toBe(6);
    const listResponse = await ctx.app.request("/api/my-drinks", {
      headers: { Cookie: a.cookie },
    });
    expect(listResponse.status).toBe(200);
    const list = myDrinksResponseSchema.parse(await listResponse.json());
    expect(list.items.map((item) => item.id)).toEqual([first.id, late.id, tail.id]);
    expect(list.nextCursor).toBeNull();
    expect(JSON.stringify(list)).not.toContain("userId");

    const detailResponse = await ctx.app.request(`/api/my-drinks/${late.id}`, {
      headers: { Cookie: a.cookie },
    });
    expect(myDrinkSchema.parse(await detailResponse.json()).id).toBe(late.id);

    const patchResponse = await requestJson(ctx, `/api/my-drinks/${late.id}`, "PATCH", a.cookie, {
      name: "  更新後  ",
      abvPercent: 13.5,
    });
    expect(patchResponse.status).toBe(200);
    const updated = myDrinkSchema.parse(await patchResponse.json());
    expect(updated.name).toBe("更新後");
    expect(updated.abvPercent).toBe(13.5);

    const deleteResponse = await ctx.app.request(`/api/my-drinks/${late.id}`, {
      method: "DELETE",
      headers: { Cookie: a.cookie },
    });
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ ok: true });
    expect(
      (
        await ctx.app.request(`/api/my-drinks/${late.id}`, {
          headers: { Cookie: a.cookie },
        })
      ).status,
    ).toBe(404);
  });

  it("sortOrder,id 順の limit/cursor ページングと改ざん cursor 拒否", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    await seedPresets(ctx, a.id, 5);

    const firstResponse = await ctx.app.request("/api/my-drinks?limit=2", {
      headers: { Cookie: a.cookie },
    });
    const first = myDrinksResponseSchema.parse(await firstResponse.json());
    expect(first.items.map((item) => item.sortOrder)).toEqual([0, 1]);
    expect(first.nextCursor).not.toBeNull();

    const secondResponse = await ctx.app.request(
      `/api/my-drinks?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? "")}`,
      { headers: { Cookie: a.cookie } },
    );
    const second = myDrinksResponseSchema.parse(await secondResponse.json());
    expect(second.items.map((item) => item.sortOrder)).toEqual([2, 3]);
    expect(second.nextCursor).not.toBeNull();

    const invalid = await ctx.app.request("/api/my-drinks?cursor=forged", {
      headers: { Cookie: a.cookie },
    });
    expect(invalid.status).toBe(400);
    expect((await validationFields(invalid)).cursor).toEqual([MY_DRINK_MESSAGES.cursor]);
  });

  it("31件目は fields.count の 400", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    await seedPresets(ctx, a.id, MY_DRINK_MAX_COUNT);
    const response = await requestJson(ctx, "/api/my-drinks", "POST", a.cookie, BASE);
    expect(response.status).toBe(400);
    expect((await validationFields(response)).count).toEqual([MY_DRINK_MESSAGES.count]);
    expect(await ctx.db.select().from(myDrinks).where(eq(myDrinks.userId, a.id))).toHaveLength(
      MY_DRINK_MAX_COUNT,
    );
  });

  it("同時作成でもユーザー上限30件を超えない", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    await seedPresets(ctx, a.id, MY_DRINK_MAX_COUNT - 1);
    const responses = await Promise.all([
      requestJson(ctx, "/api/my-drinks", "POST", a.cookie, { ...BASE, name: "同時A" }),
      requestJson(ctx, "/api/my-drinks", "POST", a.cookie, { ...BASE, name: "同時B" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    expect(await ctx.db.select().from(myDrinks).where(eq(myDrinks.userId, a.id))).toHaveLength(
      MY_DRINK_MAX_COUNT,
    );
  });

  it("POST/PATCH の範囲・空・未知キーと UUID を検証する", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    const invalidCreate = await requestJson(ctx, "/api/my-drinks", "POST", a.cookie, {
      ...BASE,
      name: " ",
      sortOrder: -1,
      userId: a.id,
    });
    expect(invalidCreate.status).toBe(400);
    const createFields = await validationFields(invalidCreate);
    expect(createFields.name).toEqual([MY_DRINK_MESSAGES.name]);
    expect(createFields.sortOrder).toEqual([MY_DRINK_MESSAGES.sortOrder]);
    expect(createFields[""]).toBeDefined();

    const preset = await createPreset(ctx, a);
    const emptyPatch = await requestJson(ctx, `/api/my-drinks/${preset.id}`, "PATCH", a.cookie, {});
    expect(emptyPatch.status).toBe(400);
    expect((await validationFields(emptyPatch))[""]).toEqual([MY_DRINK_MESSAGES.patchEmpty]);

    const unknownPatch = await requestJson(ctx, `/api/my-drinks/${preset.id}`, "PATCH", a.cookie, {
      updatedAt: "x",
    });
    expect(unknownPatch.status).toBe(400);
    expect((await validationFields(unknownPatch))[""]).toBeDefined();

    const invalidId = await ctx.app.request("/api/my-drinks/not-a-uuid", {
      headers: { Cookie: a.cookie },
    });
    expect(invalidId.status).toBe(400);
  });

  it("A の Cookie では B の GET/PATCH/DELETE/1tap がすべて同じ 404 で未変更", async () => {
    const ctx = await createTestApp();
    const [a, b] = await users(ctx);
    const presetOfB = await createPreset(ctx, b);

    const get = await ctx.app.request(`/api/my-drinks/${presetOfB.id}`, {
      headers: { Cookie: a.cookie },
    });
    const patch = await requestJson(ctx, `/api/my-drinks/${presetOfB.id}`, "PATCH", a.cookie, {
      name: "侵害",
    });
    const remove = await ctx.app.request(`/api/my-drinks/${presetOfB.id}`, {
      method: "DELETE",
      headers: { Cookie: a.cookie },
    });
    const log = await requestJson(ctx, `/api/my-drinks/${presetOfB.id}/log`, "POST", a.cookie, {});

    for (const response of [get, patch, remove, log]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
    }
    const aList = myDrinksResponseSchema.parse(
      await (
        await ctx.app.request("/api/my-drinks", {
          headers: { Cookie: a.cookie },
        })
      ).json(),
    );
    expect(aList.items).toEqual([]);
    const [unchanged] = await ctx.db.select().from(myDrinks).where(eq(myDrinks.id, presetOfB.id));
    expect(unchanged?.name).toBe(BASE.name);
    expect(await ctx.db.select().from(drinkLogs)).toHaveLength(0);
  });
});

describe("POST /api/my-drinks/:id/log", () => {
  it("プリセット全値と名前をスナップショットし、alcoholG/drunkOn を計算する", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    const preset = await createPreset(ctx, a, {
      name: "<b>ハイボール</b>",
      drinkType: "whisky",
      volumeMl: 60,
      abvPercent: 40,
    });
    const response = await requestJson(ctx, `/api/my-drinks/${preset.id}/log`, "POST", a.cookie, {
      drunkAt: "2026-09-04T15:00:00.000Z",
      memo: "  一杯目  ",
    });
    expect(response.status).toBe(201);
    const log = drinkLogSchema.parse(await response.json());
    expect(log).toMatchObject({
      drinkType: "whisky",
      drinkName: "<b>ハイボール</b>",
      volumeMl: 60,
      abvPercent: 40,
      alcoholG: 19.2,
      drunkOn: "2026-09-05",
      memo: "一杯目",
      myDrinkId: preset.id,
    });
    expect(log.bottleId).toBeNull();
    expect(log.photos).toEqual([]);
  });

  it("プリセット編集後も過去ログは不変で、次回だけ新値になる", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    const preset = await createPreset(ctx, a);
    const first = drinkLogSchema.parse(
      await (
        await requestJson(ctx, `/api/my-drinks/${preset.id}/log`, "POST", a.cookie, {})
      ).json(),
    );

    await requestJson(ctx, `/api/my-drinks/${preset.id}`, "PATCH", a.cookie, {
      name: "更新プリセット",
      volumeMl: 250,
      abvPercent: 10,
    });
    const second = drinkLogSchema.parse(
      await (
        await requestJson(ctx, `/api/my-drinks/${preset.id}/log`, "POST", a.cookie, {})
      ).json(),
    );
    const [storedFirst] = await ctx.db.select().from(drinkLogs).where(eq(drinkLogs.id, first.id));
    expect(storedFirst).toMatchObject({
      drinkName: BASE.name,
      volumeMl: 125,
      abvPercent: 12,
      alcoholG: 12,
    });
    expect(second).toMatchObject({
      drinkName: "更新プリセット",
      volumeMl: 250,
      abvPercent: 10,
      alcoholG: 20,
    });
  });

  it("量・度数・種類など未知キーと +15分超の未来日時を拒否する", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    const preset = await createPreset(ctx, a);
    for (const body of [
      { volumeMl: 999 },
      { abvPercent: 99 },
      { drinkType: "beer" },
      { userId: a.id },
    ]) {
      const response = await requestJson(
        ctx,
        `/api/my-drinks/${preset.id}/log`,
        "POST",
        a.cookie,
        body,
      );
      expect(response.status).toBe(400);
      expect((await validationFields(response))[""]).toBeDefined();
    }

    const future = await requestJson(ctx, `/api/my-drinks/${preset.id}/log`, "POST", a.cookie, {
      drunkAt: new Date(Date.now() + DRUNK_AT_FUTURE_TOLERANCE_MS + 60_000).toISOString(),
    });
    expect(future.status).toBe(400);
    expect((await validationFields(future)).drunkAt).toBeDefined();
    expect(await ctx.db.select().from(drinkLogs)).toHaveLength(0);
  });

  it("削除時は過去ログの FK だけ null になり、削除済み 1tap は 404", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    const preset = await createPreset(ctx, a);
    const logged = drinkLogSchema.parse(
      await (
        await requestJson(ctx, `/api/my-drinks/${preset.id}/log`, "POST", a.cookie, {})
      ).json(),
    );
    const deleted = await ctx.app.request(`/api/my-drinks/${preset.id}`, {
      method: "DELETE",
      headers: { Cookie: a.cookie },
    });
    expect(deleted.status).toBe(200);

    const [past] = await ctx.db.select().from(drinkLogs).where(eq(drinkLogs.id, logged.id));
    expect(past).toMatchObject({
      myDrinkId: null,
      drinkName: BASE.name,
      volumeMl: 125,
      abvPercent: 12,
      alcoholG: 12,
    });
    const missing = await requestJson(ctx, `/api/my-drinks/${preset.id}/log`, "POST", a.cookie, {});
    expect(missing.status).toBe(404);
    expect(await ctx.db.select().from(drinkLogs)).toHaveLength(1);
  });
});
