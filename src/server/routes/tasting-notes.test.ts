import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { bottles, photos, tastingNotes } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { photoMetaSchema } from "@/shared/photos.ts";
import {
  TASTING_NOTE_MESSAGES,
  tastingNoteSchema,
  tastingNotesResponseSchema,
} from "@/shared/tasting-notes.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { makeJpeg } from "../image-fixtures.ts";
import { createTestApp, createTestUser } from "../test-helpers.ts";

type Ctx = Awaited<ReturnType<typeof createTestApp>>;

const TODAY = tokyoToday();
const OWN_BOTTLE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_BOTTLE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MISSING = "99999999-9999-4999-8999-999999999999";
const HAND = {
  drinkName: "サンプル赤",
  drinkType: "wine",
  tastedOn: TODAY,
  ratingX10: 45,
} as const;

async function session(app: Ctx["app"], email: string) {
  const user = await createTestUser(app, {
    name: email.split("@")[0] ?? "user",
    email,
    password: "password1",
  });
  return { cookie: user.cookie, userId: user.id };
}

function postNote(app: Ctx["app"], cookie: string, body: unknown) {
  return app.request("/api/tasting-notes", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getNotes(app: Ctx["app"], cookie: string, search = "") {
  const suffix = search ? `?${search}` : "";
  return app.request(`/api/tasting-notes${suffix}`, { headers: { Cookie: cookie } });
}

function patchNote(app: Ctx["app"], cookie: string, id: string, body: unknown) {
  return app.request(`/api/tasting-notes/${id}`, {
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

async function seedBottle(
  ctx: Ctx,
  id: string,
  userId: string,
  name: string,
  status: "sealed" | "consumed" = "sealed",
) {
  const now = new Date();
  await ctx.db.insert(bottles).values({
    id,
    userId,
    name,
    drinkType: "beer",
    status,
    createdAt: now,
    updatedAt: now,
  });
}

async function fields(res: Response) {
  const body = apiErrorBodySchema.parse(await res.json());
  expect(body.error).toBe("validation_error");
  return body.fields ?? {};
}

describe("POST /api/tasting-notes", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await postNote(app, "", HAND);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("手入力の評価と銘柄で 201。4 欄の空白は null。userId は出さない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const res = await postNote(ctx.app, a.cookie, {
      ...HAND,
      appearance: "  ",
      taste: "  酸がきれい  ",
    });
    expect(res.status).toBe(201);
    const body = tastingNoteSchema.parse(await res.json());
    expect(body).toMatchObject({
      drinkName: "サンプル赤",
      drinkType: "wine",
      tastedOn: TODAY,
      ratingX10: 45,
      appearance: null,
      taste: "酸がきれい",
      bottleId: null,
      bottle: null,
      photos: [],
      photoCount: 0,
      thumbPhotoId: null,
    });
    expect(JSON.stringify(body)).not.toContain("userId");
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(1);
  });

  it("ボトルありはスナップショットをコピーし、送った銘柄は無視する。他人・不明は 404", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    await seedBottle(ctx, OWN_BOTTLE, a.userId, "棚の赤");
    await seedBottle(ctx, OTHER_BOTTLE, b.userId, "他人の瓶");

    const own = await postNote(ctx.app, a.cookie, {
      bottleId: OWN_BOTTLE,
      drinkName: "無視される",
      drinkType: "wine",
      tastedOn: TODAY,
      ratingX10: 40,
    });
    expect(own.status).toBe(201);
    const body = tastingNoteSchema.parse(await own.json());
    expect(body.drinkName).toBe("棚の赤");
    expect(body.drinkType).toBe("beer");
    expect(body.bottle).toEqual({ id: OWN_BOTTLE, name: "棚の赤", status: "sealed" });

    expect((await postNote(ctx.app, a.cookie, { ...HAND, bottleId: OTHER_BOTTLE })).status).toBe(
      404,
    );
    expect((await postNote(ctx.app, a.cookie, { ...HAND, bottleId: MISSING })).status).toBe(404);
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(1);
  });

  it("評価 3.3 / 未来日 / 7 枚は 400。ノートは作らない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const rating = await postNote(ctx.app, a.cookie, { ...HAND, ratingX10: 3.3 });
    expect(rating.status).toBe(400);
    expect((await fields(rating)).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);

    const future = await postNote(ctx.app, a.cookie, { ...HAND, tastedOn: "2099-01-01" });
    expect((await fields(future)).tastedOn).toEqual([TASTING_NOTE_MESSAGES.tastedOnFuture]);

    const seven = await postNote(ctx.app, a.cookie, {
      ...HAND,
      photoIds: [
        "11111111-1111-4111-8111-111111111110",
        "11111111-1111-4111-8111-111111111111",
        "11111111-1111-4111-8111-111111111112",
        "11111111-1111-4111-8111-111111111113",
        "11111111-1111-4111-8111-111111111114",
        "11111111-1111-4111-8111-111111111115",
        "11111111-1111-4111-8111-111111111116",
      ],
    });
    expect((await fields(seven)).photoIds).toEqual([TASTING_NOTE_MESSAGES.photoIdsMax]);
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);
  });

  it("他人の写真は 404 でノートを作らない。自分の未紐付けは配列順で紐付く", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const otherPhoto = await uploadPhoto(ctx.app, b.cookie);
    const first = await uploadPhoto(ctx.app, a.cookie);
    const second = await uploadPhoto(ctx.app, a.cookie);

    const forbidden = await postNote(ctx.app, a.cookie, { ...HAND, photoIds: [otherPhoto.id] });
    expect(forbidden.status).toBe(404);
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);

    const created = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, { ...HAND, photoIds: [second.id, first.id] })
      ).json(),
    );
    expect(created.photos.map((photo) => photo.id)).toEqual([second.id, first.id]);
    expect(created.photos[0]?.sortOrder).toBe(0);
    expect(created.thumbPhotoId).toBe(second.id);
    expect(created.photoCount).toBe(2);
  });
});

