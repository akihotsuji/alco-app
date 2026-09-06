import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { bottles, drinkLogs, myDrinks, photos } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import {
  DRINK_LOG_MESSAGES,
  DRUNK_AT_FUTURE_TOLERANCE_MS,
  drinkLogSchema,
  drinkLogsResponseSchema,
} from "@/shared/drink-logs.ts";
import { photoMetaSchema } from "@/shared/photos.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { makeJpeg } from "../image-fixtures.ts";
import { createTestApp, createTestUser } from "../test-helpers.ts";

type Ctx = Awaited<ReturnType<typeof createTestApp>>;

const BASE = { drinkType: "wine", volumeMl: 125, abvPercent: 12 } as const;
const OWN_BOTTLE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_BOTTLE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWN_MY_DRINK = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_MY_DRINK = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MISSING = "99999999-9999-4999-8999-999999999999";

async function session(app: Ctx["app"], email: string) {
  const user = await createTestUser(app, {
    name: email.split("@")[0] ?? "user",
    email,
    password: "password1",
  });
  return { cookie: user.cookie, userId: user.id };
}

function postLog(app: Ctx["app"], cookie: string, body: unknown, raw = false) {
  return app.request("/api/drink-logs", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: raw && typeof body === "string" ? body : JSON.stringify(body),
  });
}

function getLogs(app: Ctx["app"], cookie: string, search: string) {
  return app.request(`/api/drink-logs?${search}`, { headers: { Cookie: cookie } });
}

