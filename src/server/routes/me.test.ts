import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ageVerifications } from "@/db/schema.ts";
import { meSchema } from "@/shared/age.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { addCalendarDays, addCalendarYears, tokyoToday } from "@/shared/tokyo-date.ts";
import {
  createTestApp,
  createTestUser,
  createUnverifiedTestUser,
  TEST_VERIFIED_BIRTH_ON,
} from "../test-helpers.ts";

const LOG_BODY = { drinkType: "wine", volumeMl: 125, abvPercent: 12 } as const;

describe("GET /api/me と年齢確認", () => {
  it("未確認ユーザーの me は ageVerified: false で birthOn を出さない", async () => {
    const { app } = await createTestApp();
    const user = await createUnverifiedTestUser(app, {
      name: "未確認",
      email: "unverified@example.com",
      password: "password1",
    });

    const res = await app.request("/api/me", { headers: { Cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = meSchema.parse(await res.json());
    expect(body).toEqual({
      id: user.id,
      email: "unverified@example.com",
      name: "未確認",
      ageVerified: false,
      hasPassword: true,
      hasGoogle: false,
    });
    expect(JSON.stringify(body)).not.toContain("birthOn");
    expect(JSON.stringify(body)).not.toContain("birth_on");
  });

  it("未認証の確認 API は 401", async () => {
    const { app } = await createTestApp();
    const res = await app.request("/api/me/age-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthOn: TEST_VERIFIED_BIRTH_ON }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("未確認では drink-logs を書けず、確認後は 201", async () => {
    const { app } = await createTestApp();
    const user = await createUnverifiedTestUser(app, {
      name: "記録",
      email: "log@example.com",
      password: "password1",
    });

    const denied = await app.request("/api/drink-logs", {
      method: "POST",
      headers: { Cookie: user.cookie, "Content-Type": "application/json" },
      body: JSON.stringify(LOG_BODY),
    });
    expect(denied.status).toBe(403);
    expect(apiErrorBodySchema.parse(await denied.json())).toEqual({ error: "age_required" });

    const verify = await app.request("/api/me/age-verification", {
      method: "POST",
      headers: { Cookie: user.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ birthOn: TEST_VERIFIED_BIRTH_ON }),
    });
    expect(verify.status).toBe(200);
    const verifyBody = await verify.json();
    expect(verifyBody).toEqual({ ageVerified: true });
    expect(JSON.stringify(verifyBody)).not.toContain("birthOn");

    const created = await app.request("/api/drink-logs", {
      method: "POST",
      headers: { Cookie: user.cookie, "Content-Type": "application/json" },
      body: JSON.stringify(LOG_BODY),
    });
    expect(created.status).toBe(201);

    const me = meSchema.parse(
      await (await app.request("/api/me", { headers: { Cookie: user.cookie } })).json(),
    );
    expect(me.ageVerified).toBe(true);
    expect("birthOn" in me).toBe(false);
  });

  it("満 20 歳未満の提出は 403 で行を残さない", async () => {
    const { app, db } = await createTestApp();
    const user = await createUnverifiedTestUser(app, {
      name: "未満",
      email: "under@example.com",
      password: "password1",
    });
    const underage = addCalendarYears(tokyoToday(), -10);

    const res = await app.request("/api/me/age-verification", {
      method: "POST",
      headers: { Cookie: user.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ birthOn: underage }),
    });
    expect(res.status).toBe(403);
    const restricted = await res.json();
    expect(restricted).toEqual({ error: "age_restricted" });
    expect(JSON.stringify(restricted)).not.toContain(underage);

    const rows = await db
      .select()
      .from(ageVerifications)
      .where(eq(ageVerifications.userId, user.id));
    expect(rows).toEqual([]);
  });

  it("未来日と 1900 年より前は 400", async () => {
    const { app } = await createTestApp();
    const user = await createUnverifiedTestUser(app, {
      name: "形式",
      email: "invalid-birth@example.com",
      password: "password1",
    });

    const future = await app.request("/api/me/age-verification", {
      method: "POST",
      headers: { Cookie: user.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ birthOn: addCalendarDays(tokyoToday(), 1) }),
    });
    expect(future.status).toBe(400);
    const futureBody = apiErrorBodySchema.parse(await future.json());
    expect(futureBody.error).toBe("validation_error");
    expect(futureBody.fields?.birthOn).toBeTruthy();

    const old = await app.request("/api/me/age-verification", {
      method: "POST",
      headers: { Cookie: user.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ birthOn: "1899-12-31" }),
    });
    expect(old.status).toBe(400);
    expect(apiErrorBodySchema.parse(await old.json()).fields?.birthOn).toBeTruthy();
  });

  it("未知キーと isOver20 は 400", async () => {
    const { app } = await createTestApp();
    const user = await createUnverifiedTestUser(app, {
      name: "未知",
      email: "unknown-key@example.com",
      password: "password1",
    });

    const res = await app.request("/api/me/age-verification", {
      method: "POST",
      headers: { Cookie: user.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ birthOn: TEST_VERIFIED_BIRTH_ON, isOver20: true }),
    });
    expect(res.status).toBe(400);
    expect(apiErrorBodySchema.parse(await res.json()).error).toBe("validation_error");
  });

  it("確認済みの再 POST は 200 で生年月日を上書きしない", async () => {
    const { app, db } = await createTestApp();
    const user = await createTestUser(app, {
      name: "確認済",
      email: "verified@example.com",
      password: "password1",
    });

    const [before] = await db
      .select()
      .from(ageVerifications)
      .where(eq(ageVerifications.userId, user.id));
    expect(before?.birthOn).toBe(TEST_VERIFIED_BIRTH_ON);

    const res = await app.request("/api/me/age-verification", {
      method: "POST",
      headers: { Cookie: user.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ birthOn: "1980-06-01" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ageVerified: true });

    const [after] = await db
      .select()
      .from(ageVerifications)
      .where(eq(ageVerifications.userId, user.id));
    expect(after?.birthOn).toBe(TEST_VERIFIED_BIRTH_ON);
    expect(after?.verifiedAt).toEqual(before?.verifiedAt);
  });

  it("未確認ではセラー一覧も 403", async () => {
    const { app } = await createTestApp();
    const user = await createUnverifiedTestUser(app, {
      name: "セラー",
      email: "cellar@example.com",
      password: "password1",
    });
    const res = await app.request("/api/bottles", { headers: { Cookie: user.cookie } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "age_required" });
  });
});
