import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { bottles, photos } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import { photoMetaSchema } from "@/shared/photos.ts";
import { makeGif, makeHeic, makeJpeg, makeSvg, makeWebpVp8x } from "../image-fixtures.ts";
import { cookieHeaderFrom, createTestApp, signUp } from "../test-helpers.ts";

async function session(app: Awaited<ReturnType<typeof createTestApp>>["app"], email: string) {
  const res = await signUp(app, {
    name: email.split("@")[0] ?? "user",
    email,
    password: "password1",
  });
  expect(res.status).toBe(200);
  const me = await app.request("/api/me", { headers: { Cookie: cookieHeaderFrom(res) } });
  const body = (await me.json()) as { id: string };
  return { cookie: cookieHeaderFrom(res), userId: body.id };
}

function postPhoto(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  cookie: string,
  bytes: Uint8Array,
  fields: Record<string, string> = {},
  fileName = "shot.jpg",
  type = "image/jpeg",
) {
  const form = new FormData();
  const copy = Uint8Array.from(bytes);
  form.set("file", new File([copy], fileName, { type }));
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return app.request("/api/photos", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
}

describe("POST /api/photos", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await postPhoto(app, "", makeJpeg(100, 100));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("未紐付け JPEG を 201 で返し r2Key を出さない", async () => {
    const { app, photos: bucket } = await createTestApp();
    const { cookie } = await session(app, "a@example.com");
    const res = await postPhoto(app, cookie, makeJpeg(640, 800));
    expect(res.status).toBe(201);
    const body = photoMetaSchema.parse(await res.json());
    expect(body.kind).toBe("photo");
    expect(body.contentType).toBe("image/jpeg");
    expect(body.bottleId).toBeNull();
    expect(JSON.stringify(body)).not.toContain("r2Key");
    expect(JSON.stringify(body)).not.toContain("userId");
    expect(bucket.keys()).toEqual([`${body.id}.jpg`]);
  });

  it("WebP + alpha は kind=cutout", async () => {
    const { app } = await createTestApp();
    const { cookie } = await session(app, "a@example.com");
    const res = await postPhoto(
      app,
      cookie,
      makeWebpVp8x({ width: 400, height: 600, alpha: true }),
      {},
      "cutout.webp",
      "application/octet-stream",
    );
    expect(res.status).toBe(201);
    expect(photoMetaSchema.parse(await res.json()).kind).toBe("cutout");
  });

  it("SVG / GIF / HEIC は 415", async () => {
    const { app } = await createTestApp();
    const { cookie } = await session(app, "a@example.com");
    const svg = await postPhoto(app, cookie, makeSvg(), {}, "x.svg", "image/svg+xml");
    expect(svg.status).toBe(415);
    expect(await svg.json()).toEqual({ error: "unsupported_media_type" });

    const gif = await postPhoto(app, cookie, makeGif(), {}, "x.gif", "image/gif");
    expect(gif.status).toBe(415);

    const heic = await postPhoto(app, cookie, makeHeic(), {}, "x.heic", "image/heic");
    expect(heic.status).toBe(415);
  });

  it("1MB 超は 413", async () => {
    const { app } = await createTestApp();
    const { cookie } = await session(app, "a@example.com");
    const res = await postPhoto(app, cookie, makeJpeg(10, 10, PHOTO_MAX_BYTES));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "payload_too_large" });
  });

  it("長辺 1600 超は 400", async () => {
    const { app } = await createTestApp();
    const { cookie } = await session(app, "a@example.com");
    const res = await postPhoto(app, cookie, makeJpeg(1601, 200));
    expect(res.status).toBe(400);
    const body = apiErrorBodySchema.parse(await res.json());
    expect(body.error).toBe("validation_error");
    expect(body.fields?.file).toBeDefined();
  });

  it("所有者を2つ指定すると 400", async () => {
    const { app } = await createTestApp();
    const { cookie } = await session(app, "a@example.com");
    const res = await postPhoto(app, cookie, makeJpeg(100, 100), {
      bottleId: "11111111-1111-4111-8111-111111111111",
      drinkLogId: "22222222-2222-4222-8222-222222222222",
    });
    expect(res.status).toBe(400);
    const body = apiErrorBodySchema.parse(await res.json());
    expect(body.fields?.[""]?.[0]).toContain("1つ");
  });

  it("他人のボトルへ紐付けると 404", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const now = new Date();
    await ctx.db.insert(bottles).values({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      userId: b.userId,
      name: "他人の瓶",
      drinkType: "wine",
      createdAt: now,
      updatedAt: now,
    });
    const res = await postPhoto(ctx.app, a.cookie, makeJpeg(100, 100), {
      bottleId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("自分のボトルへは紐付けできる", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const now = new Date();
    await ctx.db.insert(bottles).values({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      userId: a.userId,
      name: "自分の瓶",
      drinkType: "wine",
      createdAt: now,
      updatedAt: now,
    });
    const res = await postPhoto(ctx.app, a.cookie, makeJpeg(100, 100), {
      bottleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(res.status).toBe(201);
    expect(photoMetaSchema.parse(await res.json()).bottleId).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });
});

describe("GET /api/photos/:id と content", () => {
  it("他人の id は 404。本人はメタと本体を取れる", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const created = await postPhoto(ctx.app, a.cookie, makeJpeg(320, 400));
    const meta = photoMetaSchema.parse(await created.json());

    const otherMeta = await ctx.app.request(`/api/photos/${meta.id}`, {
      headers: { Cookie: b.cookie },
    });
    expect(otherMeta.status).toBe(404);

    const otherContent = await ctx.app.request(`/api/photos/${meta.id}/content`, {
      headers: { Cookie: b.cookie },
    });
    expect(otherContent.status).toBe(404);

    const own = await ctx.app.request(`/api/photos/${meta.id}`, {
      headers: { Cookie: a.cookie },
    });
    expect(own.status).toBe(200);
    expect(photoMetaSchema.parse(await own.json()).id).toBe(meta.id);

    const content = await ctx.app.request(`/api/photos/${meta.id}/content`, {
      headers: { Cookie: a.cookie },
    });
    expect(content.status).toBe(200);
    expect(content.headers.get("content-type")).toBe("image/jpeg");
    expect(content.headers.get("cache-control")).toBe("private, max-age=300");
    expect(content.headers.get("content-disposition")).toBe("inline");
    expect((await content.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("未認証の content は 401", async () => {
    const { app } = await createTestApp();
    const res = await app.request("/api/photos/11111111-1111-4111-8111-111111111111/content");
    expect(res.status).toBe(401);
  });
});

describe("PATCH / DELETE /api/photos/:id", () => {
  it("他人の PATCH / DELETE は 404 で元データは残る", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const b = await session(ctx.app, "b@example.com");
    const created = await postPhoto(ctx.app, a.cookie, makeJpeg(200, 250));
    const meta = photoMetaSchema.parse(await created.json());

    const patched = await ctx.app.request(`/api/photos/${meta.id}`, {
      method: "PATCH",
      headers: { Cookie: b.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 9 }),
    });
    expect(patched.status).toBe(404);

    const deleted = await ctx.app.request(`/api/photos/${meta.id}`, {
      method: "DELETE",
      headers: { Cookie: b.cookie },
    });
    expect(deleted.status).toBe(404);

    const still = await ctx.app.request(`/api/photos/${meta.id}`, {
      headers: { Cookie: a.cookie },
    });
    expect(still.status).toBe(200);
    expect(photoMetaSchema.parse(await still.json()).sortOrder).toBe(0);
    expect(ctx.photos.keys()).toHaveLength(1);
  });

  it("本人は PATCH で sortOrder を変え、DELETE で R2 も消す", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const created = await postPhoto(ctx.app, a.cookie, makeJpeg(200, 250));
    const meta = photoMetaSchema.parse(await created.json());

    const patched = await ctx.app.request(`/api/photos/${meta.id}`, {
      method: "PATCH",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 3 }),
    });
    expect(patched.status).toBe(200);
    expect(photoMetaSchema.parse(await patched.json()).sortOrder).toBe(3);

    const deleted = await ctx.app.request(`/api/photos/${meta.id}`, {
      method: "DELETE",
      headers: { Cookie: a.cookie },
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ ok: true });
    expect(ctx.photos.keys()).toHaveLength(0);

    const gone = await ctx.app.request(`/api/photos/${meta.id}`, {
      headers: { Cookie: a.cookie },
    });
    expect(gone.status).toBe(404);
  });
});

