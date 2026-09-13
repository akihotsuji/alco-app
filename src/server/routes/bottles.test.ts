import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { bottles, drinkLogs, photos, userCellarSlots } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import {
  BOTTLE_MESSAGES,
  bottleSchema,
  bottlesResponseSchema,
  createBottlesResponseSchema,
  DEFAULT_BOTTLE_STORAGE,
} from "@/shared/bottles.ts";
import { cellarsResponseSchema } from "@/shared/cellars.ts";
import { drinkLogSchema } from "@/shared/drink-logs.ts";
import { photoMetaSchema } from "@/shared/photos.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { makeJpeg } from "../image-fixtures.ts";
import {
  createTestApp,
  createTestUser,
  createTestUserPair,
  seedOwnedBottle,
} from "../test-helpers.ts";

type Ctx = Awaited<ReturnType<typeof createTestApp>>;

const BASE = { name: "サンプル赤", drinkType: "wine" } as const;
const MISSING = "99999999-9999-4999-8999-999999999999";

async function session(app: Ctx["app"], email: string) {
  const user = await createTestUser(app, {
    name: email.split("@")[0] ?? "user",
    email,
    password: "password1",
  });
  return { cookie: user.cookie, userId: user.id };
}

function postBottle(app: Ctx["app"], cookie: string, body: unknown, raw = false) {
  return app.request("/api/bottles", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: raw && typeof body === "string" ? body : JSON.stringify(body),
  });
}

function getBottles(app: Ctx["app"], cookie: string, search = "") {
  const suffix = search ? `?${search}` : "";
  return app.request(`/api/bottles${suffix}`, { headers: { Cookie: cookie } });
}

