import { afterEach, describe, expect, it } from "vitest";
import { bottles, cellarMembers, photos } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import {
  cellarDetailSchema,
  cellarRevisionSchema,
  cellarsResponseSchema,
  invitationPreviewSchema,
} from "@/shared/cellars.ts";
import { bottleSchema, createBottlesResponseSchema } from "@/shared/bottles.ts";
import { makeJpeg } from "../image-fixtures.ts";
import {
  cellarCreateRateLimiter,
  cellarInviteCreateRateLimiter,
  cellarInviteUseRateLimiter,
} from "../services/cellar-rate-limit.ts";
import {
  createTestApp,
  createTestUser,
  createTestUserPair,
  requestAccountDeletion,
  seedOwnedBottle,
} from "../test-helpers.ts";

afterEach(() => {
  cellarCreateRateLimiter.reset();
  cellarInviteCreateRateLimiter.reset();
  cellarInviteUseRateLimiter.reset();
});

const OP = () => crypto.randomUUID();

async function session(app: Awaited<ReturnType<typeof createTestApp>>["app"], email: string) {
  const user = await createTestUser(app, {
    name: email.split("@")[0] ?? "user",
    email,
    password: "password1",
  });
  return { cookie: user.cookie, userId: user.id, name: user.name };
}

function headers(cookie: string) {
  return { Cookie: cookie, "Content-Type": "application/json" };
}

describe("GET/POST /api/cellars", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    expect((await app.request("/api/cellars")).status).toBe(401);
  });

  it("個人セラーを作り、共有セラーを追加できる", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const list = cellarsResponseSchema.parse(await (await ctx.app.request("/api/cellars", { headers: headers(a.cookie) })).json());
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.kind).toBe("personal");
    expect(list.items[0]?.name).toBe("自分のセラー");

    const created = await ctx.app.request("/api/cellars", {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ name: "ふたりのセラー", operationKey: OP() }),
    });
    expect(created.status).toBe(201);
    const detail = cellarDetailSchema.parse(await created.json());
    expect(detail.kind).toBe("shared");
    expect(detail.role).toBe("owner");
    expect(detail.memberCount).toBe(1);
  });

  it("共有セラーは 1 つまで", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const first = await ctx.app.request("/api/cellars", {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ operationKey: OP() }),
    });
    expect(first.status).toBe(201);
    const second = await ctx.app.request("/api/cellars", {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ operationKey: OP() }),
    });
    expect(second.status).toBe(409);
    expect(apiErrorBodySchema.parse(await second.json()).conflict?.reason).toBe("already_shared");
  });

  it("同じ操作キーは同じ結果を返す", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "a@example.com");
    const key = OP();
    const first = await ctx.app.request("/api/cellars", {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ name: "家族のセラー", operationKey: key }),
    });
    const second = await ctx.app.request("/api/cellars", {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ name: "家族のセラー", operationKey: key }),
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await first.json()).toEqual(await second.json());
  });
});

describe("招待と参加", () => {
  async function createShared(ctx: Awaited<ReturnType<typeof createTestApp>>, cookie: string) {
    const res = await ctx.app.request("/api/cellars", {
      method: "POST",
      headers: headers(cookie),
      body: JSON.stringify({ name: "ふたりのセラー", operationKey: OP() }),
    });
    return cellarDetailSchema.parse(await res.json());
  }

  it("招待リンクは 1 人用。GET では参加しない。無関係な C は 404", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "owner", email: "owner@example.com", password: "password1" },
      { name: "member", email: "member@example.com", password: "password1" },
    ]);
    const c = await session(ctx.app, "other@example.com");
    const shared = await createShared(ctx, a.cookie);
    const invite = await ctx.app.request(`/api/cellars/${shared.id}/invitations`, {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ operationKey: OP() }),
    });
    expect(invite.status).toBe(201);
    const created = (await invite.json()) as { url: string; id: string };
    const token = new URL(created.url).hash.replace("#t=", "");
    expect(token.length).toBeGreaterThan(20);

    const getJoin = await ctx.app.request(`/join#t=${token}`);
    expect(getJoin.status).not.toBe(201);

    const preview = invitationPreviewSchema.parse(
      await (
        await ctx.app.request("/api/cellar-invitations/preview", {
          method: "POST",
          headers: headers(b.cookie),
          body: JSON.stringify({ token }),
        })
      ).json(),
    );
    expect(preview.status).toBe("joinable");
    expect(preview.cellarName).toBe("ふたりのセラー");

    const accepted = await ctx.app.request("/api/cellar-invitations/accept", {
      method: "POST",
      headers: headers(b.cookie),
      body: JSON.stringify({ token, operationKey: OP() }),
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ cellarId: shared.id });

    const reuse = await ctx.app.request("/api/cellar-invitations/accept", {
      method: "POST",
      headers: headers(c.cookie),
      body: JSON.stringify({ token, operationKey: OP() }),
    });
    expect(reuse.status).toBe(404);

    const otherRevision = await ctx.app.request(`/api/cellars/${shared.id}/revision`, {
      headers: { Cookie: c.cookie },
    });
    expect(otherRevision.status).toBe(404);
  });

  it("メンバーは招待を発行できない", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "owner", email: "o2@example.com", password: "password1" },
      { name: "member", email: "m2@example.com", password: "password1" },
    ]);
    const shared = await createShared(ctx, a.cookie);
    const invite = await ctx.app.request(`/api/cellars/${shared.id}/invitations`, {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ operationKey: OP() }),
    });
    const token = new URL(((await invite.json()) as { url: string }).url).hash.replace("#t=", "");
    await ctx.app.request("/api/cellar-invitations/accept", {
      method: "POST",
      headers: headers(b.cookie),
      body: JSON.stringify({ token, operationKey: OP() }),
    });
    const memberInvite = await ctx.app.request(`/api/cellars/${shared.id}/invitations`, {
      method: "POST",
      headers: headers(b.cookie),
      body: JSON.stringify({ operationKey: OP() }),
    });
    expect(memberInvite.status).toBe(404);
  });
});