function patchLog(app: Ctx["app"], cookie: string, id: string, body: unknown) {
  return app.request(`/api/drink-logs/${id}`, {
    method: "PATCH",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function uploadPhoto(app: Ctx["app"], cookie: string) {
  const form = new FormData();
  form.set(
    "file",
    new File([Uint8Array.from(makeJpeg(320, 400))], "shot.jpg", { type: "image/jpeg" }),
  );
  const res = await app.request("/api/photos", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  expect(res.status).toBe(201);
  return photoMetaSchema.parse(await res.json());
}

async function seedBottle(ctx: Ctx, id: string, userId: string, name: string) {
  const now = new Date();
  await ctx.db.insert(bottles).values({
    id,
    userId,
    name,
    drinkType: "beer",
    createdAt: now,
    updatedAt: now,
  });
}

async function seedMyDrink(ctx: Ctx, id: string, userId: string, name: string) {
  const now = new Date();
  await ctx.db.insert(myDrinks).values({
    id,
    userId,
    name,
    drinkType: "whisky",
    volumeMl: 30,
    abvPercent: 40,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  });
}

async function fields(res: Response) {
  const body = apiErrorBodySchema.parse(await res.json());
  expect(body.error).toBe("validation_error");
  return body.fields ?? {};
}

describe("POST /api/drink-logs", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await postLog(app, "", BASE);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("初期値（ワイン 125 / 12）だけで 201。alcoholG と drunkOn はサーバー計算", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const before = Date.now();
    const res = await postLog(ctx.app, a.cookie, BASE);
    expect(res.status).toBe(201);
    const body = drinkLogSchema.parse(await res.json());
    expect(body.drinkType).toBe("wine");
    expect(body.volumeMl).toBe(125);
    expect(body.abvPercent).toBe(12);
    expect(body.alcoholG).toBe(12);
    expect(body.drinkName).toBeNull();
    expect(body.memo).toBeNull();
    expect(body.myDrinkId).toBeNull();
    expect(body.bottleId).toBeNull();
    expect(body.thumbPhotoId).toBeNull();
    expect(body.photos).toEqual([]);
    const drunkAt = new Date(body.drunkAt).getTime();
    expect(drunkAt).toBeGreaterThanOrEqual(before);
    expect(drunkAt).toBeLessThanOrEqual(Date.now());
    expect(body.drunkOn).toBe(tokyoToday(new Date(body.drunkAt)));
    expect(JSON.stringify(body)).not.toContain("userId");

    const rows = await ctx.db.select().from(drinkLogs).where(eq(drinkLogs.userId, a.userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.alcoholG).toBe(12);
  });

  it("drunkOn は JST の日付境界で決まる（E2）", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const late = await postLog(ctx.app, a.cookie, {
      ...BASE,
      drunkAt: "2026-09-04T14:59:00.000Z",
    });
    expect(drinkLogSchema.parse(await late.json()).drunkOn).toBe("2026-09-04");
    const midnight = await postLog(ctx.app, a.cookie, {
      ...BASE,
      drunkAt: "2026-09-04T15:00:00.000Z",
    });
    expect(drinkLogSchema.parse(await midnight.json()).drunkOn).toBe("2026-09-05");
  });

  it("クライアントの alcoholG は受け取らず、0% は 0.00 で保存する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const rejected = await postLog(ctx.app, a.cookie, { ...BASE, alcoholG: 999 });
    expect(rejected.status).toBe(400);
    expect((await fields(rejected))[""]).toBeDefined();

    const zero = await postLog(ctx.app, a.cookie, { ...BASE, abvPercent: 0 });
    expect(zero.status).toBe(201);
    expect(drinkLogSchema.parse(await zero.json()).alcoholG).toBe(0);
  });

  it("範囲外は 400 でフィールドごとの日本語文", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const res = await postLog(ctx.app, a.cookie, {
      drinkType: "vodka",
      volumeMl: 0,
      abvPercent: 12.34,
      memo: "a".repeat(501),
      photoIds: [MISSING, MISSING],
      drunkAt: new Date(Date.now() + DRUNK_AT_FUTURE_TOLERANCE_MS + 60_000).toISOString(),
    });
    expect(res.status).toBe(400);
    const f = await fields(res);
    expect(f.drinkType).toEqual([DRINK_LOG_MESSAGES.drinkType]);
    expect(f.volumeMl).toEqual([DRINK_LOG_MESSAGES.volumeMl]);
    expect(f.abvPercent).toEqual([DRINK_LOG_MESSAGES.abvDecimals]);
    expect(f.memo).toEqual([DRINK_LOG_MESSAGES.memo]);
    expect(f.photoIds).toEqual([DRINK_LOG_MESSAGES.photoIdsMax]);
    expect(f.drunkAt).toEqual([DRINK_LOG_MESSAGES.drunkAtFuture]);
    expect(await ctx.db.select().from(drinkLogs)).toHaveLength(0);
  });

  it("壊れた JSON はルートキーの汎用文", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const res = await postLog(ctx.app, a.cookie, "{not json", true);
    expect(res.status).toBe(400);
    expect((await fields(res))[""]).toBeDefined();
  });

  it("メモは trim して空なら null", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const blank = await postLog(ctx.app, a.cookie, { ...BASE, memo: "  \n " });
    expect(drinkLogSchema.parse(await blank.json()).memo).toBeNull();
    const text = await postLog(ctx.app, a.cookie, { ...BASE, memo: "  <b>美味しい</b> " });
    expect(drinkLogSchema.parse(await text.json()).memo).toBe("<b>美味しい</b>");
  });

  it("未紐付け写真を同時に紐付け、2 回目は 404", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const photo = await uploadPhoto(ctx.app, a.cookie);

    const res = await postLog(ctx.app, a.cookie, { ...BASE, photoIds: [photo.id] });
    expect(res.status).toBe(201);
    const body = drinkLogSchema.parse(await res.json());
    expect(body.thumbPhotoId).toBe(photo.id);
    expect(body.photos).toHaveLength(1);
    expect(body.photos[0]?.drinkLogId).toBe(body.id);

    const [row] = await ctx.db.select().from(photos).where(eq(photos.id, photo.id));
    expect(row?.drinkLogId).toBe(body.id);

    const again = await postLog(ctx.app, a.cookie, { ...BASE, photoIds: [photo.id] });
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: "not_found" });
  });

  it("他人の写真・不明な写真は 404 で記録を作らない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const photoOfB = await uploadPhoto(ctx.app, b.cookie);

    const other = await postLog(ctx.app, a.cookie, { ...BASE, photoIds: [photoOfB.id] });
    expect(other.status).toBe(404);
    const missing = await postLog(ctx.app, a.cookie, { ...BASE, photoIds: [MISSING] });
    expect(missing.status).toBe(404);

    expect(await ctx.db.select().from(drinkLogs)).toHaveLength(0);
    const [row] = await ctx.db.select().from(photos).where(eq(photos.id, photoOfB.id));
    expect(row?.drinkLogId).toBeNull();
  });

  it("ボトル紐付きは種類と名前をボトルで上書きし、他人・不明は 404", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    await seedBottle(ctx, OWN_BOTTLE, a.userId, "サンプル赤");
    await seedBottle(ctx, OTHER_BOTTLE, b.userId, "他人の瓶");

    const own = await postLog(ctx.app, a.cookie, { ...BASE, bottleId: OWN_BOTTLE });
    expect(own.status).toBe(201);
    const body = drinkLogSchema.parse(await own.json());
    expect(body.bottleId).toBe(OWN_BOTTLE);
    expect(body.drinkType).toBe("beer");
    expect(body.drinkName).toBe("サンプル赤");
    expect(body.volumeMl).toBe(125);

    const other = await postLog(ctx.app, a.cookie, { ...BASE, bottleId: OTHER_BOTTLE });
    expect(other.status).toBe(404);
    const missing = await postLog(ctx.app, a.cookie, { ...BASE, bottleId: MISSING });
    expect(missing.status).toBe(404);
    expect(await ctx.db.select().from(drinkLogs)).toHaveLength(1);
  });

  it("myDrinkId は名前だけコピーし、量・度数・種類はリクエストが正。他人は 404", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    await seedMyDrink(ctx, OWN_MY_DRINK, a.userId, "いつもの");
    await seedMyDrink(ctx, OTHER_MY_DRINK, b.userId, "他人の");

    const own = await postLog(ctx.app, a.cookie, { ...BASE, myDrinkId: OWN_MY_DRINK });
    expect(own.status).toBe(201);
    const body = drinkLogSchema.parse(await own.json());
    expect(body.myDrinkId).toBe(OWN_MY_DRINK);
    expect(body.drinkName).toBe("いつもの");
    expect(body.drinkType).toBe("wine");
    expect(body.volumeMl).toBe(125);

    const other = await postLog(ctx.app, a.cookie, { ...BASE, myDrinkId: OTHER_MY_DRINK });
    expect(other.status).toBe(404);
  });

  it("ボトルとマイドリンクの同時指定ではボトル名が優先", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    await seedBottle(ctx, OWN_BOTTLE, a.userId, "サンプル赤");
    await seedMyDrink(ctx, OWN_MY_DRINK, a.userId, "いつもの");
    const res = await postLog(ctx.app, a.cookie, {
      ...BASE,
      bottleId: OWN_BOTTLE,
      myDrinkId: OWN_MY_DRINK,
    });
    expect(res.status).toBe(201);
    expect(drinkLogSchema.parse(await res.json()).drinkName).toBe("サンプル赤");
  });
});

