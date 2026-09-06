import { describe, expect, it } from "vitest";
import { drinkLogs } from "@/db/schema.ts";
import { apiErrorBodySchema } from "@/shared/api-error.ts";
import { DRINK_LOG_SUMMARY_MESSAGES, drinkLogSummarySchema } from "@/shared/drink-logs.ts";
import { addCalendarDays, isoWeekDates, tokyoToday } from "@/shared/tokyo-date.ts";
import { createTestApp, createTestUserPair, type TestUser } from "../test-helpers.ts";

type Ctx = Awaited<ReturnType<typeof createTestApp>>;

async function users(ctx: Ctx): Promise<[TestUser, TestUser]> {
  return createTestUserPair(ctx.app, [
    { name: "A", email: "a@example.com", password: "password1" },
    { name: "B", email: "b@example.com", password: "password1" },
  ]);
}

async function seedLog(
  ctx: Ctx,
  userId: string,
  input: { drunkOn: string; alcoholG: number; abvPercent?: number },
) {
  const now = new Date();
  await ctx.db.insert(drinkLogs).values({
    id: crypto.randomUUID(),
    userId,
    drunkAt: now,
    drunkOn: input.drunkOn,
    drinkType: "wine",
    drinkName: null,
    volumeMl: 125,
    abvPercent: input.abvPercent ?? 12,
    alcoholG: input.alcoholG,
    memo: null,
    myDrinkId: null,
    bottleId: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function fields(response: Response) {
  const body = apiErrorBodySchema.parse(await response.json());
  expect(body.error).toBe("validation_error");
  return body.fields ?? {};
}

describe("GET /api/drink-logs/summary", () => {
  it("未認証は 401。固定 /summary として処理される", async () => {
    const ctx = await createTestApp();
    const unauthorized = await ctx.app.request(
      "/api/drink-logs/summary?period=day&date=2026-09-06",
    );
    expect(unauthorized.status).toBe(401);

    const [a] = await users(ctx);
    const authorized = await ctx.app.request("/api/drink-logs/summary?period=day&date=2026-09-06", {
      headers: { Cookie: a.cookie },
    });
    expect(authorized.status).toBe(200);
    expect(drinkLogSummarySchema.parse(await authorized.json()).period).toBe("day");
  });

  it("period/date/未知クエリを shared schema で拒否する", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    const period = await ctx.app.request("/api/drink-logs/summary?period=year&date=2026-09-06", {
      headers: { Cookie: a.cookie },
    });
    expect(period.status).toBe(400);
    expect((await fields(period)).period).toEqual([DRINK_LOG_SUMMARY_MESSAGES.period]);

    const date = await ctx.app.request("/api/drink-logs/summary?period=day&date=2026-02-30", {
      headers: { Cookie: a.cookie },
    });
    expect(date.status).toBe(400);
    expect((await fields(date)).date).toEqual([DRINK_LOG_SUMMARY_MESSAGES.date]);

    const unknown = await ctx.app.request(
      "/api/drink-logs/summary?period=day&date=2026-09-06&userId=x",
      { headers: { Cookie: a.cookie } },
    );
    expect(unknown.status).toBe(400);
    expect((await fields(unknown))[""]).toBeDefined();
  });

  it("day は JST 日で集計し、他人を混ぜず、0% の行も休肝日にしない", async () => {
    const ctx = await createTestApp();
    const [a, b] = await users(ctx);
    const date = "2026-09-05";
    await seedLog(ctx, a.id, { drunkOn: date, alcoholG: 0, abvPercent: 0 });
    await seedLog(ctx, b.id, { drunkOn: date, alcoholG: 99 });
    await seedLog(ctx, a.id, { drunkOn: "2026-09-04", alcoholG: 12 });

    const response = await ctx.app.request(`/api/drink-logs/summary?period=day&date=${date}`, {
      headers: { Cookie: a.cookie },
    });
    expect(response.status).toBe(200);
    const summary = drinkLogSummarySchema.parse(await response.json());
    expect(summary).toMatchObject({
      period: "day",
      from: date,
      to: date,
      timezone: "Asia/Tokyo",
      totalCount: 1,
      totalAlcoholG: 0,
      dryDayCount: 0,
    });
    expect(summary.days).toEqual([
      { date, count: 1, alcoholG: 0, isDryDay: false, isFuture: false },
    ]);
  });

  it("week は ISO 月曜始まりの7日を返し、未来日を休肝日数から除く", async () => {
    const ctx = await createTestApp();
    const [a, b] = await users(ctx);
    const today = tokyoToday();
    const dates = isoWeekDates(today);
    await seedLog(ctx, a.id, { drunkOn: today, alcoholG: 12 });
    await seedLog(ctx, b.id, { drunkOn: today, alcoholG: 99 });

    const response = await ctx.app.request(`/api/drink-logs/summary?period=week&date=${today}`, {
      headers: { Cookie: a.cookie },
    });
    const summary = drinkLogSummarySchema.parse(await response.json());
    expect(summary.from).toBe(dates[0]);
    expect(summary.to).toBe(dates[6]);
    expect(summary.days).toHaveLength(7);
    expect(summary.totalCount).toBe(1);
    expect(summary.totalAlcoholG).toBe(12);

    const todayIndex = dates.indexOf(today);
    expect(summary.dryDayCount).toBe(todayIndex);
    for (const day of summary.days) {
      expect(day.isFuture).toBe(day.date > today);
      if (day.date > today) {
        expect(day.isDryDay).toBe(false);
      }
    }
  });

  it("month は暦月の全日を返し、月境界外を含めない", async () => {
    const ctx = await createTestApp();
    const [a] = await users(ctx);
    await seedLog(ctx, a.id, { drunkOn: "2024-02-01", alcoholG: 1.23 });
    await seedLog(ctx, a.id, { drunkOn: "2024-02-29", alcoholG: 2.34 });
    await seedLog(ctx, a.id, { drunkOn: addCalendarDays("2024-02-29", 1), alcoholG: 99 });

    const response = await ctx.app.request("/api/drink-logs/summary?period=month&date=2024-02-15", {
      headers: { Cookie: a.cookie },
    });
    const summary = drinkLogSummarySchema.parse(await response.json());
    expect(summary.from).toBe("2024-02-01");
    expect(summary.to).toBe("2024-02-29");
    expect(summary.days).toHaveLength(29);
    expect(summary.totalCount).toBe(2);
    expect(summary.totalAlcoholG).toBe(3.57);
    expect(summary.dryDayCount).toBe(27);
  });
});