describe("共有ボトルの認可と version", () => {
  async function sharedPair() {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "owner", email: "oa@example.com", password: "password1" },
      { name: "member", email: "mb@example.com", password: "password1" },
    ]);
    const c = await session(ctx.app, "cc@example.com");
    const shared = cellarDetailSchema.parse(
      await (
        await ctx.app.request("/api/cellars", {
          method: "POST",
          headers: headers(a.cookie),
          body: JSON.stringify({ name: "ふたりのセラー", operationKey: OP() }),
        })
      ).json(),
    );
    const invite = await ctx.app.request(`/api/cellars/${shared.id}/invitations`, {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ operationKey: OP() }),
    });
    const token = new URL(((await invite.json()) as { url: string }).url).hash.replace("#t=", "");
    await ctx.app.request("/api/cellar-invitations/accept", {
      method: "POST",
      headers: headers(b.cookie),
      body: JSON.stringify({ token, operationKey: OP() }),
    });
    return { ctx, a, b, c, shared };
  }

  it("B は追加・編集でき、C は 404。旧クライアントの共有更新は version なしで 400", async () => {
    const { ctx, a, b, c, shared } = await sharedPair();
    const created = createBottlesResponseSchema.parse(
      await (
        await ctx.app.request("/api/bottles", {
          method: "POST",
          headers: headers(a.cookie),
          body: JSON.stringify({
            name: "共有赤",
            drinkType: "wine",
            cellarId: shared.id,
            operationKey: OP(),
          }),
        })
      ).json(),
    );
    const bottle = created.items[0];
    expect(bottle?.cellarId).toBe(shared.id);
    expect(bottle?.version).toBe(1);

    const patched = await ctx.app.request(`/api/bottles/${bottle?.id}`, {
      method: "PATCH",
      headers: headers(b.cookie),
      body: JSON.stringify({ name: "改名", expectedVersion: 1, operationKey: OP() }),
    });
    expect(patched.status).toBe(200);
    expect(bottleSchema.parse(await patched.json()).version).toBe(2);

    const noVersion = await ctx.app.request(`/api/bottles/${bottle?.id}`, {
      method: "PATCH",
      headers: headers(b.cookie),
      body: JSON.stringify({ name: "古いクライアント" }),
    });
    expect(noVersion.status).toBe(400);

    const stale = await ctx.app.request(`/api/bottles/${bottle?.id}`, {
      method: "PATCH",
      headers: headers(a.cookie),
      body: JSON.stringify({ name: "競合", expectedVersion: 1, operationKey: OP() }),
    });
    expect(stale.status).toBe(409);
    expect(apiErrorBodySchema.parse(await stale.json()).conflict?.reason).toBe("version");

    expect(
      (
        await ctx.app.request(`/api/bottles/${bottle?.id}`, {
          headers: { Cookie: c.cookie },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await ctx.app.request(`/api/bottles/${bottle?.id}`, {
          method: "PATCH",
          headers: headers(c.cookie),
          body: JSON.stringify({ name: "盗む", expectedVersion: 2, operationKey: OP() }),
        })
      ).status,
    ).toBe(404);

    const personalList = await ctx.app.request("/api/bottles?view=cellar", {
      headers: { Cookie: a.cookie },
    });
    const personalBody = await personalList.json();
    expect(JSON.stringify(personalBody)).not.toContain(bottle?.id);
  });

  it("個人ボトルを共有へ原子移動する。ID は変わらない", async () => {
    const { ctx, a, shared } = await sharedPair();
    const cellarId = await seedOwnedBottle(ctx.db, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      userId: a.id,
      name: "移動する瓶",
      drinkType: "wine",
    });
    const [row] = await ctx.db.select().from(bottles);
    expect(row).toBeDefined();
    const moved = await ctx.app.request(`/api/cellars/${shared.id}/moves`, {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({
        items: [{ bottleId: row?.id, expectedVersion: row?.version }],
        operationKey: OP(),
      }),
    });
    expect(moved.status).toBe(201);
    expect(await moved.json()).toEqual({ moved: 1 });
    const [after] = await ctx.db.select().from(bottles);
    expect(after?.id).toBe(row?.id);
    expect(after?.cellarId).toBe(shared.id);
    expect(after?.cellarId).not.toBe(cellarId);
  });
});