describe("GET /api/drink-logs", () => {
  it("未認証は 401、日付なしは 400", async () => {
    const ctx = await createTestApp();
    expect((await getLogs(ctx.app, "", "date=2026-09-04")).status).toBe(401);
    const a = await session(ctx.app, "a@example.com");
    const missing = await getLogs(ctx.app, a.cookie, "");
    expect(missing.status).toBe(400);
    expect((await fields(missing))[""]).toBeDefined();
  });

  it("本人の指定日だけを降順で返し、合計はページ全体ではなくフィルタ全体", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const photo = await uploadPhoto(ctx.app, a.cookie);
    const inputs = [
      { ...BASE, drunkAt: "2026-09-04T10:00:00.000Z", abvPercent: 10 },
      { ...BASE, drunkAt: "2026-09-04T11:00:00.000Z", abvPercent: 11 },
      {
        ...BASE,
        drunkAt: "2026-09-04T12:00:00.000Z",
        abvPercent: 12,
        photoIds: [photo.id],
      },
    ];
    const ids: string[] = [];
    for (const input of inputs) {
      const created = drinkLogSchema.parse(await (await postLog(ctx.app, a.cookie, input)).json());
      ids.push(created.id);
    }
    await postLog(ctx.app, a.cookie, { ...BASE, drunkAt: "2026-09-03T12:00:00.000Z" });
    await postLog(ctx.app, b.cookie, { ...BASE, drunkAt: "2026-09-04T12:30:00.000Z" });

    const first = await getLogs(ctx.app, a.cookie, "date=2026-09-04&limit=2");
    expect(first.status).toBe(200);
    const firstBody = drinkLogsResponseSchema.parse(await first.json());
    expect(firstBody.items.map((item) => item.id)).toEqual([ids[2], ids[1]]);
    expect(firstBody.items[0]?.thumbPhotoId).toBe(photo.id);
    expect(firstBody.totalCount).toBe(3);
    expect(firstBody.totalAlcoholG).toBe(33);
    expect(firstBody.hasAnyLogs).toBe(true);
    expect(firstBody.nextCursor).not.toBeNull();
    expect(JSON.stringify(firstBody)).not.toContain("userId");

    const second = await getLogs(
      ctx.app,
      a.cookie,
      `date=2026-09-04&limit=2&cursor=${encodeURIComponent(firstBody.nextCursor ?? "")}`,
    );
    const secondBody = drinkLogsResponseSchema.parse(await second.json());
    expect(secondBody.items.map((item) => item.id)).toEqual([ids[0]]);
    expect(secondBody.totalCount).toBe(3);
    expect(secondBody.nextCursor).toBeNull();
  });

  it("空の日でも全期間の記録有無を返し、期間・cursor を検証する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const empty = drinkLogsResponseSchema.parse(
      await (await getLogs(ctx.app, a.cookie, "date=2026-09-04")).json(),
    );
    expect(empty).toMatchObject({
      items: [],
      totalCount: 0,
      totalAlcoholG: 0,
      hasAnyLogs: false,
    });

    await postLog(ctx.app, a.cookie, { ...BASE, drunkAt: "2026-09-03T12:00:00.000Z" });
    const anotherEmpty = drinkLogsResponseSchema.parse(
      await (await getLogs(ctx.app, a.cookie, "date=2026-09-04")).json(),
    );
    expect(anotherEmpty.hasAnyLogs).toBe(true);

    const range = await getLogs(ctx.app, a.cookie, "from=2026-09-03&to=2026-09-04");
    expect(drinkLogsResponseSchema.parse(await range.json()).totalCount).toBe(1);
    expect((await getLogs(ctx.app, a.cookie, "from=2026-08-01&to=2026-09-04")).status).toBe(400);
    expect((await getLogs(ctx.app, a.cookie, "date=2026-09-04&cursor=broken")).status).toBe(400);
  });
});