describe("未紐付け GC", () => {
  it("24h 超の未紐付けだけ R2 と D1 から消す", async () => {
    const { runDailyGc } = await import("../services/photo-gc.ts");
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const now = Date.now();
    const fresh = await postPhoto(ctx.app, a.cookie, makeJpeg(100, 120));
    const freshMeta = photoMetaSchema.parse(await fresh.json());

    const staleId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await ctx.db.insert(photos).values({
      id: staleId,
      userId: a.userId,
      r2Key: `${staleId}.jpg`,
      contentType: "image/jpeg",
      byteSize: 12,
      width: 10,
      height: 10,
      kind: "photo",
      sortOrder: 0,
      createdAt: new Date(now - 25 * 60 * 60 * 1000),
      updatedAt: new Date(now - 25 * 60 * 60 * 1000),
    });
    await ctx.photos.put(`${staleId}.jpg`, new Uint8Array([1, 2, 3]));

    const result = await runDailyGc({
      db: ctx.db,
      bucket: ctx.photos,
      nowMs: now,
    });
    expect(result.photosDeleted).toBe(1);

    const leftover = await ctx.db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.id, staleId));
    expect(leftover).toHaveLength(0);
    expect(ctx.photos.keys()).toEqual([`${freshMeta.id}.jpg`]);
  });

  it("紐付け済みの古い写真は消さない", async () => {
    const { runDailyGc } = await import("../services/photo-gc.ts");
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const now = Date.now();
    const bottleId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await ctx.db.insert(bottles).values({
      id: bottleId,
      userId: a.userId,
      name: "古い瓶",
      drinkType: "wine",
      createdAt: new Date(now - 48 * 60 * 60 * 1000),
      updatedAt: new Date(now - 48 * 60 * 60 * 1000),
    });
    const attachedId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    await ctx.db.insert(photos).values({
      id: attachedId,
      userId: a.userId,
      r2Key: `${attachedId}.jpg`,
      contentType: "image/jpeg",
      byteSize: 12,
      width: 10,
      height: 10,
      bottleId,
      kind: "photo",
      sortOrder: 0,
      createdAt: new Date(now - 48 * 60 * 60 * 1000),
      updatedAt: new Date(now - 48 * 60 * 60 * 1000),
    });
    await ctx.photos.put(`${attachedId}.jpg`, new Uint8Array([1, 2, 3]));

    const result = await runDailyGc({
      db: ctx.db,
      bucket: ctx.photos,
      nowMs: now,
    });
    expect(result.photosDeleted).toBe(0);
    expect(ctx.photos.keys()).toEqual([`${attachedId}.jpg`]);
  });
});
