import { describe, expect, it } from "vitest";
import {
  createDrinkLogSchema,
  DRINK_LOG_MESSAGES,
  DRINK_LOG_SUMMARY_MESSAGES,
  DRUNK_AT_FUTURE_TOLERANCE_MS,
  drinkLogSummaryQuerySchema,
  hasAtMostOneDecimal,
  isDrunkAtAllowed,
  normalizeMemo,
} from "./drink-logs.ts";
import "./zod-config.ts";

const BASE = { drinkType: "wine", volumeMl: 125, abvPercent: 12 } as const;
const UUID = "11111111-1111-4111-8111-111111111111";

function messagesOf(input: unknown): Record<string, string[]> {
  const result = createDrinkLogSchema.safeParse(input);
  if (result.success) {
    return {};
  }
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".");
    fields[key] = [...(fields[key] ?? []), issue.message];
  }
  return fields;
}

describe("createDrinkLogSchema", () => {
  it("初期値（ワイン 125 / 12）がそのまま通る", () => {
    const parsed = createDrinkLogSchema.parse(BASE);
    expect(parsed).toEqual(BASE);
  });

  it("任意項目を null / 配列で受ける", () => {
    const parsed = createDrinkLogSchema.parse({
      ...BASE,
      drunkAt: "2026-09-04T11:00:00.000Z",
      memo: null,
      myDrinkId: null,
      bottleId: UUID,
      photoIds: [UUID],
    });
    expect(parsed.bottleId).toBe(UUID);
    expect(parsed.photoIds).toEqual([UUID]);
  });

  it("量は整数 1〜5000（小数も同文）", () => {
    expect(messagesOf({ ...BASE, volumeMl: 0 }).volumeMl).toEqual([DRINK_LOG_MESSAGES.volumeMl]);
    expect(messagesOf({ ...BASE, volumeMl: 5001 }).volumeMl).toEqual([DRINK_LOG_MESSAGES.volumeMl]);
    expect(messagesOf({ ...BASE, volumeMl: 12.5 }).volumeMl).toEqual([DRINK_LOG_MESSAGES.volumeMl]);
    expect(messagesOf({ ...BASE, volumeMl: "125" }).volumeMl).toEqual([
      DRINK_LOG_MESSAGES.volumeMl,
    ]);
    expect(createDrinkLogSchema.safeParse({ ...BASE, volumeMl: 1 }).success).toBe(true);
    expect(createDrinkLogSchema.safeParse({ ...BASE, volumeMl: 5000 }).success).toBe(true);
  });

  it("度数は 0〜100、小数第 1 位まで。0 は可", () => {
    expect(createDrinkLogSchema.safeParse({ ...BASE, abvPercent: 0 }).success).toBe(true);
    expect(createDrinkLogSchema.safeParse({ ...BASE, abvPercent: 100 }).success).toBe(true);
    expect(createDrinkLogSchema.safeParse({ ...BASE, abvPercent: 12.3 }).success).toBe(true);
    expect(messagesOf({ ...BASE, abvPercent: -0.1 }).abvPercent).toEqual([
      DRINK_LOG_MESSAGES.abvPercent,
    ]);
    expect(messagesOf({ ...BASE, abvPercent: 100.1 }).abvPercent).toEqual([
      DRINK_LOG_MESSAGES.abvPercent,
    ]);
    expect(messagesOf({ ...BASE, abvPercent: 12.34 }).abvPercent).toEqual([
      DRINK_LOG_MESSAGES.abvDecimals,
    ]);
  });

  it("種類は 7 種の enum", () => {
    expect(messagesOf({ ...BASE, drinkType: "vodka" }).drinkType).toEqual([
      DRINK_LOG_MESSAGES.drinkType,
    ]);
    expect(messagesOf({ volumeMl: 125, abvPercent: 12 }).drinkType).toEqual([
      DRINK_LOG_MESSAGES.drinkType,
    ]);
  });

  it("日時は ISO 8601。未来は +15 分まで", () => {
    expect(messagesOf({ ...BASE, drunkAt: "2026-09-04 20:00" }).drunkAt).toEqual([
      DRINK_LOG_MESSAGES.drunkAtFormat,
    ]);
    const future = new Date(Date.now() + DRUNK_AT_FUTURE_TOLERANCE_MS + 60_000).toISOString();
    expect(messagesOf({ ...BASE, drunkAt: future }).drunkAt).toEqual([
      DRINK_LOG_MESSAGES.drunkAtFuture,
    ]);
    const nearFuture = new Date(Date.now() + DRUNK_AT_FUTURE_TOLERANCE_MS - 60_000).toISOString();
    expect(createDrinkLogSchema.safeParse({ ...BASE, drunkAt: nearFuture }).success).toBe(true);
    expect(
      createDrinkLogSchema.safeParse({ ...BASE, drunkAt: "2000-01-01T00:00:00.000Z" }).success,
    ).toBe(true);
  });

  it("メモは 500 文字まで", () => {
    expect(createDrinkLogSchema.safeParse({ ...BASE, memo: "a".repeat(500) }).success).toBe(true);
    expect(messagesOf({ ...BASE, memo: "a".repeat(501) }).memo).toEqual([DRINK_LOG_MESSAGES.memo]);
  });

  it("写真は 1 枚まで、参照 ID は UUID", () => {
    expect(messagesOf({ ...BASE, photoIds: [UUID, UUID] }).photoIds).toEqual([
      DRINK_LOG_MESSAGES.photoIdsMax,
    ]);
    expect(messagesOf({ ...BASE, photoIds: ["x"] })["photoIds.0"]).toBeDefined();
    expect(messagesOf({ ...BASE, bottleId: "x" }).bottleId).toBeDefined();
    expect(messagesOf({ ...BASE, myDrinkId: "x" }).myDrinkId).toBeDefined();
  });

  it('alcoholG / drunkOn / userId / id は未知キーとしてルート `""` に出る', () => {
    for (const key of ["alcoholG", "drunkOn", "userId", "id"]) {
      const fields = messagesOf({ ...BASE, [key]: 1 });
      expect(fields[""], key).toBeDefined();
    }
  });
});

