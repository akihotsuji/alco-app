import { describe, expect, it } from "vitest";
import {
  createMyDrinkSchema,
  MY_DRINK_MESSAGES,
  myDrinkIdParamSchema,
  myDrinksQuerySchema,
  oneTapDrinkLogSchema,
  updateMyDrinkSchema,
} from "./my-drinks.ts";
import "./zod-config.ts";

const BASE = {
  name: "いつもの",
  drinkType: "wine",
  volumeMl: 125,
  abvPercent: 12,
} as const;

function issues(
  schema: {
    safeParse: (input: unknown) => {
      success: boolean;
      error?: { issues: { path: PropertyKey[]; message: string }[] };
    };
  },
  input: unknown,
) {
  const result = schema.safeParse(input);
  if (result.success || !result.error) {
    return {};
  }
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.map(String).join("."), issue.message]),
  );
}

describe("createMyDrinkSchema", () => {
  it("名前を trim し、1〜40文字を受ける", () => {
    expect(createMyDrinkSchema.parse({ ...BASE, name: "  いつもの  " }).name).toBe("いつもの");
    expect(createMyDrinkSchema.safeParse({ ...BASE, name: "a".repeat(40) }).success).toBe(true);
    expect(issues(createMyDrinkSchema, { ...BASE, name: "   " }).name).toBe(MY_DRINK_MESSAGES.name);
    expect(issues(createMyDrinkSchema, { ...BASE, name: ` ${"a".repeat(41)} ` }).name).toBe(
      MY_DRINK_MESSAGES.name,
    );
  });

  it("種類・量・度数・並び順を記録と同じ境界で検証する", () => {
    expect(createMyDrinkSchema.safeParse({ ...BASE, sortOrder: 0 }).success).toBe(true);
    expect(issues(createMyDrinkSchema, { ...BASE, drinkType: "vodka" }).drinkType).toBeDefined();
    expect(issues(createMyDrinkSchema, { ...BASE, volumeMl: 0 }).volumeMl).toBeDefined();
    expect(issues(createMyDrinkSchema, { ...BASE, abvPercent: 12.34 }).abvPercent).toBeDefined();
    expect(issues(createMyDrinkSchema, { ...BASE, sortOrder: -1 }).sortOrder).toBe(
      MY_DRINK_MESSAGES.sortOrder,
    );
  });

  it("POST は未知キーを拒否する", () => {
    expect(issues(createMyDrinkSchema, { ...BASE, userId: "x" })[""]).toBeDefined();
  });
});

describe("updateMyDrinkSchema", () => {
  it("部分更新を受け、空と未知キーを拒否する", () => {
    expect(updateMyDrinkSchema.parse({ name: "  新しい名前 " })).toEqual({ name: "新しい名前" });
    expect(issues(updateMyDrinkSchema, {})[""]).toBe(MY_DRINK_MESSAGES.patchEmpty);
    expect(issues(updateMyDrinkSchema, { createdAt: "x" })[""]).toBeDefined();
  });
});

describe("1tap / param / paging schemas", () => {
  it("1tap は drunkAt / memo だけ受け、プリセット値の混入を拒否する", () => {
    expect(oneTapDrinkLogSchema.safeParse({ memo: "メモ" }).success).toBe(true);
    for (const field of ["drinkType", "volumeMl", "abvPercent"]) {
      expect(issues(oneTapDrinkLogSchema, { [field]: 1 })[""], field).toBeDefined();
    }
  });

  it("id は UUID に限定する", () => {
    expect(
      myDrinkIdParamSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111" }).success,
    ).toBe(true);
    expect(myDrinkIdParamSchema.safeParse({ id: "not-uuid" }).success).toBe(false);
  });

  it("limit は既定50・1〜100、cursor は空を拒否する", () => {
    expect(myDrinksQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(myDrinksQuerySchema.parse({ limit: "30" }).limit).toBe(30);
    expect(issues(myDrinksQuerySchema, { limit: "0" }).limit).toBe(MY_DRINK_MESSAGES.limit);
    expect(issues(myDrinksQuerySchema, { cursor: "" }).cursor).toBe(MY_DRINK_MESSAGES.cursor);
  });
});
