import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { photos, tastingNotes } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { drinkLogSchema } from "@/shared/drink-logs.ts";
import { tastingNoteSchema, tastingNotesResponseSchema } from "@/shared/tasting-notes.ts";
import {
  createHandNote,
  deleteNote,
  getNote,
  getNotes,
  NOTE_HAND as HAND,
  NOTE_MISSING_ID as MISSING,
  NOTE_OTHER_BOTTLE as OTHER_BOTTLE,
  NOTE_OWN_BOTTLE as OWN_BOTTLE,
  patchDrinkLog,
  patchNote,
  postDrinkLog,
  postNote,
  seedOwnedBottle as seedBottle,
  noteSession as session,
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

describe("廃止した単独ノート API", () => {
  it("POST /api/tasting-notes と PATCH は置かない", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    expect((await postNote(ctx.app, a.cookie, HAND)).status).toBe(404);
    expect((await patchNote(ctx.app, a.cookie, MISSING, { ratingX10: 40 })).status).toBe(404);
  });
});

describe("POST /api/drink-logs tastingNote", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await postDrinkLog(app, "", {
      drinkType: "wine",
      volumeMl: 125,
      abvPercent: 12,
      tastingNote: { ratingX10: 45 },
    });
    expect(res.status).toBe(401);
  });

  it("評価必須。4 欄の空白は null。識別は親記録からコピーする", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const res = await postDrinkLog(ctx.app, a.cookie, {
      drinkType: "wine",
      drinkName: "サンプル赤",
      volumeMl: 125,
      abvPercent: 12,
      tastingNote: {
        ratingX10: 45,
        appearance: "  ",
        taste: "  酸がきれい  ",
      },
    });
    expect(res.status).toBe(201);
    const log = drinkLogSchema.parse(await res.json());
    expect(log.tastingNote).toMatchObject({
      ratingX10: 45,
      appearance: null,
      taste: "酸がきれい",
      photoCount: 0,
      thumbPhotoId: null,
    });
    const note = tastingNoteSchema.parse(
      await (await getNote(ctx.app, a.cookie, log.tastingNote?.id ?? "")).json(),
    );
    expect(note.drinkLogId).toBe(log.id);
    expect(note.drinkName).toBe("サンプル赤");
    expect(note.tastedOn).toBe(log.drunkOn);
    expect(note.drinkLog).toMatchObject({
      id: log.id,
      volumeMl: 125,
      abvPercent: 12,
      alcoholG: 12,
    });
    expect(JSON.stringify(note)).not.toContain("userId");
  });

  it("評価なしの tastingNote は 400。省略すれば飲酒だけ", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const missing = await postDrinkLog(ctx.app, a.cookie, {
      drinkType: "wine",
      volumeMl: 125,
      abvPercent: 12,
      tastingNote: { taste: "だけ" },
    });
    expect(missing.status).toBe(400);
    const missingFields = await fields(missing);
    expect(missingFields.ratingX10 ?? missingFields["tastingNote.ratingX10"]).toBeDefined();

    const drinkOnly = drinkLogSchema.parse(
      await (
        await postDrinkLog(ctx.app, a.cookie, {
          drinkType: "wine",
          volumeMl: 125,
          abvPercent: 12,
        })
      ).json(),
    );
    expect(drinkOnly.tastingNote).toBeNull();
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);
  });

  it("他人の写真は 404 でノートを作らない。自分の未紐付けは配列順", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const otherPhoto = await uploadPhoto(ctx.app, b.cookie);
    const first = await uploadPhoto(ctx.app, a.cookie);
    const second = await uploadPhoto(ctx.app, a.cookie);

    const forbidden = await postDrinkLog(ctx.app, a.cookie, {
      drinkType: "wine",
      drinkName: HAND.drinkName,
      volumeMl: 125,
      abvPercent: 12,
      tastingNote: { ratingX10: 45, photoIds: [otherPhoto.id] },
    });
    await notFoundBody(forbidden);
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);

    const created = drinkLogSchema.parse(
      await (
        await postDrinkLog(ctx.app, a.cookie, {
          drinkType: "wine",
          drinkName: HAND.drinkName,
          volumeMl: 125,
          abvPercent: 12,
          tastingNote: { ratingX10: 45, photoIds: [second.id, first.id] },
        })
      ).json(),
    );
    expect(created.tastingNote?.photos.map((photo) => photo.id)).toEqual([second.id, first.id]);
    expect(created.tastingNote?.thumbPhotoId).toBe(second.id);
    expect(created.tastingNote?.photoCount).toBe(2);
  });
});