describe("PATCH /api/drink-logs/:id", () => {
  it("未認証は 401、本人は部分更新でき、日付と alcoholG を再計算する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const created = drinkLogSchema.parse(
      await (
        await postLog(ctx.app, a.cookie, {
          ...BASE,
          drunkAt: "2026-09-04T11:00:00.000Z",
          memo: "元",
        })
      ).json(),
    );

    expect((await patchLog(ctx.app, "", created.id, { volumeMl: 350 })).status).toBe(401);
    const res = await patchLog(ctx.app, a.cookie, created.id, {
      drinkType: "beer",
      volumeMl: 350,
      abvPercent: 5,
      drunkAt: "2026-09-05T15:00:00.000Z",
      memo: "  <script>文字列</script>  ",
    });
    expect(res.status).toBe(200);
    const body = drinkLogSchema.parse(await res.json());
    expect(body).toMatchObject({
      drinkType: "beer",
      volumeMl: 350,
      abvPercent: 5,
      alcoholG: 14,
      drunkOn: "2026-09-06",
      memo: "<script>文字列</script>",
    });
  });

  it("他人・不在は同じ 404 で、他人の行を変更しない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const created = drinkLogSchema.parse(await (await postLog(ctx.app, a.cookie, BASE)).json());

    const other = await patchLog(ctx.app, b.cookie, created.id, { volumeMl: 500 });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: "not_found" });
    const missing = await patchLog(ctx.app, a.cookie, MISSING, { volumeMl: 500 });
    expect(missing.status).toBe(404);
    const unchanged = await ctx.app.request(`/api/drink-logs/${created.id}`, {
      headers: { Cookie: a.cookie },
    });
    expect(drinkLogSchema.parse(await unchanged.json()).volumeMl).toBe(125);
  });

  it("空・未知キーは 400。写真差し替えは所有者を検証して旧実体を削除する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const oldPhoto = await uploadPhoto(ctx.app, a.cookie);
    const created = drinkLogSchema.parse(
      await (
        await postLog(ctx.app, a.cookie, {
          ...BASE,
          photoIds: [oldPhoto.id],
        })
      ).json(),
    );
    expect((await patchLog(ctx.app, a.cookie, created.id, {})).status).toBe(400);
    expect((await patchLog(ctx.app, a.cookie, created.id, { userId: b.userId })).status).toBe(400);

    const otherPhoto = await uploadPhoto(ctx.app, b.cookie);
    const forbidden = await patchLog(ctx.app, a.cookie, created.id, {
      photoIds: [otherPhoto.id],
    });
    expect(forbidden.status).toBe(404);

    const replacement = await uploadPhoto(ctx.app, a.cookie);
    const replaced = await patchLog(ctx.app, a.cookie, created.id, {
      photoIds: [replacement.id],
    });
    expect(replaced.status).toBe(200);
    const body = drinkLogSchema.parse(await replaced.json());
    expect(body.thumbPhotoId).toBe(replacement.id);
    expect(body.photos.map((photo) => photo.id)).toEqual([replacement.id]);
    expect((await ctx.db.select().from(photos).where(eq(photos.id, oldPhoto.id))).length).toBe(0);
    expect(ctx.photos.keys()).toHaveLength(2);
  });
});

