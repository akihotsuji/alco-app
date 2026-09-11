import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  account,
  accountDeletionPhotoTasks,
  accountDeletionRecords,
  drinkLogs,
  photos,
  session,
  user,
  verification,
} from "@/db/schema.ts";
import { ACCOUNT_DELETION_GOOGLE_SESSION_MAX_AGE_MS } from "@/shared/account-deletion.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { makeJpeg } from "../image-fixtures.ts";
import { runAccountDeletionJobs } from "../services/account-deletion-jobs.ts";
import { accountDeletionRateLimiter } from "../services/account-deletion-rate-limit.ts";
import {
  createTestApp,
  createTestUser,
  createTestUserPair,
  createUnverifiedTestUser,
  requestAccountDeletion,
} from "../test-helpers.ts";

afterEach(() => {
  accountDeletionRateLimiter.reset();
});

async function postJpeg(app: Awaited<ReturnType<typeof createTestApp>>["app"], cookie: string) {
  const form = new FormData();
  const bytes = Uint8Array.from(makeJpeg(80, 80));
  form.set("file", new File([bytes], "shot.jpg", { type: "image/jpeg" }));
  return app.request("/api/photos", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
}

async function makeGoogleOnly(db: Awaited<ReturnType<typeof createTestApp>>["db"], userId: string) {
  await db
    .delete(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  await db.insert(account).values({
    id: crypto.randomUUID(),
    issuer: "https://accounts.google.com",
    accountId: `google-${userId}`,
    providerId: "google",
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("POST /api/me/account-deletion", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await requestAccountDeletion(app, "", { confirmed: true, password: "password1" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("GET では削除しない", async () => {
    const { app, db } = await createTestApp();
    const userA = await createTestUser(app, {
      name: "A",
      email: "get@example.com",
      password: "password1",
    });
    const res = await app.request("/api/me/account-deletion", {
      method: "GET",
      headers: { Cookie: userA.cookie, Origin: "http://localhost" },
    });
    expect(res.status).toBe(404);
    const [alive] = await db.select().from(user).where(eq(user.id, userA.id));
    expect(alive?.id).toBe(userA.id);
  });

  it("Origin 欠如と不正 Origin では削除しない", async () => {
    const { app, db } = await createTestApp();
    const userA = await createTestUser(app, {
      name: "A",
      email: "origin@example.com",
      password: "password1",
    });
    const missing = await requestAccountDeletion(
      app,
      userA.cookie,
      { confirmed: true, password: "password1" },
      { Origin: "" },
    );
    expect(missing.status).toBe(400);
    const other = await requestAccountDeletion(
      app,
      userA.cookie,
      { confirmed: true, password: "password1" },
      { Origin: "https://evil.example" },
    );
    expect(other.status).toBe(400);
    const [alive] = await db.select().from(user).where(eq(user.id, userA.id));
    expect(alive?.id).toBe(userA.id);
  });

  it("body の userId は 400 で削除しない", async () => {
    const { app, db } = await createTestApp();
    const [a, b] = await createTestUserPair(app, [
      { name: "A", email: "inject-a@example.com", password: "password1" },
      { name: "B", email: "inject-b@example.com", password: "password1" },
    ]);
    const res = await requestAccountDeletion(app, a.cookie, {
      confirmed: true,
      password: "password1",
      userId: b.id,
    });
    expect(res.status).toBe(400);
    expect(apiErrorBodySchema.parse(await res.json()).error).toBe("validation_error");
    const rows = await db.select({ id: user.id }).from(user);
    expect(rows.map((row) => row.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("誤パスワードは 403 でデータを残す", async () => {
    const { app, db } = await createTestApp();
    const userA = await createTestUser(app, {
      name: "A",
      email: "wrong@example.com",
      password: "password1",
    });
    const res = await requestAccountDeletion(app, userA.cookie, {
      confirmed: true,
      password: "incorrect1",
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "reauthentication_required" });
    const [alive] = await db.select().from(user).where(eq(user.id, userA.id));
    expect(alive?.id).toBe(userA.id);
  });

  it("メール認証で受付し、Cookie を失効し、他人のデータは残す", async () => {
    const { app, db, photos: bucket } = await createTestApp();
    const [a, b] = await createTestUserPair(app, [
      { name: "A", email: "ok-a@example.com", password: "password1" },
      { name: "B", email: "ok-b@example.com", password: "password1" },
    ]);
    const createdA = await postJpeg(app, a.cookie);
    const createdB = await postJpeg(app, b.cookie);
    expect(createdA.status).toBe(201);
    expect(createdB.status).toBe(201);
    const photoA = (await createdA.json()) as { id: string };
    const photoB = (await createdB.json()) as { id: string };
    await app.request("/api/drink-logs", {
      method: "POST",
      headers: { Cookie: a.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ drinkType: "wine", volumeMl: 125, abvPercent: 12 }),
    });
    await app.request("/api/drink-logs", {
      method: "POST",
      headers: { Cookie: b.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ drinkType: "beer", volumeMl: 350, abvPercent: 5 }),
    });

    const res = await requestAccountDeletion(app, a.cookie, {
      confirmed: true,
      password: "password1",
    });
    expect(res.status).toBe(202);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "accepted" });
    expect(
      res.headers
        .getSetCookie()
        .some((value) => /session_token=/i.test(value) && /Max-Age=0/i.test(value)),
    ).toBe(true);

    const me = await app.request("/api/me", { headers: { Cookie: a.cookie } });
    expect(me.status).toBe(401);
    const photoContent = await app.request(`/api/photos/${photoA.id}/content`, {
      headers: { Cookie: a.cookie },
    });
    expect(photoContent.status).toBe(401);

    const [gone] = await db.select().from(user).where(eq(user.id, a.id));
    expect(gone).toBeUndefined();
    const leftoverLogs = await db.select().from(drinkLogs);
    expect(leftoverLogs).toHaveLength(1);
    expect(leftoverLogs[0]?.userId).toBe(b.id);
    const leftoverPhotos = await db.select().from(photos);
    expect(leftoverPhotos).toHaveLength(1);
    expect(leftoverPhotos[0]?.userId).toBe(b.id);
    const tasks = await db.select().from(accountDeletionPhotoTasks);
    expect(tasks).toHaveLength(1);
    expect(bucket.keys()).toEqual(expect.arrayContaining([`${photoA.id}.jpg`, `${photoB.id}.jpg`]));

    await runAccountDeletionJobs({ db, bucket });
    expect(bucket.keys()).toEqual([`${photoB.id}.jpg`]);
    const leftoverTasks = await db.select().from(accountDeletionPhotoTasks);
    expect(leftoverTasks).toHaveLength(0);
    const [record] = await db
      .select()
      .from(accountDeletionRecords)
      .where(eq(accountDeletionRecords.userId, a.id));
    expect(record?.replicatedAt).toBeTruthy();
    expect(bucket.keys().some((key) => key.startsWith("account-deletion-ledger/"))).toBe(true);

    const meB = await app.request("/api/me", { headers: { Cookie: b.cookie } });
    expect(meB.status).toBe(200);
    const stillB = await app.request(`/api/photos/${photoB.id}/content`, {
      headers: { Cookie: b.cookie },
    });
    expect(stillB.status).toBe(200);
  });

  it("年齢未確認でも本人確認後に削除できる", async () => {
    const { app, db } = await createTestApp();
    const pending = await createUnverifiedTestUser(app, {
      name: "未確認",
      email: "unverified-del@example.com",
      password: "password1",
    });
    const denied = await app.request("/api/drink-logs", {
      headers: { Cookie: pending.cookie },
    });
    expect(denied.status).toBe(403);
    const res = await requestAccountDeletion(app, pending.cookie, {
      confirmed: true,
      password: "password1",
    });
    expect(res.status).toBe(202);
    const [gone] = await db.select().from(user).where(eq(user.id, pending.id));
    expect(gone).toBeUndefined();
  });

  it("Google のみは新しいセッションなら受付し、古いセッションは拒否する", async () => {
    const { app, db } = await createTestApp();
    const fresh = await createTestUser(app, {
      name: "G",
      email: "google-fresh@example.com",
      password: "password1",
    });
    await makeGoogleOnly(db, fresh.id);
    const ok = await requestAccountDeletion(app, fresh.cookie, { confirmed: true });
    expect(ok.status).toBe(202);

    const stale = await createTestUser(app, {
      name: "G2",
      email: "google-stale@example.com",
      password: "password1",
    });
    await makeGoogleOnly(db, stale.id);
    await db
      .update(session)
      .set({
        createdAt: new Date(Date.now() - ACCOUNT_DELETION_GOOGLE_SESSION_MAX_AGE_MS - 1_000),
      })
      .where(eq(session.userId, stale.id));
    const denied = await requestAccountDeletion(app, stale.cookie, { confirmed: true });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: "reauthentication_required" });
    const [alive] = await db.select().from(user).where(eq(user.id, stale.id));
    expect(alive?.id).toBe(stale.id);
  });

  it("verification は完全一致の当人分だけ消す", async () => {
    const { app, db } = await createTestApp();
    const userA = await createTestUser(app, {
      name: "A",
      email: "verify@example.com",
      password: "password1",
    });
    const now = new Date();
    await db.insert(verification).values([
      {
        id: "v-user",
        identifier: "other",
        value: userA.id,
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "v-email",
        identifier: userA.email,
        value: "token",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "v-partial-value",
        identifier: "x",
        value: `${userA.id}-extra`,
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "v-partial-id",
        identifier: `${userA.email}.extra`,
        value: "token",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const res = await requestAccountDeletion(app, userA.cookie, {
      confirmed: true,
      password: "password1",
    });
    expect(res.status).toBe(202);
    const leftover = await db.select({ id: verification.id }).from(verification);
    expect(leftover.map((row) => row.id).sort()).toEqual(["v-partial-id", "v-partial-value"]);
  });

  it("写真ゼロでも受付できる", async () => {
    const { app, db } = await createTestApp();
    const userA = await createTestUser(app, {
      name: "A",
      email: "nophoto@example.com",
      password: "password1",
    });
    const res = await requestAccountDeletion(app, userA.cookie, {
      confirmed: true,
      password: "password1",
    });
    expect(res.status).toBe(202);
    const tasks = await db.select().from(accountDeletionPhotoTasks);
    expect(tasks).toHaveLength(0);
    const [gone] = await db.select().from(user).where(eq(user.id, userA.id));
    expect(gone).toBeUndefined();
  });

  it("R2 障害ではタスクが残り、復旧後に消える", async () => {
    const { app, db, photos: bucket } = await createTestApp();
    const userA = await createTestUser(app, {
      name: "A",
      email: "r2fail@example.com",
      password: "password1",
    });
    const created = await postJpeg(app, userA.cookie);
    const photo = (await created.json()) as { id: string };
    const res = await requestAccountDeletion(app, userA.cookie, {
      confirmed: true,
      password: "password1",
    });
    expect(res.status).toBe(202);
    bucket.failDelete();
    await runAccountDeletionJobs({ db, bucket });
    expect(await db.select().from(accountDeletionPhotoTasks)).toHaveLength(1);
    expect(bucket.keys()).toContain(`${photo.id}.jpg`);
    bucket.clearDeleteFailures();
    await runAccountDeletionJobs({ db, bucket });
    expect(await db.select().from(accountDeletionPhotoTasks)).toHaveLength(0);
    expect(bucket.keys()).not.toContain(`${photo.id}.jpg`);
  });

  it("D1 batch 失敗ではアカウントも写真も消えない", async () => {
    const { app, db } = await createTestApp();
    const userA = await createTestUser(app, {
      name: "A",
      email: "atomic@example.com",
      password: "password1",
    });
    const original = db.batch.bind(db);
    db.batch = (async () => {
      throw new Error("batch failed");
    }) as typeof db.batch;
    const res = await requestAccountDeletion(app, userA.cookie, {
      confirmed: true,
      password: "password1",
    });
    expect(res.status).toBeGreaterThanOrEqual(500);
    db.batch = original;
    const [alive] = await db.select().from(user).where(eq(user.id, userA.id));
    expect(alive?.id).toBe(userA.id);
    expect(await db.select().from(accountDeletionRecords)).toHaveLength(0);
  });

  it("同じメールで再登録しても旧タスクに巻き込まれない", async () => {
    const { app, db, photos: bucket } = await createTestApp();
    const first = await createTestUser(app, {
      name: "A",
      email: "rejoin@example.com",
      password: "password1",
    });
    const created = await postJpeg(app, first.cookie);
    const oldPhoto = (await created.json()) as { id: string };
    expect(
      (
        await requestAccountDeletion(app, first.cookie, {
          confirmed: true,
          password: "password1",
        })
      ).status,
    ).toBe(202);
    const tasks = await db.select().from(accountDeletionPhotoTasks);
    expect(tasks.map((task) => task.r2Key)).toEqual([`${oldPhoto.id}.jpg`]);

    const second = await createTestUser(app, {
      name: "A2",
      email: "rejoin@example.com",
      password: "password1",
    });
    expect(second.id).not.toBe(first.id);
    const again = await postJpeg(app, second.cookie);
    expect(again.status).toBe(201);
    const newPhoto = (await again.json()) as { id: string };
    await runAccountDeletionJobs({ db, bucket });
    expect(bucket.keys()).toContain(`${newPhoto.id}.jpg`);
    expect(bucket.keys()).not.toContain(`${oldPhoto.id}.jpg`);
  });

  it("レート制限を超えると 429", async () => {
    const { app } = await createTestApp();
    const userA = await createTestUser(app, {
      name: "A",
      email: "rate@example.com",
      password: "password1",
    });
    for (let i = 0; i < 5; i += 1) {
      const res = await requestAccountDeletion(app, userA.cookie, {
        confirmed: true,
        password: "incorrect1",
      });
      expect(res.status).toBe(403);
    }
    const limited = await requestAccountDeletion(app, userA.cookie, {
      confirmed: true,
      password: "password1",
    });
    expect(limited.status).toBe(429);
  });
});