describe("PATCH /api/drink-logs tastingNote", () => {
  it("オブジェクトは upsert。null はノートだけ削除。省略は識別を同期する", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const log = drinkLogSchema.parse(
      await (
        await postDrinkLog(ctx.app, a.cookie, {
          drinkType: "wine",
          drinkName: "初期",
          volumeMl: 125,
          abvPercent: 12,
        })
      ).json(),
    );
    const created = drinkLogSchema.parse(
      await (
        await patchDrinkLog(ctx.app, a.cookie, log.id, {
          tastingNote: { ratingX10: 40, taste: "最初" },
        })
      ).json(),
    );
    expect(created.tastingNote?.ratingX10).toBe(40);
    expect(created.tastingNote?.taste).toBe("最初");

    const upserted = drinkLogSchema.parse(
      await (
        await patchDrinkLog(ctx.app, a.cookie, log.id, {
          tastingNote: { ratingX10: 48, taste: "更新" },
        })
      ).json(),
    );
    expect(upserted.tastingNote?.id).toBe(created.tastingNote?.id);
    expect(upserted.tastingNote?.ratingX10).toBe(48);

    const synced = drinkLogSchema.parse(
      await (await patchDrinkLog(ctx.app, a.cookie, log.id, { drinkName: "改名" })).json(),
    );
    expect(synced.tastingNote?.id).toBe(created.tastingNote?.id);
    const afterName = tastingNoteSchema.parse(
      await (await getNote(ctx.app, a.cookie, created.tastingNote?.id ?? "")).json(),
    );
    expect(afterName.drinkName).toBe("改名");

    const cleared = drinkLogSchema.parse(
      await (await patchDrinkLog(ctx.app, a.cookie, log.id, { tastingNote: null })).json(),
    );
    expect(cleared.tastingNote).toBeNull();
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);
    expect(
      (await ctx.app.request(`/api/drink-logs/${log.id}`, { headers: { Cookie: a.cookie } }))
        .status,
    ).toBe(200);
  });

  it("他人・不在の記録は同じ 404", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const log = drinkLogSchema.parse(
      await (
        await postDrinkLog(ctx.app, a.cookie, {
          drinkType: "wine",
          volumeMl: 125,
          abvPercent: 12,
        })
      ).json(),
    );
    await notFoundBody(
      await patchDrinkLog(ctx.app, b.cookie, log.id, { tastingNote: { ratingX10: 40 } }),
    );
    await notFoundBody(
      await patchDrinkLog(ctx.app, a.cookie, MISSING, { tastingNote: { ratingX10: 40 } }),
    );
  });
});

describe("GET /api/tasting-notes", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    expect((await getNotes(app, "")).status).toBe(401);
  });

  it("本人の行だけを tastedOn 降順で返し、drinkLogId を載せる", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const older = await createHandNote(ctx.app, a.cookie, {
      drinkName: "古い赤",
      tastedOn: "2026-08-01",
      ratingX10: 30,
    });
    const newer = await createHandNote(ctx.app, a.cookie, {
      drinkName: "新しい麦",
      drinkType: "beer",
      tastedOn: "2026-08-20",
      ratingX10: 45,
    });
    await createHandNote(ctx.app, b.cookie, { drinkName: "他人" });

    const all = tastingNotesResponseSchema.parse(await (await getNotes(ctx.app, a.cookie)).json());
    expect(all.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(all.items[0]?.drinkLogId).toBe(newer.drinkLogId);
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
    await createHandNote(ctx.app, a.cookie, { drinkName: "100%_赤", tastedOn: "2026-07-01" });
    await createHandNote(ctx.app, a.cookie, {
      bottleId: OWN_BOTTLE,
      tastedOn: "2026-07-02",
      ratingX10: 40,
    });
    await createHandNote(ctx.app, a.cookie, { drinkName: "三本目", tastedOn: "2026-07-03" });

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

describe("GET / DELETE /api/tasting-notes/:id", () => {
  it("本人は 200、他人・不在は同じ 404。不正 ID は 400", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const created = await createHandNote(ctx.app, a.cookie, HAND);

    const own = await getNote(ctx.app, a.cookie, created.id);
    expect(own.status).toBe(200);
    expect(tastingNoteSchema.parse(await own.json()).id).toBe(created.id);

    await notFoundBody(await getNote(ctx.app, b.cookie, created.id));
    await notFoundBody(await getNote(ctx.app, a.cookie, MISSING));
    expect((await getNote(ctx.app, a.cookie, "not-a-uuid")).status).toBe(400);
    expect((await getNote(ctx.app, "", created.id)).status).toBe(401);
  });

  it("DELETE は本人だけ。他人・不在は 404。記録は残る", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const created = await createHandNote(ctx.app, a.cookie, HAND);
    const photo = await uploadPhoto(ctx.app, a.cookie);
    await patchDrinkLog(ctx.app, a.cookie, created.drinkLogId, {
      tastingNote: { ratingX10: 45, photoIds: [photo.id] },
    });

    await notFoundBody(await deleteNote(ctx.app, b.cookie, created.id));
    expect((await getNote(ctx.app, a.cookie, created.id)).status).toBe(200);

    const deleted = await deleteNote(ctx.app, a.cookie, created.id);
    expect(deleted.status).toBe(200);
    expect(await ctx.db.select().from(tastingNotes)).toHaveLength(0);
    expect(
      (
        await ctx.app.request(`/api/drink-logs/${created.drinkLogId}`, {
          headers: { Cookie: a.cookie },
        })
      ).status,
    ).toBe(200);
    expect((await ctx.db.select().from(photos).where(eq(photos.id, photo.id))).length).toBe(0);

    await notFoundBody(await deleteNote(ctx.app, a.cookie, created.id));
  });
});