function putBottleOrder(app: Ctx["app"], cookie: string, body: unknown) {
  return app.request("/api/bottles/order", {
    method: "PUT",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getBottle(app: Ctx["app"], cookie: string, id: string) {
  return app.request(`/api/bottles/${id}`, { headers: { Cookie: cookie } });
}

function patchBottle(app: Ctx["app"], cookie: string, id: string, body: unknown) {
  return app.request(`/api/bottles/${id}`, {
    method: "PATCH",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteBottleReq(app: Ctx["app"], cookie: string, id: string) {
  return app.request(`/api/bottles/${id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
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

async function fields(res: Response) {
  const body = apiErrorBodySchema.parse(await res.json());
  expect(body.error).toBe("validation_error");
  return body.fields ?? {};
}

async function seedConsumed(
  ctx: Ctx,
  id: string,
  userId: string,
  name: string,
  consumedAt: Date,
  consumedOn: string,
) {
  await seedOwnedBottle(ctx.db, {
    id,
    userId,
    name,
    drinkType: "beer",
    status: "consumed",
    consumedAt,
    consumedOn,
  });
}

describe("POST /api/bottles", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await postBottle(app, "", BASE);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("必須だけなら 1 行。status は sealed。userId は出さない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const res = await postBottle(ctx.app, a.cookie, BASE);
    expect(res.status).toBe(201);
    const body = createBottlesResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.name).toBe("サンプル赤");
    expect(body.items[0]?.drinkType).toBe("wine");
    expect(body.items[0]?.status).toBe("sealed");
    expect(body.items[0]?.consumedAt).toBeNull();
    expect(body.items[0]?.storedOn).toBe(tokyoToday());
    expect(body.items[0]?.storage).toBe(DEFAULT_BOTTLE_STORAGE);
    expect(body.items[0]?.purchasedOn).toBeNull();
    expect(body.items[0]?.photos).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("userId");
    expect(JSON.stringify(body)).not.toContain("r2Key");
  });

  it("count 3 で 3 行。createdAt は同一、id は個別", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const res = await postBottle(ctx.app, a.cookie, { ...BASE, count: 3 });
    expect(res.status).toBe(201);
    const body = createBottlesResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(3);
    const ids = new Set(body.items.map((item) => item.id));
    expect(ids.size).toBe(3);
    expect(body.items[0]?.createdAt).toBe(body.items[1]?.createdAt);
    expect(body.items[1]?.createdAt).toBe(body.items[2]?.createdAt);
    const rows = await ctx.db.select().from(bottles);
    expect(rows).toHaveLength(3);
  });

  it("写真付き N 本は photo 行と R2 を複製する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const photo = await uploadPhoto(ctx.app, a.cookie);
    const res = await postBottle(ctx.app, a.cookie, {
      ...BASE,
      count: 3,
      photoIds: [photo.id],
    });
    expect(res.status).toBe(201);
    const body = createBottlesResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(3);
    const photoIds = body.items.map((item) => item.photos[0]?.id);
    expect(photoIds[0]).toBe(photo.id);
    expect(new Set(photoIds).size).toBe(3);
    expect(ctx.photos.keys()).toHaveLength(3);
    const photoRows = await ctx.db.select().from(photos).where(eq(photos.uploadedBy, a.userId));
    expect(photoRows).toHaveLength(3);
    expect(new Set(photoRows.map((row) => row.bottleId)).size).toBe(3);
  });

  it("表面 + 裏面の 2 枚は配列順が sortOrder。3 枚と重複は弾く", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const front = await uploadPhoto(ctx.app, a.cookie);
    const back = await uploadPhoto(ctx.app, a.cookie);
    const res = await postBottle(ctx.app, a.cookie, { ...BASE, photoIds: [front.id, back.id] });
    expect(res.status).toBe(201);
    const body = createBottlesResponseSchema.parse(await res.json());
    const created = body.items[0];
    expect(created?.photos.map((photo) => photo.id)).toEqual([front.id, back.id]);
    expect(created?.thumbPhotoId).toBe(front.id);
    const rows = await ctx.db
      .select()
      .from(photos)
      .where(eq(photos.bottleId, created?.id ?? ""));
    expect(new Map(rows.map((row) => [row.id, row.sortOrder]))).toEqual(
      new Map([
        [front.id, 0],
        [back.id, 1],
      ]),
    );

    const detail = bottleSchema.parse(
      await (await getBottle(ctx.app, a.cookie, created?.id ?? "")).json(),
    );
    expect(detail.photos.map((photo) => photo.id)).toEqual([front.id, back.id]);

    const extra = await uploadPhoto(ctx.app, a.cookie);
    const three = await postBottle(ctx.app, a.cookie, {
      ...BASE,
      photoIds: [extra.id, extra.id, extra.id],
    });
    expect((await fields(three)).photoIds).toEqual([BOTTLE_MESSAGES.photoIdsMax]);
    const duplicated = await postBottle(ctx.app, a.cookie, {
      ...BASE,
      photoIds: [extra.id, extra.id],
    });
    expect(duplicated.status).toBe(404);
    expect(await ctx.db.select().from(bottles)).toHaveLength(1);
  });

  it("表 + 裏の N 本は組ごとに複製し sortOrder を引き継ぐ", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const front = await uploadPhoto(ctx.app, a.cookie);
    const back = await uploadPhoto(ctx.app, a.cookie);
    const res = await postBottle(ctx.app, a.cookie, {
      ...BASE,
      count: 2,
      photoIds: [front.id, back.id],
    });
    expect(res.status).toBe(201);
    const body = createBottlesResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(2);
    for (const item of body.items) {
      expect(item.photos).toHaveLength(2);
      expect(item.thumbPhotoId).toBe(item.photos[0]?.id);
    }
    expect(body.items[0]?.photos.map((photo) => photo.id)).toEqual([front.id, back.id]);
    expect(ctx.photos.keys()).toHaveLength(4);
    const rows = await ctx.db.select().from(photos).where(eq(photos.uploadedBy, a.userId));
    expect(rows).toHaveLength(4);
    const second = rows.filter((row) => row.bottleId === body.items[1]?.id);
    expect(second.map((row) => row.sortOrder).sort()).toEqual([0, 1]);
  });

  it("他人・紐付け済み・不明の photoIds は 404。行は作らない", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    const otherPhoto = await uploadPhoto(ctx.app, b.cookie);
    const missing = await postBottle(ctx.app, a.cookie, { ...BASE, photoIds: [MISSING] });
    expect(missing.status).toBe(404);
    const foreign = await postBottle(ctx.app, a.cookie, { ...BASE, photoIds: [otherPhoto.id] });
    expect(foreign.status).toBe(404);

    const own = await uploadPhoto(ctx.app, a.cookie);
    const first = await postBottle(ctx.app, a.cookie, { ...BASE, photoIds: [own.id] });
    expect(first.status).toBe(201);
    const reused = await postBottle(ctx.app, a.cookie, {
      ...BASE,
      name: "二本目",
      photoIds: [own.id],
    });
    expect(reused.status).toBe(404);
    expect(await ctx.db.select().from(bottles)).toHaveLength(1);
  });

  it("status / userId は未知キーで 400", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const status = await postBottle(ctx.app, a.cookie, { ...BASE, status: "consumed" });
    expect(status.status).toBe(400);
    expect((await fields(status))[""]).toBeDefined();
    const userId = await postBottle(ctx.app, a.cookie, { ...BASE, userId: MISSING });
    expect(userId.status).toBe(400);
    expect((await fields(userId))[""]).toBeDefined();
  });

  it("範囲外は 400 でフィールドごとの日本語文", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const res = await postBottle(ctx.app, a.cookie, {
      name: "",
      drinkType: "vodka",
      count: 13,
      vintage: 1799,
      priceJpy: -1,
    });
    expect(res.status).toBe(400);
    const f = await fields(res);
    expect(f.name).toEqual([BOTTLE_MESSAGES.name]);
    expect(f.drinkType).toBeDefined();
    expect(f.count).toEqual([BOTTLE_MESSAGES.count]);
    expect(f.vintage).toEqual([BOTTLE_MESSAGES.vintage]);
    expect(f.priceJpy).toEqual([BOTTLE_MESSAGES.priceJpy]);
  });

  it("生産国の不正値は 400。France はフランス。既存不正値は無関係な PATCH で残す", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const invalid = await postBottle(ctx.app, a.cookie, { ...BASE, origin: "DOCG" });
    expect(invalid.status).toBe(400);
    expect((await fields(invalid)).origin).toBeDefined();

    const created = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { ...BASE, origin: "France" })).json(),
    );
    expect(created.items[0]?.origin).toBe("フランス");

    const staleId = crypto.randomUUID();
    await seedOwnedBottle(ctx.db, {
      id: staleId,
      userId: a.userId,
      name: "旧レコード",
      drinkType: "wine",
      origin: "DOCG",
    });
    const kept = bottleSchema.parse(
      await (await patchBottle(ctx.app, a.cookie, staleId, { name: "改名だけ" })).json(),
    );
    expect(kept.origin).toBe("DOCG");
    expect(kept.name).toBe("改名だけ");
  });

  it("未来の購入日は 400。同名は許可する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const future = await postBottle(ctx.app, a.cookie, { ...BASE, purchasedOn: "2099-01-01" });
    expect(future.status).toBe(400);
    expect((await fields(future)).purchasedOn).toEqual([BOTTLE_MESSAGES.purchasedOnFuture]);
    expect((await postBottle(ctx.app, a.cookie, { name: "同名", drinkType: "wine" })).status).toBe(
      201,
    );
    expect((await postBottle(ctx.app, a.cookie, { name: "同名", drinkType: "wine" })).status).toBe(
      201,
    );
    const cellar = bottlesResponseSchema.parse(await (await getBottles(ctx.app, a.cookie)).json());
    expect(cellar.items.filter((item) => item.name === "同名")).toHaveLength(2);
  });

  it("保管日と購入日は独立。省略時だけ保管日は当日・保管場所は自宅セラー", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const explicit = createBottlesResponseSchema.parse(
      await (
        await postBottle(ctx.app, a.cookie, {
          ...BASE,
          name: "明示",
          storedOn: "2026-01-02",
          purchasedOn: "2026-01-03",
          storage: "リビング",
        })
      ).json(),
    );
    expect(explicit.items[0]?.storedOn).toBe("2026-01-02");
    expect(explicit.items[0]?.purchasedOn).toBe("2026-01-03");
    expect(explicit.items[0]?.storage).toBe("リビング");

    const cleared = createBottlesResponseSchema.parse(
      await (
        await postBottle(ctx.app, a.cookie, {
          ...BASE,
          name: "空欄",
          storedOn: null,
          storage: null,
        })
      ).json(),
    );
    expect(cleared.items[0]?.storedOn).toBeNull();
    expect(cleared.items[0]?.storage).toBeNull();
    expect(cleared.items[0]?.purchasedOn).toBeNull();

    const futureStored = await postBottle(ctx.app, a.cookie, { ...BASE, storedOn: "2099-01-01" });
    expect(futureStored.status).toBe(400);
    expect((await fields(futureStored)).storedOn).toEqual([BOTTLE_MESSAGES.storedOnFuture]);
  });
});

describe("GET /api/bottles", () => {
  it("ボトルが無い新規ユーザーの一覧は空で、個人セラーを作らない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "new@example.com");
    const cellar = bottlesResponseSchema.parse(await (await getBottles(ctx.app, a.cookie)).json());
    expect(cellar.items).toEqual([]);
    expect(cellar.totalCount).toBe(0);
    expect(
      await ctx.db.select().from(userCellarSlots).where(eq(userCellarSlots.userId, a.userId)),
    ).toEqual([]);
  });

  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await getBottles(app, "");
    expect(res.status).toBe(401);
  });

  it("既定は cellar。他人の行は混ざらず、totalCount はフィルタ前", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    await postBottle(ctx.app, a.cookie, { name: "自分の赤", drinkType: "wine" });
    await postBottle(ctx.app, a.cookie, { name: "自分のビール", drinkType: "beer" });
    await postBottle(ctx.app, b.cookie, { name: "他人の赤", drinkType: "wine" });
    await seedConsumed(
      ctx,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      a.id,
      "開栓済み",
      new Date("2026-09-01T00:00:00.000Z"),
      "2026-09-01",
    );

    const cellar = bottlesResponseSchema.parse(await (await getBottles(ctx.app, a.cookie)).json());
    // createdAt が同一ミリ秒だと id 降順になり、登録順だけでは安定しない
    expect(cellar.items.map((item) => item.name).toSorted()).toEqual(["自分のビール", "自分の赤"]);
    expect(cellar.totalCount).toBe(2);
    expect(cellar.countsByType.wine).toBe(1);
    expect(cellar.countsByType.beer).toBe(1);
    expect(cellar.countsByType.whisky).toBe(0);
    expect(cellar.items.every((item) => item.status === "sealed")).toBe(true);

    const filtered = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "drinkType=wine")).json(),
    );
    expect(filtered.items).toHaveLength(1);
    expect(filtered.totalCount).toBe(2);
    expect(filtered.countsByType.beer).toBe(1);

    const other = bottlesResponseSchema.parse(await (await getBottles(ctx.app, b.cookie)).json());
    expect(other.items.map((item) => item.name)).toEqual(["他人の赤"]);
    expect(other.totalCount).toBe(1);
  });

  it("q は自分の銘柄名・生産者・品種だけ。% はリテラル", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    await postBottle(ctx.app, a.cookie, {
      name: "100%赤",
      drinkType: "wine",
      producer: "山の生産者",
    });
    await postBottle(ctx.app, a.cookie, {
      name: "別の白",
      drinkType: "wine",
      variety: "シャルドネ",
    });
    await postBottle(ctx.app, b.cookie, { name: "100%赤", drinkType: "wine" });

    const percent = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "q=100%")).json(),
    );
    expect(percent.items.map((item) => item.name)).toEqual(["100%赤"]);
    expect(percent.totalCount).toBe(2);

    const producer = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "q=山の")).json(),
    );
    expect(producer.items).toHaveLength(1);
    expect(producer.items[0]?.producer).toBe("山の生産者");

    const variety = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "q=シャルドネ")).json(),
    );
    expect(variety.items).toHaveLength(1);
    expect(variety.items[0]?.variety).toBe("シャルドネ");
  });

  it("view=all は貯蔵庫も含む。archive は consumedAt 降順", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    await postBottle(ctx.app, a.cookie, BASE);
    await seedConsumed(
      ctx,
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      a.userId,
      "古い開栓",
      new Date("2026-08-01T00:00:00.000Z"),
      "2026-08-01",
    );
    await seedConsumed(
      ctx,
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      a.userId,
      "新しい開栓",
      new Date("2026-09-01T00:00:00.000Z"),
      "2026-09-01",
    );

    const all = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "view=all")).json(),
    );
    expect(all.totalCount).toBe(3);
    expect(all.items).toHaveLength(3);

    const archive = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "view=archive")).json(),
    );
    expect(archive.items.map((item) => item.name)).toEqual(["新しい開栓", "古い開栓"]);
    expect(archive.totalCount).toBe(2);
  });

  it("不正な view / cursor は 400", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const view = await getBottles(ctx.app, a.cookie, "view=opened");
    expect(view.status).toBe(400);
    expect((await fields(view)).view).toEqual([BOTTLE_MESSAGES.view]);
    const cursor = await getBottles(ctx.app, a.cookie, "cursor=not-a-cursor");
    expect(cursor.status).toBe(400);
    expect((await fields(cursor)).cursor).toEqual([BOTTLE_MESSAGES.cursor]);
  });

  it("drinkType=evil / status=evil / 長すぎる q / 範囲外 limit は 400", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const drinkType = await getBottles(ctx.app, a.cookie, "drinkType=evil");
    expect(drinkType.status).toBe(400);
    expect((await fields(drinkType)).drinkType).toBeDefined();
    const status = await getBottles(ctx.app, a.cookie, "status=evil");
    expect(status.status).toBe(400);
    expect((await fields(status))[""]).toBeDefined();
    const q = await getBottles(ctx.app, a.cookie, `q=${"x".repeat(101)}`);
    expect(q.status).toBe(400);
    expect((await fields(q)).q).toEqual([BOTTLE_MESSAGES.q]);
    const limit = await getBottles(ctx.app, a.cookie, "limit=0");
    expect(limit.status).toBe(400);
    expect((await fields(limit)).limit).toEqual([BOTTLE_MESSAGES.limit]);
  });

  it("limit と cursor で次ページを返す。他人の行は混ざらない", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    const created = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { ...BASE, count: 3 })).json(),
    );
    await postBottle(ctx.app, b.cookie, { name: "他人", drinkType: "wine" });
    const first = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "limit=2")).json(),
    );
    expect(first.items).toHaveLength(2);
    expect(first.totalCount).toBe(3);
    expect(first.nextCursor).toBeTruthy();
    expect(first.items.every((item) => item.name === BASE.name)).toBe(true);
    const second = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, `limit=2&cursor=${first.nextCursor}`)).json(),
    );
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.sort()).toEqual(created.items.map((item) => item.id).sort());
  });

  it("group=type は種類ごとの先頭 limit 本を 1 応答に載せる", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    await postBottle(ctx.app, a.cookie, { name: "赤1", drinkType: "wine_red", count: 12 });
    await postBottle(ctx.app, a.cookie, { name: "赤2", drinkType: "wine_red" });
    await postBottle(ctx.app, a.cookie, { name: "ビール", drinkType: "beer" });
    await postBottle(ctx.app, b.cookie, { name: "他人の赤", drinkType: "wine_red" });
    await seedConsumed(
      ctx,
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      a.id,
      "開栓ビール",
      new Date("2026-09-01T00:00:00.000Z"),
      "2026-09-01",
    );

    const grouped = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "view=cellar&group=type&limit=12")).json(),
    );
    expect(grouped.typeShelves?.map((shelf) => shelf.drinkType)).toEqual(["wine_red", "beer"]);
    expect(grouped.typeShelves?.[0]?.items).toHaveLength(12);
    expect(grouped.typeShelves?.[0]?.nextCursor).toBeTruthy();
    expect(grouped.typeShelves?.[1]?.items.map((item) => item.name)).toEqual(["ビール"]);
    expect(grouped.typeShelves?.[1]?.nextCursor).toBeNull();
    expect(grouped.items).toHaveLength(13);
    expect(grouped.nextCursor).toBeNull();
    expect(grouped.totalCount).toBe(14);
    expect(grouped.countsByType.wine_red).toBe(13);
    expect(grouped.countsByType.beer).toBe(1);
    expect(grouped.items.some((item) => item.name === "他人の赤")).toBe(false);

    const more = bottlesResponseSchema.parse(
      await (
        await getBottles(
          ctx.app,
          a.cookie,
          `view=cellar&drinkType=wine_red&limit=12&cursor=${grouped.typeShelves?.[0]?.nextCursor}`,
        )
      ).json(),
    );
    expect(more.items).toHaveLength(1);
    expect(more.nextCursor).toBeNull();

    const searched = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "group=type&limit=12&q=ビール")).json(),
    );
    expect(searched.totalCount).toBe(14);
    expect(searched.typeShelves?.map((shelf) => shelf.drinkType)).toEqual(["beer"]);
    expect(searched.items.map((item) => item.name)).toEqual(["ビール"]);

    const plain = bottlesResponseSchema.parse(await (await getBottles(ctx.app, a.cookie)).json());
    expect(plain.typeShelves).toBeUndefined();
  });

  it("group=type の不正な組み合わせは 400。未認証は 401。他人の cellarId は 404", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    await postBottle(ctx.app, b.cookie, { name: "他人", drinkType: "wine" });
    const otherCellars = cellarsResponseSchema.parse(
      await (await ctx.app.request("/api/cellars", { headers: { Cookie: b.cookie } })).json(),
    );
    const otherId = otherCellars.items[0]?.id;
    expect(otherId).toBeDefined();

    const unauth = await getBottles(ctx.app, "", "group=type&limit=12");
    expect(unauth.status).toBe(401);

    const withDrinkType = await getBottles(ctx.app, a.cookie, "group=type&drinkType=wine");
    expect(withDrinkType.status).toBe(400);
    expect((await fields(withDrinkType)).group).toEqual([BOTTLE_MESSAGES.group]);

    const withCursor = await getBottles(ctx.app, a.cookie, "group=type&cursor=abc");
    expect(withCursor.status).toBe(400);
    expect((await fields(withCursor)).group).toEqual([BOTTLE_MESSAGES.group]);

    const archive = await getBottles(ctx.app, a.cookie, "view=archive&group=type");
    expect(archive.status).toBe(400);
    expect((await fields(archive)).group).toEqual([BOTTLE_MESSAGES.group]);

    const other = await getBottles(ctx.app, a.cookie, `group=type&limit=12&cellarId=${otherId}`);
    const missing = await getBottles(ctx.app, a.cookie, `group=type&limit=12&cellarId=${MISSING}`);
    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await other.json()).toEqual(await missing.json());
  });
});

describe("GET / PATCH / DELETE /api/bottles/:id", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    expect((await getBottle(app, "", MISSING)).status).toBe(401);
    expect((await patchBottle(app, "", MISSING, { name: "x" })).status).toBe(401);
    expect((await deleteBottleReq(app, "", MISSING)).status).toBe(401);
  });

  it("他人・不在は同じ 404", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    const created = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, BASE)).json(),
    );
    const id = created.items[0]?.id ?? "";
    const otherGet = await getBottle(ctx.app, b.cookie, id);
    const missingGet = await getBottle(ctx.app, a.cookie, MISSING);
    expect(otherGet.status).toBe(404);
    expect(missingGet.status).toBe(404);
    expect(await otherGet.json()).toEqual(await missingGet.json());
    expect((await patchBottle(ctx.app, b.cookie, id, { name: "盗む" })).status).toBe(404);
    expect((await deleteBottleReq(ctx.app, b.cookie, id)).status).toBe(404);
    expect(bottleSchema.parse(await (await getBottle(ctx.app, a.cookie, id)).json()).name).toBe(
      "サンプル赤",
    );
    expect(await ctx.db.select().from(bottles)).toHaveLength(1);
  });

  it("PATCH は部分更新。status は受け取らない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const created = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, BASE)).json(),
    );
    const id = created.items[0]?.id ?? "";
    const status = await patchBottle(ctx.app, a.cookie, id, { status: "consumed" });
    expect(status.status).toBe(400);
    expect((await fields(status))[""]).toBeDefined();
    const empty = await patchBottle(ctx.app, a.cookie, id, {});
    expect(empty.status).toBe(400);
    const ok = await patchBottle(ctx.app, a.cookie, id, { name: "改名", memo: "  メモ  " });
    expect(ok.status).toBe(200);
    const body = bottleSchema.parse(await ok.json());
    expect(body.name).toBe("改名");
    expect(body.memo).toBe("メモ");
    expect(body.status).toBe("sealed");
    expect(body.storedOn).toBe(tokyoToday());
    expect(body.storage).toBe(DEFAULT_BOTTLE_STORAGE);
  });

  it("既存の空の保管日・保管場所は PATCH で補完しない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const id = crypto.randomUUID();
    await seedOwnedBottle(ctx.db, {
      id,
      userId: a.userId,
      name: "旧レコード",
      drinkType: "wine",
    });
    const ok = await patchBottle(ctx.app, a.cookie, id, { name: "改名だけ" });
    expect(ok.status).toBe(200);
    const body = bottleSchema.parse(await ok.json());
    expect(body.name).toBe("改名だけ");
    expect(body.storedOn).toBeNull();
    expect(body.storage).toBeNull();
    expect(body.purchasedOn).toBeNull();

    const dates = await patchBottle(ctx.app, a.cookie, id, {
      storedOn: "2026-02-01",
      purchasedOn: "2026-03-01",
    });
    expect(dates.status).toBe(200);
    const updated = bottleSchema.parse(await dates.json());
    expect(updated.storedOn).toBe("2026-02-01");
    expect(updated.purchasedOn).toBe("2026-03-01");
  });

  it("他人の photoIds は PATCH でも 404。行は変わらない", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    const id = await createOwnedBottle(ctx.app, a.cookie);
    const otherPhoto = await uploadPhoto(ctx.app, b.cookie);
    const res = await patchBottle(ctx.app, a.cookie, id, { photoIds: [otherPhoto.id] });
    expect(res.status).toBe(404);
    expect(
      bottleSchema.parse(await (await getBottle(ctx.app, a.cookie, id)).json()).photos,
    ).toEqual([]);
  });

  it("PATCH で既存の表面に裏面を足し、外した写真は R2 ごと消える", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const front = await uploadPhoto(ctx.app, a.cookie);
    const created = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { ...BASE, photoIds: [front.id] })).json(),
    );
    const id = created.items[0]?.id ?? "";

    const back = await uploadPhoto(ctx.app, a.cookie);
    const added = await patchBottle(ctx.app, a.cookie, id, { photoIds: [front.id, back.id] });
    expect(added.status).toBe(200);
    const withBack = bottleSchema.parse(await added.json());
    expect(withBack.photos.map((photo) => photo.id)).toEqual([front.id, back.id]);
    expect(withBack.thumbPhotoId).toBe(front.id);
    let rows = await ctx.db.select().from(photos).where(eq(photos.bottleId, id));
    expect(new Map(rows.map((row) => [row.id, row.sortOrder]))).toEqual(
      new Map([
        [front.id, 0],
        [back.id, 1],
      ]),
    );

    // 表面を差し替え、裏面は残す。残した裏面の sort_order も書き直される。
    const newFront = await uploadPhoto(ctx.app, a.cookie);
    const swapped = await patchBottle(ctx.app, a.cookie, id, {
      photoIds: [newFront.id, back.id],
    });
    expect(swapped.status).toBe(200);
    expect(bottleSchema.parse(await swapped.json()).photos.map((photo) => photo.id)).toEqual([
      newFront.id,
      back.id,
    ]);
    rows = await ctx.db.select().from(photos).where(eq(photos.bottleId, id));
    expect(rows.map((row) => row.id).sort()).toEqual([newFront.id, back.id].sort());
    expect(rows.find((row) => row.id === back.id)?.sortOrder).toBe(1);
    expect(await ctx.db.select().from(photos).where(eq(photos.id, front.id))).toHaveLength(0);
    expect(ctx.photos.keys()).toHaveLength(2);

    // 裏面だけ外す
    const removed = await patchBottle(ctx.app, a.cookie, id, { photoIds: [newFront.id] });
    expect(removed.status).toBe(200);
    expect(bottleSchema.parse(await removed.json()).photos.map((photo) => photo.id)).toEqual([
      newFront.id,
    ]);
    expect(ctx.photos.keys()).toHaveLength(1);
  });

  it("DELETE 後も記録は残り bottleId は null。写真は消える", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const photo = await uploadPhoto(ctx.app, a.cookie);
    const created = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { ...BASE, photoIds: [photo.id] })).json(),
    );
    const id = created.items[0]?.id ?? "";
    const logRes = await ctx.app.request("/api/drink-logs", {
      method: "POST",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        drinkType: "wine",
        volumeMl: 125,
        abvPercent: 12,
        bottleId: id,
      }),
    });
    expect(logRes.status).toBe(201);
    const log = drinkLogSchema.parse(await logRes.json());
    expect(log.bottleId).toBe(id);
    expect(log.drinkName).toBe("サンプル赤");

    const deleted = await deleteBottleReq(ctx.app, a.cookie, id);
    expect(deleted.status).toBe(200);
    expect((await getBottle(ctx.app, a.cookie, id)).status).toBe(404);
    expect(ctx.photos.keys()).toHaveLength(0);
    expect(await ctx.db.select().from(photos).where(eq(photos.uploadedBy, a.userId))).toHaveLength(
      0,
    );

    const remaining = drinkLogSchema.parse(
      await (
        await ctx.app.request(`/api/drink-logs/${log.id}`, { headers: { Cookie: a.cookie } })
      ).json(),
    );
    expect(remaining.bottleId).toBeNull();
    expect(remaining.drinkName).toBe("サンプル赤");
    const rows = await ctx.db.select().from(drinkLogs).where(eq(drinkLogs.id, log.id));
    expect(rows[0]?.bottleId).toBeNull();
  });
});

function consumeBottleReq(app: Ctx["app"], cookie: string, id: string, body?: unknown) {
  const init: RequestInit = {
    method: "POST",
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
  };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return app.request(`/api/bottles/${id}/consume`, init);
}

function restoreBottleReq(app: Ctx["app"], cookie: string, id: string, body?: unknown) {
  const init: RequestInit = {
    method: "POST",
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
  };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return app.request(`/api/bottles/${id}/restore`, init);
}

async function createOwnedBottle(app: Ctx["app"], cookie: string, name = BASE.name) {
  const created = createBottlesResponseSchema.parse(
    await (await postBottle(app, cookie, { ...BASE, name })).json(),
  );
  const id = created.items[0]?.id ?? "";
  expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  return id;
}

describe("POST /api/bottles/:id/consume", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await consumeBottleReq(app, "", MISSING, {});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("sealed を consumed にし、記録は作らない。ボディなしでも通る", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const id = await createOwnedBottle(ctx.app, a.cookie);
    const logsBefore = await ctx.db.select().from(drinkLogs).where(eq(drinkLogs.userId, a.userId));
    expect(logsBefore).toHaveLength(0);

    const nowBefore = Date.now();
    const res = await consumeBottleReq(ctx.app, a.cookie, id);
    expect(res.status).toBe(200);
    const body = bottleSchema.parse(await res.json());
    expect(body.status).toBe("consumed");
    expect(body.consumedOn).toBe(tokyoToday());
    expect(body.consumedAt).toBeTruthy();
    const consumedMs = new Date(body.consumedAt ?? "").getTime();
    expect(consumedMs).toBeGreaterThanOrEqual(nowBefore);
    expect(JSON.stringify(body)).not.toContain("userId");

    const logsAfter = await ctx.db.select().from(drinkLogs).where(eq(drinkLogs.userId, a.userId));
    expect(logsAfter).toHaveLength(0);

    const cellar = bottlesResponseSchema.parse(await (await getBottles(ctx.app, a.cookie)).json());
    expect(cellar.items).toHaveLength(0);
    expect(cellar.totalCount).toBe(0);
    const archive = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "view=archive")).json(),
    );
    expect(archive.items.map((item) => item.id)).toEqual([id]);
  });

  it("他人・不在・すでに consumed は同じ 404。記録は作らない", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    const id = await createOwnedBottle(ctx.app, a.cookie);
    await seedConsumed(
      ctx,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      a.id,
      "既に開栓",
      new Date("2026-09-01T00:00:00.000Z"),
      "2026-09-01",
    );

    const other = await consumeBottleReq(ctx.app, b.cookie, id, {});
    const missing = await consumeBottleReq(ctx.app, a.cookie, MISSING, {});
    const already = await consumeBottleReq(
      ctx.app,
      a.cookie,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      {},
    );
    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(already.status).toBe(404);
    expect(await other.json()).toEqual(await missing.json());
    expect(await already.json()).toEqual({ error: "not_found" });
    expect(await ctx.db.select().from(drinkLogs)).toHaveLength(0);
    expect(bottleSchema.parse(await (await getBottle(ctx.app, a.cookie, id)).json()).status).toBe(
      "sealed",
    );
  });

  it("未知キー log は 400。status は変わらない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const id = await createOwnedBottle(ctx.app, a.cookie);
    const res = await consumeBottleReq(ctx.app, a.cookie, id, { log: true });
    expect(res.status).toBe(400);
    expect((await fields(res))[""]).toBeDefined();
    expect(bottleSchema.parse(await (await getBottle(ctx.app, a.cookie, id)).json()).status).toBe(
      "sealed",
    );
  });

  it("N 本のうち 1 本だけ貯蔵庫へ移る", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const created = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { ...BASE, count: 3 })).json(),
    );
    const first = created.items[0]?.id ?? "";
    expect((await consumeBottleReq(ctx.app, a.cookie, first)).status).toBe(200);
    const cellar = bottlesResponseSchema.parse(await (await getBottles(ctx.app, a.cookie)).json());
    expect(cellar.totalCount).toBe(2);
    expect(cellar.items.map((item) => item.id)).not.toContain(first);
    const archive = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "view=archive")).json(),
    );
    expect(archive.items.map((item) => item.id)).toEqual([first]);
  });
});

describe("POST /api/bottles/:id/restore", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    expect((await restoreBottleReq(app, "", MISSING, {})).status).toBe(401);
  });

  it("consumed を sealed に戻し、紐付く記録は残る", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const id = await createOwnedBottle(ctx.app, a.cookie);
    expect((await consumeBottleReq(ctx.app, a.cookie, id, {})).status).toBe(200);

    const logRes = await ctx.app.request("/api/drink-logs", {
      method: "POST",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        drinkType: "wine",
        volumeMl: 125,
        abvPercent: 12,
        bottleId: id,
      }),
    });
    expect(logRes.status).toBe(201);
    const log = drinkLogSchema.parse(await logRes.json());
    expect(log.bottleId).toBe(id);

    const res = await restoreBottleReq(ctx.app, a.cookie, id, {});
    expect(res.status).toBe(200);
    const body = bottleSchema.parse(await res.json());
    expect(body.status).toBe("sealed");
    expect(body.consumedAt).toBeNull();
    expect(body.consumedOn).toBeNull();

    const remaining = drinkLogSchema.parse(
      await (
        await ctx.app.request(`/api/drink-logs/${log.id}`, { headers: { Cookie: a.cookie } })
      ).json(),
    );
    expect(remaining.bottleId).toBe(id);
    expect(remaining.drinkName).toBe("サンプル赤");

    const cellar = bottlesResponseSchema.parse(await (await getBottles(ctx.app, a.cookie)).json());
    expect(cellar.items.map((item) => item.id)).toEqual([id]);
    const archive = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "view=archive")).json(),
    );
    expect(archive.items).toHaveLength(0);
  });

  it("他人・不在・棚の本は同じ 404", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    const sealedId = await createOwnedBottle(ctx.app, a.cookie);
    const consumedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await seedConsumed(
      ctx,
      consumedId,
      a.id,
      "貯蔵庫の本",
      new Date("2026-09-01T00:00:00.000Z"),
      "2026-09-01",
    );

    const other = await restoreBottleReq(ctx.app, b.cookie, consumedId, {});
    const missing = await restoreBottleReq(ctx.app, a.cookie, MISSING, {});
    const sealed = await restoreBottleReq(ctx.app, a.cookie, sealedId, {});
    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(sealed.status).toBe(404);
    expect(await other.json()).toEqual(await missing.json());
    expect(
      bottleSchema.parse(await (await getBottle(ctx.app, a.cookie, consumedId)).json()).status,
    ).toBe("consumed");
  });
});

describe("PUT /api/bottles/order", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await putBottleOrder(app, "", { drinkType: "wine", bottleIds: [MISSING] });
    expect(res.status).toBe(401);
  });

  it("種類内の順を書き、drinkType 付き一覧がその順になる。新しい本は先頭", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const first = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { name: "先", drinkType: "wine" })).json(),
    ).items[0];
    const second = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { name: "後", drinkType: "wine" })).json(),
    ).items[0];
    await postBottle(ctx.app, a.cookie, { name: "ビール", drinkType: "beer" });
    expect(first && second).toBeTruthy();
    const before = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "drinkType=wine")).json(),
    );
    expect(before.items.map((item) => item.name)).toEqual(["後", "先"]);

    const ordered = await putBottleOrder(ctx.app, a.cookie, {
      drinkType: "wine",
      bottleIds: [first?.id, second?.id],
    });
    expect(ordered.status).toBe(200);
    expect(await ordered.json()).toEqual({ ok: true });

    const after = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "drinkType=wine")).json(),
    );
    expect(after.items.map((item) => item.name)).toEqual(["先", "後"]);
  });

  it("他人の id・consumed・他種類は 404。集合不足は 409", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);
    const mine = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { name: "自分1", drinkType: "wine" })).json(),
    ).items[0];
    const mine2 = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { name: "自分2", drinkType: "wine" })).json(),
    ).items[0];
    const beer = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { name: "ビール", drinkType: "beer" })).json(),
    ).items[0];
    const other = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, b.cookie, { name: "他人", drinkType: "wine" })).json(),
    ).items[0];
    await seedConsumed(
      ctx,
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      a.id,
      "開栓",
      new Date("2026-09-01T00:00:00.000Z"),
      "2026-09-01",
    );

    const foreign = await putBottleOrder(ctx.app, a.cookie, {
      drinkType: "wine",
      bottleIds: [mine?.id, other?.id],
    });
    expect(foreign.status).toBe(404);

    const wrongType = await putBottleOrder(ctx.app, a.cookie, {
      drinkType: "wine",
      bottleIds: [mine?.id, beer?.id],
    });
    expect(wrongType.status).toBe(404);

    const consumed = await putBottleOrder(ctx.app, a.cookie, {
      drinkType: "beer",
      bottleIds: ["ffffffff-ffff-4fff-8fff-ffffffffffff"],
    });
    expect(consumed.status).toBe(404);

    const otherUser = await putBottleOrder(ctx.app, b.cookie, {
      drinkType: "wine",
      bottleIds: [mine?.id],
    });
    expect(otherUser.status).toBe(404);
    expect(await foreign.json()).toEqual(await otherUser.json());

    const incomplete = await putBottleOrder(ctx.app, a.cookie, {
      drinkType: "wine",
      bottleIds: [mine?.id],
    });
    expect(incomplete.status).toBe(409);
    const conflict = apiErrorBodySchema.parse(await incomplete.json());
    expect(conflict.error).toBe("conflict");
    expect(conflict.conflict?.reason).toBe("set");

    const still = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "drinkType=wine")).json(),
    );
    expect(still.items.map((item) => item.id).toSorted()).toEqual([mine?.id, mine2?.id].toSorted());
  });

  it("種類なしの棚は createdAt 降順のまま。復元は種類の先頭", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const first = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { name: "先", drinkType: "wine" })).json(),
    ).items[0];
    const second = createBottlesResponseSchema.parse(
      await (await postBottle(ctx.app, a.cookie, { name: "後", drinkType: "wine" })).json(),
    ).items[0];
    await postBottle(ctx.app, a.cookie, { name: "ビール", drinkType: "beer" });
    expect(first && second).toBeTruthy();

    expect(
      (
        await putBottleOrder(ctx.app, a.cookie, {
          drinkType: "wine",
          bottleIds: [first?.id, second?.id],
        })
      ).status,
    ).toBe(200);

    const mixed = bottlesResponseSchema.parse(await (await getBottles(ctx.app, a.cookie)).json());
    expect(mixed.items.map((item) => item.name)).toEqual(["ビール", "後", "先"]);

    const typed = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "drinkType=wine")).json(),
    );
    expect(typed.items.map((item) => item.name)).toEqual(["先", "後"]);

    expect((await consumeBottleReq(ctx.app, a.cookie, second?.id ?? "", {})).status).toBe(200);
    await postBottle(ctx.app, a.cookie, { name: "新", drinkType: "wine" });
    expect((await restoreBottleReq(ctx.app, a.cookie, second?.id ?? "", {})).status).toBe(200);

    const restored = bottlesResponseSchema.parse(
      await (await getBottles(ctx.app, a.cookie, "drinkType=wine")).json(),
    );
    expect(restored.items.map((item) => item.name)).toEqual(["後", "新", "先"]);
  });
});
