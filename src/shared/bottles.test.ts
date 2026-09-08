import { describe, expect, it } from "vitest";
import "./zod-config.ts";
import {
  arrangedToastMessage,
  BOTTLE_MESSAGES,
  bottlesQuerySchema,
  createBottleSchema,
  emptyCountsByType,
  emptyJsonBodySchema,
  escapeLike,
  formatBottleCount,
  isPurchasedOnAllowed,
  normalizeOptionalText,
  updateBottleSchema,
} from "./bottles.ts";

const UUID = "11111111-1111-4111-8111-111111111111";
const BASE = { name: "サンプル赤", drinkType: "wine" } as const;

function messagesOf(schema: typeof createBottleSchema | typeof updateBottleSchema, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    return {};
  }
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".") || "";
    fields[key] = [...(fields[key] ?? []), issue.message];
  }
  return fields;
}

describe("createBottleSchema", () => {
  it("必須の銘柄名と種類だけで通る。count 省略は後段で 1", () => {
    const parsed = createBottleSchema.parse(BASE);
    expect(parsed).toEqual(BASE);
    expect(parsed.count).toBeUndefined();
  });

  it("任意項目と count / photoIds を受ける", () => {
    const parsed = createBottleSchema.parse({
      ...BASE,
      producer: "生産者",
      origin: "フランス",
      vintage: 2020,
      purchasedOn: "2026-06-01",
      priceJpy: 3800,
      shop: "酒店",
      storedOn: "2026-06-02",
      storage: "リビング",
      memo: "メモ",
      count: 3,
      photoIds: [UUID],
    });
    expect(parsed.count).toBe(3);
    expect(parsed.vintage).toBe(2020);
    expect(parsed.photoIds).toEqual([UUID]);
  });

  it("status / userId は未知キーとして落とす", () => {
    expect(messagesOf(createBottleSchema, { ...BASE, status: "sealed" })[""]).toBeDefined();
    expect(messagesOf(createBottleSchema, { ...BASE, userId: UUID })[""]).toBeDefined();
    expect(messagesOf(createBottleSchema, { ...BASE, consumedOn: "2026-09-01" })[""]).toBeDefined();
  });

  it("銘柄名・本数・写真枚数の範囲", () => {
    expect(messagesOf(createBottleSchema, { ...BASE, name: "" }).name).toEqual([
      BOTTLE_MESSAGES.name,
    ]);
    expect(messagesOf(createBottleSchema, { ...BASE, name: "a".repeat(101) }).name).toEqual([
      BOTTLE_MESSAGES.name,
    ]);
    expect(messagesOf(createBottleSchema, { ...BASE, count: 0 }).count).toEqual([
      BOTTLE_MESSAGES.count,
    ]);
    expect(messagesOf(createBottleSchema, { ...BASE, count: 13 }).count).toEqual([
      BOTTLE_MESSAGES.count,
    ]);
    expect(messagesOf(createBottleSchema, { ...BASE, photoIds: [UUID, UUID] }).photoIds).toEqual([
      BOTTLE_MESSAGES.photoIdsMax,
    ]);
  });

  it("年・価格・購入日", () => {
    expect(messagesOf(createBottleSchema, { ...BASE, vintage: 1799 }).vintage).toEqual([
      BOTTLE_MESSAGES.vintage,
    ]);
    expect(messagesOf(createBottleSchema, { ...BASE, vintage: 2101 }).vintage).toEqual([
      BOTTLE_MESSAGES.vintage,
    ]);
    expect(messagesOf(createBottleSchema, { ...BASE, priceJpy: -1 }).priceJpy).toEqual([
      BOTTLE_MESSAGES.priceJpy,
    ]);
    expect(messagesOf(createBottleSchema, { ...BASE, priceJpy: 1.5 }).priceJpy).toEqual([
      BOTTLE_MESSAGES.priceJpy,
    ]);
    expect(
      messagesOf(createBottleSchema, { ...BASE, purchasedOn: "2026-02-30" }).purchasedOn,
    ).toEqual([BOTTLE_MESSAGES.purchasedOn]);
    expect(messagesOf(createBottleSchema, { ...BASE, storedOn: "2026-02-30" }).storedOn).toEqual([
      BOTTLE_MESSAGES.storedOn,
    ]);
  });
});