describe("helpers", () => {
  it("hasAtMostOneDecimal は浮動小数の誤差を吸収する", () => {
    expect(hasAtMostOneDecimal(12.3)).toBe(true);
    expect(hasAtMostOneDecimal(0.1 + 0.2)).toBe(false);
    expect(hasAtMostOneDecimal(12.34)).toBe(false);
    expect(hasAtMostOneDecimal(Number.NaN)).toBe(false);
  });

  it("isDrunkAtAllowed は now + 15 分を境界にする", () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    expect(isDrunkAtAllowed(new Date("2026-09-05T12:15:00.000Z"), now)).toBe(true);
    expect(isDrunkAtAllowed(new Date("2026-09-05T12:15:00.001Z"), now)).toBe(false);
    expect(isDrunkAtAllowed(new Date("2000-01-01T00:00:00.000Z"), now)).toBe(true);
  });

  it("normalizeMemo は trim して空なら null", () => {
    expect(normalizeMemo(undefined)).toBeNull();
    expect(normalizeMemo(null)).toBeNull();
    expect(normalizeMemo("   \n ")).toBeNull();
    expect(normalizeMemo("  美味しい  ")).toBe("美味しい");
  });
});

describe("drinkLogSummaryQuerySchema", () => {
  it("day / week / month と実在する日付だけ受ける", () => {
    for (const period of ["day", "week", "month"]) {
      expect(drinkLogSummaryQuerySchema.safeParse({ period, date: "2026-09-06" }).success).toBe(
        true,
      );
    }
    const period = drinkLogSummaryQuerySchema.safeParse({
      period: "year",
      date: "2026-09-06",
    });
    expect(period.success).toBe(false);
    if (!period.success) {
      expect(period.error.issues[0]?.message).toBe(DRINK_LOG_SUMMARY_MESSAGES.period);
    }
    const date = drinkLogSummaryQuerySchema.safeParse({
      period: "day",
      date: "2026-02-30",
    });
    expect(date.success).toBe(false);
    if (!date.success) {
      expect(date.error.issues[0]?.message).toBe(DRINK_LOG_SUMMARY_MESSAGES.date);
    }
  });

  it("未知キーを拒否する", () => {
    expect(
      drinkLogSummaryQuerySchema.safeParse({
        period: "day",
        date: "2026-09-06",
        userId: "x",
      }).success,
    ).toBe(false);
  });
});
