import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { photos, tastingNotes } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import {
  TASTING_NOTE_MESSAGES,
  tastingNoteSchema,
  tastingNotesResponseSchema,
} from "@/shared/tasting-notes.ts";
import {
  createHandNote,
  deleteNote,
  getNote,
  getNotes,
  NOTE_HAND as HAND,
  NOTE_MISSING_ID as MISSING,
  NOTE_OTHER_BOTTLE as OTHER_BOTTLE,
  NOTE_OWN_BOTTLE as OWN_BOTTLE,
  patchNote,
  postNote,
  seedOwnedBottle as seedBottle,
  noteSession as session,
  NOTE_TODAY as TODAY,
  uploadNotePhoto as uploadPhoto,
} from "../tasting-note-factory.ts";
import { createTestApp } from "../test-helpers.ts";

async function fields(res: Response) {
  const body = apiErrorBodySchema.parse(await res.json());
  expect(body.error).toBe("validation_error");
  return body.fields ?? {};
}

async function notFoundBody(res: Response) {
  expect(res.status).toBe(404);
  expect(res.status).not.toBe(403);
  expect(await res.json()).toEqual({ error: "not_found" });
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
      vintage: null,
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

  it("ボトルありでも明示した品名・種類はスナップショットする。他人・不明は 404", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    await seedBottle(ctx, OWN_BOTTLE, a.userId, "棚の赤");
    await seedBottle(ctx, OTHER_BOTTLE, b.userId, "他人の瓶");

    const own = await postNote(ctx.app, a.cookie, {
      bottleId: OWN_BOTTLE,
      drinkName: "手入力赤",
      drinkType: "wine",
      tastedOn: TODAY,
      ratingX10: 40,
    });
    expect(own.status).toBe(201);
    const body = tastingNoteSchema.parse(await own.json());
    expect(body.drinkName).toBe("手入力赤");
    expect(body.drinkType).toBe("wine");
    expect(body.bottle).toEqual({ id: OWN_BOTTLE, name: "棚の赤", status: "sealed" });

    const fallback = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, {
          bottleId: OWN_BOTTLE,
          tastedOn: TODAY,
          ratingX10: 40,
        })
      ).json(),
    );
    expect(fallback.drinkName).toBe("棚の赤");
    expect(fallback.drinkType).toBe("beer");

    expect((await postNote(ctx.app, a.cookie, { ...HAND, bottleId: OTHER_BOTTLE })).status).toBe(
      404,
    );
    expect((await postNote(ctx.app, a.cookie, { ...HAND, bottleId: MISSING })).status).toBe(404);
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(2);
  });

  it("ビンテージは任意。作成と PATCH で保存する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const created = tastingNoteSchema.parse(
      await (await postNote(ctx.app, a.cookie, { ...HAND, vintage: 2018 })).json(),
    );
    expect(created.vintage).toBe(2018);
    const patched = tastingNoteSchema.parse(
      await (await patchNote(ctx.app, a.cookie, created.id, { vintage: 2020 })).json(),
    );
    expect(patched.vintage).toBe(2020);
    const cleared = tastingNoteSchema.parse(
      await (await patchNote(ctx.app, a.cookie, created.id, { vintage: null })).json(),
    );
    expect(cleared.vintage).toBeNull();
  });

  it("識別3項目は任意。ボトル省略時はボトルからコピーし、ボディがあれば採用する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const hand = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, {
          ...HAND,
          producer: "手の生産者",
          origin: "日本",
          variety: "山田錦",
        })
      ).json(),
    );
    expect(hand.producer).toBe("手の生産者");
    expect(hand.origin).toBe("日本");
    expect(hand.variety).toBe("山田錦");

    await seedBottle(ctx, OWN_BOTTLE, a.userId, "棚の赤", "sealed", "beer", {
      producer: "瓶の生産者",
      origin: "フランス",
      variety: "ピノ",
      vintage: 2017,
    });
    const snapped = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, {
          bottleId: OWN_BOTTLE,
          tastedOn: TODAY,
          ratingX10: 40,
        })
      ).json(),
    );
    expect(snapped.producer).toBe("瓶の生産者");
    expect(snapped.origin).toBe("フランス");
    expect(snapped.variety).toBe("ピノ");
    expect(snapped.vintage).toBe(2017);

    const overridden = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, {
          bottleId: OWN_BOTTLE,
          tastedOn: TODAY,
          ratingX10: 40,
          producer: "上書き",
          vintage: 2021,
        })
      ).json(),
    );
    expect(overridden.producer).toBe("上書き");
    expect(overridden.origin).toBe("フランス");
    expect(overridden.vintage).toBe(2021);
  });

  it("生産国の不正値は 400。既存不正値は無関係な PATCH で残す", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const invalid = await postNote(ctx.app, a.cookie, { ...HAND, origin: "DOCG" });
    expect(invalid.status).toBe(400);
    expect((await fields(invalid)).origin).toBeDefined();

    const created = tastingNoteSchema.parse(
      await (await postNote(ctx.app, a.cookie, { ...HAND, origin: "France" })).json(),
    );
    expect(created.origin).toBe("フランス");

    const now = new Date();
    const staleId = crypto.randomUUID();
    await ctx.db.insert(tastingNotes).values({
      id: staleId,
      userId: a.userId,
      drinkName: "旧ノート",
      drinkType: "wine",
      origin: "DOCG",
      tastedOn: TODAY,
      ratingX10: 40,
      createdAt: now,
      updatedAt: now,
    });
    const kept = tastingNoteSchema.parse(
      await (await patchNote(ctx.app, a.cookie, staleId, { taste: "メモだけ" })).json(),
    );
    expect(kept.origin).toBe("DOCG");
    expect(kept.taste).toBe("メモだけ");
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

  it("T6: bottleId と limit=3 は最新 3 件、totalCount は総数。貯蔵庫も可。他人は 404", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const archiveId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await seedBottle(ctx, OWN_BOTTLE, a.userId, "棚の赤");
    await seedBottle(ctx, archiveId, a.userId, "貯蔵庫の赤", "consumed");
    await seedBottle(ctx, OTHER_BOTTLE, b.userId, "他人の赤");
    for (const day of ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"]) {
      expect(
        (
          await postNote(ctx.app, a.cookie, {
            ...HAND,
            bottleId: OWN_BOTTLE,
            tastedOn: day,
            ratingX10: 40,
          })
        ).status,
      ).toBe(201);
    }
    expect(
      (
        await postNote(ctx.app, a.cookie, {
          ...HAND,
          bottleId: archiveId,
          tastedOn: "2026-08-05",
          ratingX10: 50,
        })
      ).status,
    ).toBe(201);

    const preview = tastingNotesResponseSchema.parse(
      await (await getNotes(ctx.app, a.cookie, `bottleId=${OWN_BOTTLE}&limit=3`)).json(),
    );
    expect(preview.items).toHaveLength(3);
    expect(preview.totalCount).toBe(4);
    expect(preview.items.map((item) => item.tastedOn)).toEqual([
      "2026-08-04",
      "2026-08-03",
      "2026-08-02",
    ]);

    const archived = tastingNotesResponseSchema.parse(
      await (await getNotes(ctx.app, a.cookie, `bottleId=${archiveId}`)).json(),
    );
    expect(archived.items).toHaveLength(1);
    expect(archived.totalCount).toBe(1);

    expect((await getNotes(ctx.app, a.cookie, `bottleId=${OTHER_BOTTLE}&limit=3`)).status).toBe(
      404,
    );
    expect((await getNotes(ctx.app, b.cookie, `bottleId=${OWN_BOTTLE}&limit=3`)).status).toBe(404);
    expect((await getNotes(ctx.app, "", `bottleId=${OWN_BOTTLE}&limit=3`)).status).toBe(401);
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

  it("6 枚は配列順で紐付き、7 枚目は 400。他人・他ノートの id は 404 で差し替えない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const six = [];
    for (let i = 0; i < 6; i += 1) {
      six.push(await uploadPhoto(ctx.app, a.cookie));
    }
    const created = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, {
          ...HAND,
          photoIds: six.map((photo) => photo.id),
        })
      ).json(),
    );
    expect(created.photos.map((photo) => photo.id)).toEqual(six.map((photo) => photo.id));
    expect(created.photos.map((photo) => photo.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(created.thumbPhotoId).toBe(six[0]?.id);
    expect(created.photoCount).toBe(6);

    const seventh = await uploadPhoto(ctx.app, a.cookie);
    const over = await patchNote(ctx.app, a.cookie, created.id, {
      photoIds: [...six.map((photo) => photo.id), seventh.id],
    });
    expect(over.status).toBe(400);
    expect((await fields(over)).photoIds).toEqual([TASTING_NOTE_MESSAGES.photoIdsMax]);

    const otherNote = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, {
          ...HAND,
          drinkName: "別ノート",
          photoIds: [(await uploadPhoto(ctx.app, a.cookie)).id],
        })
      ).json(),
    );
    const foreign = await uploadPhoto(ctx.app, b.cookie);
    const stolen = await patchNote(ctx.app, a.cookie, created.id, {
      photoIds: [foreign.id],
    });
    expect(stolen.status).toBe(404);
    const linkedElsewhere = await patchNote(ctx.app, a.cookie, created.id, {
      photoIds: [otherNote.photos[0]?.id],
    });
    expect(linkedElsewhere.status).toBe(404);
    const unchanged = tastingNoteSchema.parse(
      await (
        await ctx.app.request(`/api/tasting-notes/${created.id}`, {
          headers: { Cookie: a.cookie },
        })
      ).json(),
    );
    expect(unchanged.photos.map((photo) => photo.id)).toEqual(six.map((photo) => photo.id));
  });

  it("PATCH photoIds 差し替えは外れた写真を消し、残した写真の sortOrder を配列順にする", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const first = await uploadPhoto(ctx.app, a.cookie);
    const second = await uploadPhoto(ctx.app, a.cookie);
    const created = tastingNoteSchema.parse(
      await (
        await postNote(ctx.app, a.cookie, { ...HAND, photoIds: [first.id, second.id] })
      ).json(),
    );
    const replacement = await uploadPhoto(ctx.app, a.cookie);
    const updated = tastingNoteSchema.parse(
      await (
        await patchNote(ctx.app, a.cookie, created.id, {
          photoIds: [replacement.id, second.id],
        })
      ).json(),
    );
    expect(updated.photos.map((photo) => photo.id)).toEqual([replacement.id, second.id]);
    expect(updated.photos.map((photo) => photo.sortOrder)).toEqual([0, 1]);
    expect(updated.thumbPhotoId).toBe(replacement.id);
    expect(await ctx.db.select().from(photos).where(eq(photos.id, first.id))).toHaveLength(0);
    expect(await ctx.db.select().from(photos).where(eq(photos.id, second.id))).toHaveLength(1);
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

    const own = await deleteNote(ctx.app, a.cookie, created.id);
    expect(own.status).toBe(200);
    expect(await own.json()).toEqual({ ok: true });
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);
    expect(await ctx.db.select().from(photos).where(eq(photos.id, photo.id))).toHaveLength(0);
  });
});