describe("GET /api/tasting-notes", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    expect((await getNotes(app, "")).status).toBe(401);
  });

  it("本人の行だけを tastedOn 降順で返し、検索はスナップショット。他人は混ざらない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const older = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, {
          ...HAND,
          drinkName: "古い赤",
          tastedOn: "2026-08-01",
          ratingX10: 30,
        })
      ).json(),
    );
    const newer = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, {
          ...HAND,
          drinkName: "新しい麦",
          drinkType: "beer",
          tastedOn: "2026-08-20",
          ratingX10: 45,
        })
      ).json(),
    );
    await postNote(ctx.app, b.cookie, { ...HAND, drinkName: "他人" });

    const all = tastingNotesResponseSchema.parse(await (await getNotes(ctx.app, a.cookie)).json());
    expect(all.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(all.totalCount).toBe(2);
    expect(JSON.stringify(all)).not.toContain("userId");

    const searched = tastingNotesResponseSchema.parse(
      await (await getNotes(ctx.app, a.cookie, "q=赤")).json(),
    );
    expect(searched.items.map((item) => item.drinkName)).toEqual(["古い赤"]);
    expect(searched.totalCount).toBe(2);

    const typed = tastingNotesResponseSchema.parse(
      await (await getNotes(ctx.app, a.cookie, "drinkType=beer&ratingX10Min=40")).json(),
    );
    expect(typed.items.map((item) => item.id)).toEqual([newer.id]);
  });

  it("検索の % と _ はリテラル。bottleId が他人なら 404。cursor で続きを取る", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    await seedBottle(ctx, OWN_BOTTLE, a.userId, "自分の赤");
    await seedBottle(ctx, OTHER_BOTTLE, b.userId, "他人の赤");
    await postNote(ctx.app, a.cookie, { ...HAND, drinkName: "100%_赤", tastedOn: "2026-07-01" });
    await postNote(ctx.app, a.cookie, {
      ...HAND,
      bottleId: OWN_BOTTLE,
      tastedOn: "2026-07-02",
      ratingX10: 40,
    });
    await postNote(ctx.app, a.cookie, { ...HAND, drinkName: "三本目", tastedOn: "2026-07-03" });

    const literal = tastingNotesResponseSchema.parse(
      await (await getNotes(ctx.app, a.cookie, "q=100%_赤")).json(),
    );
    expect(literal.items).toHaveLength(1);
    expect(literal.items[0]?.drinkName).toBe("100%_赤");

    expect((await getNotes(ctx.app, a.cookie, `bottleId=${OTHER_BOTTLE}`)).status).toBe(404);

    const ownBottle = tastingNotesResponseSchema.parse(
      await (await getNotes(ctx.app, a.cookie, `bottleId=${OWN_BOTTLE}`)).json(),
    );
    expect(ownBottle.items).toHaveLength(1);
    expect(ownBottle.totalCount).toBe(1);

    const first = tastingNotesResponseSchema.parse(
      await (await getNotes(ctx.app, a.cookie, "limit=2")).json(),
    );
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = tastingNotesResponseSchema.parse(
      await (
        await getNotes(
          ctx.app,
          a.cookie,
          `limit=2&cursor=${encodeURIComponent(first.nextCursor ?? "")}`,
        )
      ).json(),
    );
    expect(second.items).toHaveLength(1);
    expect(second.totalCount).toBe(3);
    expect(second.nextCursor).toBeNull();
    expect((await getNotes(ctx.app, a.cookie, "cursor=broken")).status).toBe(400);
  });
});