describe("退会と共有写真", () => {
  it("オーナーが他メンバーありで退会すると 409", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "owner", email: "od@example.com", password: "password1" },
      { name: "member", email: "md@example.com", password: "password1" },
    ]);
    const shared = cellarDetailSchema.parse(
      await (
        await ctx.app.request("/api/cellars", {
          method: "POST",
          headers: headers(a.cookie),
          body: JSON.stringify({ operationKey: OP() }),
        })
      ).json(),
    );
    const invite = await ctx.app.request(`/api/cellars/${shared.id}/invitations`, {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ operationKey: OP() }),
    });
    const token = new URL(((await invite.json()) as { url: string }).url).hash.replace("#t=", "");
    await ctx.app.request("/api/cellar-invitations/accept", {
      method: "POST",
      headers: headers(b.cookie),
      body: JSON.stringify({ token, operationKey: OP() }),
    });
    const res = await requestAccountDeletion(ctx.app, a.cookie, { password: "password1" });
    expect(res.status).toBe(409);
    expect(apiErrorBodySchema.parse(await res.json()).conflict?.reason).toBe("owner_required");
  });

  it("通常メンバー退会後も共有写真は残る", async () => {
    const ctx = await createTestApp();
    const [a, b] = await createTestUserPair(ctx.app, [
      { name: "owner", email: "oe@example.com", password: "password1" },
      { name: "member", email: "me@example.com", password: "password1" },
    ]);
    const shared = cellarDetailSchema.parse(
      await (
        await ctx.app.request("/api/cellars", {
          method: "POST",
          headers: headers(a.cookie),
          body: JSON.stringify({ operationKey: OP() }),
        })
      ).json(),
    );
    const invite = await ctx.app.request(`/api/cellars/${shared.id}/invitations`, {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ operationKey: OP() }),
    });
    const token = new URL(((await invite.json()) as { url: string }).url).hash.replace("#t=", "");
    await ctx.app.request("/api/cellar-invitations/accept", {
      method: "POST",
      headers: headers(b.cookie),
      body: JSON.stringify({ token, operationKey: OP() }),
    });
    const form = new FormData();
    form.set("file", new File([Uint8Array.from(makeJpeg(80, 80))], "shot.jpg", { type: "image/jpeg" }));
    const photo = await ctx.app.request("/api/photos", {
      method: "POST",
      headers: { Cookie: b.cookie },
      body: form,
    });
    const photoId = ((await photo.json()) as { id: string }).id;
    const created = createBottlesResponseSchema.parse(
      await (
        await ctx.app.request("/api/bottles", {
          method: "POST",
          headers: headers(b.cookie),
          body: JSON.stringify({
            name: "メンバーの瓶",
            drinkType: "wine",
            cellarId: shared.id,
            photoIds: [photoId],
            operationKey: OP(),
          }),
        })
      ).json(),
    );
    const bottleId = created.items[0]?.id;
    const deleted = await requestAccountDeletion(ctx.app, b.cookie, { password: "password1" });
    expect(deleted.status).toBe(200);
    const [stillBottle] = await ctx.db.select().from(bottles);
    expect(stillBottle?.id).toBe(bottleId);
    const [stillPhoto] = await ctx.db.select().from(photos);
    expect(stillPhoto?.id).toBe(photoId);
    expect(stillPhoto?.userId).toBeNull();
    const members = await ctx.db.select().from(cellarMembers);
    expect(members.every((row) => row.userId !== b.id)).toBe(true);
  });
});

describe("revision", () => {
  it("メンバーだけが revision を読める", async () => {
    const ctx = await createTestApp();
    const a = await session(ctx.app, "rev@example.com");
    const shared = cellarDetailSchema.parse(
      await (
        await ctx.app.request("/api/cellars", {
          method: "POST",
          headers: headers(a.cookie),
          body: JSON.stringify({ operationKey: OP() }),
        })
      ).json(),
    );
    const res = await ctx.app.request(`/api/cellars/${shared.id}/revision`, {
      headers: { Cookie: a.cookie },
    });
    expect(res.status).toBe(200);
    expect(cellarRevisionSchema.parse(await res.json()).revision).toBeGreaterThanOrEqual(1);
  });
});