describe("updateBottleSchema", () => {
  it("空オブジェクトは 400 相当", () => {
    expect(messagesOf(updateBottleSchema, {})[""]).toEqual([BOTTLE_MESSAGES.patchEmpty]);
  });

  it("count / status は受け取らない", () => {
    expect(messagesOf(updateBottleSchema, { count: 2 })[""]).toBeDefined();
    expect(messagesOf(updateBottleSchema, { status: "consumed" })[""]).toBeDefined();
  });

  it("部分更新を受ける", () => {
    expect(updateBottleSchema.parse({ name: "改名" })).toEqual({ name: "改名" });
    expect(updateBottleSchema.parse({ vintage: null, memo: null })).toEqual({
      vintage: null,
      memo: null,
    });
  });
});

describe("bottlesQuerySchema", () => {
  it("省略時は cellar / limit 50", () => {
    expect(bottlesQuerySchema.parse({})).toEqual({ view: "cellar", limit: 50 });
  });

  it("view / q / drinkType を受ける", () => {
    const parsed = bottlesQuerySchema.parse({
      view: "all",
      q: "赤",
      drinkType: "wine",
      limit: "12",
    });
    expect(parsed).toEqual({ view: "all", q: "赤", drinkType: "wine", limit: 12 });
  });

  it("不正な view / 長すぎる q はエラー", () => {
    const view = bottlesQuerySchema.safeParse({ view: "opened" });
    expect(view.success).toBe(false);
    const q = bottlesQuerySchema.safeParse({ q: "x".repeat(101) });
    expect(q.success).toBe(false);
  });

  it("drinkType=evil と未知キー status はエラー", () => {
    expect(bottlesQuerySchema.safeParse({ drinkType: "evil" }).success).toBe(false);
    expect(bottlesQuerySchema.safeParse({ status: "evil" }).success).toBe(false);
  });
});

describe("emptyJsonBodySchema", () => {
  it("空オブジェクトと未知キー", () => {
    expect(emptyJsonBodySchema.safeParse({}).success).toBe(true);
    expect(messagesOfEmpty({ log: true })[""]).toBeDefined();
    expect(messagesOfEmpty({ status: "consumed" })[""]).toBeDefined();
  });
});

function messagesOfEmpty(input: unknown) {
  const result = emptyJsonBodySchema.safeParse(input);
  if (result.success) {
    return {};
  }
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".") || "";
    fields[key] = [...(fields[key] ?? []), issue.message];
  }
  return fields;
}

describe("escapeLike / helpers", () => {
  it("% と _ と \\ をリテラルにする", () => {
    expect(escapeLike("100%_赤\\")).toBe("100\\%\\_赤\\\\");
  });

  it("任意テキストは trim して空なら null", () => {
    expect(normalizeOptionalText("  生産者  ")).toBe("生産者");
    expect(normalizeOptionalText("  \n ")).toBeNull();
    expect(normalizeOptionalText(null)).toBeNull();
  });

  it("購入日は今日まで（未来不可）", () => {
    const now = new Date("2026-09-06T03:00:00.000Z");
    expect(isPurchasedOnAllowed("2026-09-06", now)).toBe(true);
    expect(isPurchasedOnAllowed("2026-09-07", now)).toBe(false);
    expect(isPurchasedOnAllowed("2026-02-30", now)).toBe(false);
  });

  it("本数表示と並べたトースト", () => {
    expect(formatBottleCount(12)).toBe("12 本");
    expect(arrangedToastMessage(1)).toBe("棚に並べました");
    expect(arrangedToastMessage(3)).toBe("棚に 3 本並べました");
    expect(emptyCountsByType().wine).toBe(0);
    expect(Object.keys(emptyCountsByType())).toHaveLength(7);
  });
});