describe("5-05 認可とバリデーションのギャップ", () => {
  it("GET / DELETE :id の未認証は 401。他人と不在は同じ 404 で 403 にしない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const created = await createHandNote(ctx.app, a.cookie);

    const getUnauth = await getNote(ctx.app, "", created.id);
    expect(getUnauth.status).toBe(401);
    expect(await getUnauth.json()).toEqual({ error: "unauthorized" });

    const deleteUnauth = await deleteNote(ctx.app, "", created.id);
    expect(deleteUnauth.status).toBe(401);
    expect(await deleteUnauth.json()).toEqual({ error: "unauthorized" });

    await notFoundBody(await getNote(ctx.app, b.cookie, created.id));
    await notFoundBody(await getNote(ctx.app, a.cookie, MISSING));
    await notFoundBody(await patchNote(ctx.app, b.cookie, created.id, { ratingX10: 10 }));
    await notFoundBody(await deleteNote(ctx.app, b.cookie, created.id));
    await notFoundBody(await deleteNote(ctx.app, a.cookie, MISSING));

    const stillThere = tastingNoteSchema.parse(
      await (await getNote(ctx.app, a.cookie, created.id)).json(),
    );
    expect(stillThere.ratingX10).toBe(45);
  });

  it("評価 5.1 / 1.2 は POST / PATCH とも 400。ノートは作らない・変えない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");

    const post51 = await postNote(ctx.app, a.cookie, { ...HAND, ratingX10: 5.1 });
    expect(post51.status).toBe(400);
    expect((await fields(post51)).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);

    const post12 = await postNote(ctx.app, a.cookie, { ...HAND, ratingX10: 1.2 });
    expect(post12.status).toBe(400);
    expect((await fields(post12)).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);

    const created = await createHandNote(ctx.app, a.cookie);
    const patch51 = await patchNote(ctx.app, a.cookie, created.id, { ratingX10: 5.1 });
    expect(patch51.status).toBe(400);
    expect((await fields(patch51)).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);

    const patch12 = await patchNote(ctx.app, a.cookie, created.id, { ratingX10: 1.2 });
    expect(patch12.status).toBe(400);
    expect((await fields(patch12)).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);

    const again = tastingNoteSchema.parse(
      await (await getNote(ctx.app, a.cookie, created.id)).json(),
    );
    expect(again.ratingX10).toBe(45);
  });

  it("一覧クエリの不正値は 400。不明 bottleId は 404", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");

    const drinkType = await getNotes(ctx.app, a.cookie, "drinkType=evil");
    expect(drinkType.status).toBe(400);
    expect((await fields(drinkType)).drinkType).toBeDefined();

    const ratingMin = await getNotes(ctx.app, a.cookie, "ratingX10Min=51");
    expect(ratingMin.status).toBe(400);
    expect((await fields(ratingMin)).ratingX10Min).toContain(TASTING_NOTE_MESSAGES.ratingRange);

    const ratingStep = await getNotes(ctx.app, a.cookie, "ratingX10Min=12");
    expect(ratingStep.status).toBe(400);
    expect((await fields(ratingStep)).ratingX10Min).toContain(TASTING_NOTE_MESSAGES.ratingRange);

    const limitLow = await getNotes(ctx.app, a.cookie, "limit=0");
    expect(limitLow.status).toBe(400);
    expect((await fields(limitLow)).limit).toEqual([TASTING_NOTE_MESSAGES.limit]);

    const limitHigh = await getNotes(ctx.app, a.cookie, "limit=101");
    expect(limitHigh.status).toBe(400);
    expect((await fields(limitHigh)).limit).toEqual([TASTING_NOTE_MESSAGES.limit]);

    const q = await getNotes(ctx.app, a.cookie, `q=${"あ".repeat(101)}`);
    expect(q.status).toBe(400);
    expect((await fields(q)).q).toEqual([TASTING_NOTE_MESSAGES.q]);

    await notFoundBody(await getNotes(ctx.app, a.cookie, `bottleId=${MISSING}`));
  });

  it("PATCH 他人 bottleId は 404 で変わらない。userId キーは 400", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    await seedBottle(ctx, OTHER_BOTTLE, b.userId, "他人の瓶");
    const created = await createHandNote(ctx.app, a.cookie);

    await notFoundBody(await patchNote(ctx.app, a.cookie, created.id, { bottleId: OTHER_BOTTLE }));
    const again = tastingNoteSchema.parse(
      await (await getNote(ctx.app, a.cookie, created.id)).json(),
    );
    expect(again.bottleId).toBeNull();
    expect(again.drinkName).toBe("サンプル赤");

    const leaked = await patchNote(ctx.app, a.cookie, created.id, {
      ratingX10: 50,
      userId: b.userId,
    });
    expect(leaked.status).toBe(400);
    expect((await fields(leaked))[""]).toBeDefined();
  });

  it("4 欄 2001 文字と重複 photoIds は 400", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const tooLong = await postNote(ctx.app, a.cookie, {
      ...HAND,
      appearance: "あ".repeat(2001),
    });
    expect(tooLong.status).toBe(400);
    expect((await fields(tooLong)).appearance).toEqual([TASTING_NOTE_MESSAGES.noteText]);

    const duplicate = await postNote(ctx.app, a.cookie, {
      ...HAND,
      photoIds: [MISSING, MISSING],
    });
    expect(duplicate.status).toBe(400);
    expect((await fields(duplicate)).photoIds).toEqual([TASTING_NOTE_MESSAGES.photoIdsDuplicate]);
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);
  });

  it("ratingX10Max は上限フィルタになる", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    await createHandNote(ctx.app, a.cookie, {
      drinkName: "低",
      ratingX10: 30,
      tastedOn: "2026-08-01",
    });
    await createHandNote(ctx.app, a.cookie, {
      drinkName: "中",
      ratingX10: 40,
      tastedOn: "2026-08-02",
    });
    await createHandNote(ctx.app, a.cookie, {
      drinkName: "高",
      ratingX10: 45,
      tastedOn: "2026-08-03",
    });

    const capped = tastingNotesResponseSchema.parse(
      await (await getNotes(ctx.app, a.cookie, "ratingX10Max=40")).json(),
    );
    expect(capped.items.map((item) => item.drinkName)).toEqual(["中", "低"]);
    expect(capped.totalCount).toBe(3);
  });
});