describe("GET / PATCH / DELETE /api/tasting-notes/:id", () => {
  it("本人は 200、他人・不在は同じ 404。不正 ID は 400", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const created = tastingNoteSchema.parse(await (await postNote(ctx.app, a.cookie, HAND)).json());

    const own = await ctx.app.request(`/api/tasting-notes/${created.id}`, {
      headers: { Cookie: a.cookie },
    });
    expect(own.status).toBe(200);
    expect(tastingNoteSchema.parse(await own.json()).id).toBe(created.id);

    const other = await ctx.app.request(`/api/tasting-notes/${created.id}`, {
      headers: { Cookie: b.cookie },
    });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: "not_found" });

    expect(
      (
        await ctx.app.request("/api/tasting-notes/not-a-uuid", {
          headers: { Cookie: a.cookie },
        })
      ).status,
    ).toBe(400);
  });

  it("PATCH は変えた欄だけ。bottleId null は銘柄必須。他人は 404 で変わらない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    await seedBottle(ctx, OWN_BOTTLE, a.userId, "棚の赤", "consumed");
    const created = tastingNoteSchema.parse(
      await (await postNote(ctx.app, a.cookie, { ...HAND, taste: "一言" })).json(),
    );

    expect((await patchNote(ctx.app, "", created.id, { ratingX10: 50 })).status).toBe(401);
    expect((await patchNote(ctx.app, a.cookie, created.id, {})).status).toBe(400);

    const attached = tastingNoteSchema.parse(
      await (await patchNote(ctx.app, a.cookie, created.id, { bottleId: OWN_BOTTLE })).json(),
    );
    expect(attached.drinkName).toBe("棚の赤");
    expect(attached.drinkType).toBe("beer");
    expect(attached.bottle?.status).toBe("consumed");
    expect(attached.taste).toBe("一言");

    const detached = tastingNoteSchema.parse(
      await (
        await patchNote(ctx.app, a.cookie, created.id, {
          bottleId: null,
          drinkName: "都度",
          drinkType: "whisky",
        })
      ).json(),
    );
    expect(detached.bottleId).toBeNull();
    expect(detached.drinkName).toBe("都度");
    expect(detached.drinkType).toBe("whisky");

    const other = await patchNote(ctx.app, b.cookie, created.id, { ratingX10: 10 });
    expect(other.status).toBe(404);
    const again = tastingNoteSchema.parse(
      await (
        await ctx.app.request(`/api/tasting-notes/${created.id}`, {
          headers: { Cookie: a.cookie },
        })
      ).json(),
    );
    expect(again.ratingX10).toBe(45);
  });

  it("PATCH photoIds 空配列は既存写真を外して削除する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const photo = await uploadPhoto(ctx.app, a.cookie);
    const created = tastingNoteSchema.parse(
      await (await postNote(ctx.app, a.cookie, { ...HAND, photoIds: [photo.id] })).json(),
    );
    expect(created.photoCount).toBe(1);

    const cleared = tastingNoteSchema.parse(
      await (await patchNote(ctx.app, a.cookie, created.id, { photoIds: [] })).json(),
    );
    expect(cleared.photos).toEqual([]);
    expect(cleared.photoCount).toBe(0);
    expect(await ctx.db.select().from(photos).where(eq(photos.id, photo.id))).toHaveLength(0);
  });

  it("削除は本人だけ。他人は 404 で残る", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const photo = await uploadPhoto(ctx.app, a.cookie);
    const created = tastingNoteSchema.parse(
      await (await postNote(ctx.app, a.cookie, { ...HAND, photoIds: [photo.id] })).json(),
    );

    const other = await ctx.app.request(`/api/tasting-notes/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: b.cookie },
    });
    expect(other.status).toBe(404);
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(1);

    const own = await ctx.app.request(`/api/tasting-notes/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: a.cookie },
    });
    expect(own.status).toBe(200);
    expect(await own.json()).toEqual({ ok: true });
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);
    expect(await ctx.db.select().from(photos).where(eq(photos.id, photo.id))).toHaveLength(0);
  });
});