describe("GET /api/drink-logs/:id", () => {
  it("本人は 200、他人は 404、不正 ID は 400", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const photo = await uploadPhoto(ctx.app, a.cookie);
    const created = drinkLogSchema.parse(
      await (await postLog(ctx.app, a.cookie, { ...BASE, photoIds: [photo.id] })).json(),
    );

    const own = await ctx.app.request(`/api/drink-logs/${created.id}`, {
      headers: { Cookie: a.cookie },
    });
    expect(own.status).toBe(200);
    const body = drinkLogSchema.parse(await own.json());
    expect(body.id).toBe(created.id);
    expect(body.thumbPhotoId).toBe(photo.id);

    const other = await ctx.app.request(`/api/drink-logs/${created.id}`, {
      headers: { Cookie: b.cookie },
    });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: "not_found" });

    const invalid = await ctx.app.request("/api/drink-logs/not-a-uuid", {
      headers: { Cookie: a.cookie },
    });
    expect(invalid.status).toBe(400);
  });
});

describe("DELETE /api/drink-logs/:id", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await app.request(`/api/drink-logs/${MISSING}`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("本人は写真（メタ + R2）ごと削除。他人は 404 で残る", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const photo = await uploadPhoto(ctx.app, a.cookie);
    const created = drinkLogSchema.parse(
      await (await postLog(ctx.app, a.cookie, { ...BASE, photoIds: [photo.id] })).json(),
    );
    expect(ctx.photos.keys()).toHaveLength(1);

    const other = await ctx.app.request(`/api/drink-logs/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: b.cookie },
    });
    expect(other.status).toBe(404);
    expect(await ctx.db.select().from(drinkLogs)).toHaveLength(1);

    const own = await ctx.app.request(`/api/drink-logs/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: a.cookie },
    });
    expect(own.status).toBe(200);
    expect(await own.json()).toEqual({ ok: true });
    expect(await ctx.db.select().from(drinkLogs)).toHaveLength(0);
    expect(await ctx.db.select().from(photos)).toHaveLength(0);
    expect(ctx.photos.keys()).toHaveLength(0);

    const again = await ctx.app.request(`/api/drink-logs/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: a.cookie },
    });
    expect(again.status).toBe(404);
  });
});
