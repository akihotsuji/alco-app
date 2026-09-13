import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { feedbackPhotos, feedbacks } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { FEEDBACK_DAILY_LIMIT } from "@/shared/feedback.ts";
import { makeHtml, makeJpeg } from "../image-fixtures.ts";
import { createTestApp, createTestUser, createUnverifiedTestUser } from "../test-helpers.ts";

function postFeedback(
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  cookie: string,
  fields: Record<string, string> = { category: "improvement", body: "棚が使いにくい" },
  files: { bytes: Uint8Array; name?: string; type?: string }[] = [],
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  for (const file of files) {
    form.append(
      "photos",
      new File([Uint8Array.from(file.bytes)], file.name ?? "shot.jpg", {
        type: file.type ?? "image/jpeg",
      }),
    );
  }
  return app.request("/api/feedback", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
}

describe("POST /api/feedback", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const res = await postFeedback(app, "");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("年齢未確認は 403", async () => {
    const { app } = await createTestApp();
    const pending = await createUnverifiedTestUser(app, {
      name: "未確認",
      email: "unverified-fb@example.com",
      password: "password1",
    });
    const res = await postFeedback(app, pending.cookie);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "age_required" });
  });

  it("GET は 404", async () => {
    const { app } = await createTestApp();
    const user = await createTestUser(app, {
      name: "A",
      email: "get-fb@example.com",
      password: "password1",
    });
    const res = await app.request("/api/feedback", {
      method: "GET",
      headers: { Cookie: user.cookie },
    });
    expect(res.status).toBe(404);
  });

  it("本文だけ送り 201。r2Key / userId は返さない", async () => {
    const { app, db, feedbackMailbox } = await createTestApp();
    const user = await createTestUser(app, {
      name: "A",
      email: "ok-fb@example.com",
      password: "password1",
    });
    const res = await postFeedback(app, user.cookie, {
      category: "bug",
      body: "  保存できない  ",
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toEqual({ ok: true });
    expect(JSON.stringify(created)).not.toContain("r2Key");
    expect(JSON.stringify(created)).not.toContain(user.id);

    const rows = await db.select().from(feedbacks);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(user.id);
    expect(rows[0]?.category).toBe("bug");
    expect(rows[0]?.body).toBe("保存できない");
    expect(feedbackMailbox).toHaveLength(1);
    expect(feedbackMailbox[0]?.userEmail).toBe("ok-fb@example.com");
    expect(feedbackMailbox[0]?.body).toBe("保存できない");
    expect(feedbackMailbox[0]?.attachments).toEqual([]);
  });

  it("画像は magic bytes を見て R2 キーにファイル名も user_id も入れない", async () => {
    const { app, db, photos: bucket, feedbackMailbox } = await createTestApp();
    const user = await createTestUser(app, {
      name: "A",
      email: "photo-fb@example.com",
      password: "password1",
    });
    const res = await postFeedback(app, user.cookie, undefined, [
      { bytes: makeJpeg(80, 80), name: "secret-name.jpg", type: "text/html" },
    ]);
    expect(res.status).toBe(201);
    const [row] = await db.select().from(feedbackPhotos);
    expect(row?.r2Key).toMatch(/^feedback\/[0-9a-f-]{36}\.jpg$/);
    expect(row?.r2Key).not.toContain(user.id);
    expect(row?.r2Key).not.toContain("secret-name");
    expect(bucket.keys()).toEqual([row?.r2Key]);
    expect(JSON.stringify(await res.json())).not.toContain("r2Key");
    expect(feedbackMailbox[0]?.attachments).toHaveLength(1);
  });

  it("HTML は 415", async () => {
    const { app } = await createTestApp();
    const user = await createTestUser(app, {
      name: "A",
      email: "html-fb@example.com",
      password: "password1",
    });
    const res = await postFeedback(app, user.cookie, undefined, [
      { bytes: makeHtml(), name: "x.html", type: "image/jpeg" },
    ]);
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "unsupported_media_type" });
  });

  it("未知のフォームキーは 400。userId は無視されず拒否する", async () => {
    const { app, db } = await createTestApp();
    const user = await createTestUser(app, {
      name: "A",
      email: "inject-fb@example.com",
      password: "password1",
    });
    const res = await postFeedback(app, user.cookie, {
      category: "other",
      body: "注入",
      userId: "someone-else",
    });
    expect(res.status).toBe(400);
    expect(apiErrorBodySchema.parse(await res.json()).error).toBe("validation_error");
    expect(await db.select().from(feedbacks)).toEqual([]);
  });

  it("空本文は 400", async () => {
    const { app } = await createTestApp();
    const user = await createTestUser(app, {
      name: "A",
      email: "empty-fb@example.com",
      password: "password1",
    });
    const res = await postFeedback(app, user.cookie, { category: "improvement", body: "   " });
    expect(res.status).toBe(400);
    expect(apiErrorBodySchema.parse(await res.json()).error).toBe("validation_error");
  });

  it("画像 4 枚は 400", async () => {
    const { app } = await createTestApp();
    const user = await createTestUser(app, {
      name: "A",
      email: "photos-fb@example.com",
      password: "password1",
    });
    const res = await postFeedback(app, user.cookie, undefined, [
      { bytes: makeJpeg(40, 40) },
      { bytes: makeJpeg(40, 40) },
      { bytes: makeJpeg(40, 40) },
      { bytes: makeJpeg(40, 40) },
    ]);
    expect(res.status).toBe(400);
    expect(apiErrorBodySchema.parse(await res.json()).error).toBe("validation_error");
  });

  it("日次 4 件目は 429", async () => {
    const { app } = await createTestApp();
    const user = await createTestUser(app, {
      name: "A",
      email: "limit-fb@example.com",
      password: "password1",
    });
    for (let i = 0; i < FEEDBACK_DAILY_LIMIT; i += 1) {
      const res = await postFeedback(app, user.cookie, {
        category: "improvement",
        body: `件 ${i + 1}`,
      });
      expect(res.status).toBe(201);
    }
    const over = await postFeedback(app, user.cookie, {
      category: "improvement",
      body: "件 4",
    });
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ error: "rate_limited" });
  });

  it("通知失敗しても 201 のまま保存する", async () => {
    const { app, db } = await createTestApp({
      sendFeedback: async () => {
        throw new Error("mail boom");
      },
    });
    const user = await createTestUser(app, {
      name: "A",
      email: "mail-fail@example.com",
      password: "password1",
    });
    const res = await postFeedback(app, user.cookie);
    expect(res.status).toBe(201);
    const rows = await db.select().from(feedbacks).where(eq(feedbacks.userId, user.id));
    expect(rows).toHaveLength(1);
  });
});
