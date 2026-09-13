import { describe, expect, it } from "vitest";
import type { Bottle } from "@/shared/bottles.ts";
import type { CellarSummary } from "@/shared/cellars.ts";
import { CELLAR_PERSONAL_NAME } from "@/shared/constants.ts";
import {
  bottlesQueryCellarId,
  cellarDisplayName,
  cellarPeopleLabel,
  conflictFields,
  parseJoinHash,
  resolveSelectedCellar,
  usableStoredCellarId,
} from "./cellar-share.ts";

const personal: CellarSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "personal",
  name: "自分のセラー",
  role: "owner",
  memberCount: 1,
  revision: 1,
  bottleCount: 0,
};

const shared: CellarSummary = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "shared",
  name: "ふたりのセラー",
  role: "owner",
  memberCount: 2,
  revision: 3,
  bottleCount: 4,
};

function bottle(partial: Partial<Bottle> = {}): Bottle {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    name: "サンプル赤",
    drinkType: "wine_red",
    producer: null,
    origin: null,
    variety: null,
    vintage: 2020,
    purchasedOn: null,
    priceJpy: null,
    shop: null,
    storedOn: "2026-09-01",
    storage: "自宅セラー",
    memo: null,
    status: "sealed",
    consumedAt: null,
    consumedOn: null,
    thumbPhotoId: null,
    thumbPhotoKind: null,
    cellarId: personal.id,
    version: 1,
    createdByName: null,
    updatedByName: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    photos: [],
    ...partial,
  };
}

describe("parseJoinHash", () => {
  it("フラグメントの t だけを取る", () => {
    expect(parseJoinHash("#t=abcdefghijklmnopqrstuvwxyz012345")).toBe(
      "abcdefghijklmnopqrstuvwxyz012345",
    );
    expect(parseJoinHash("t=short")).toBeNull();
    expect(parseJoinHash("#x=abcdefghijklmnopqrstuvwxyz012345")).toBeNull();
  });
});

describe("resolveSelectedCellar", () => {
  it("保存した id があればそれを選び、無ければ個人セラーへ", () => {
    expect(resolveSelectedCellar([personal, shared], shared.id)?.id).toBe(shared.id);
    expect(resolveSelectedCellar([personal, shared], "missing")?.id).toBe(personal.id);
    expect(resolveSelectedCellar([shared], null)?.id).toBe(shared.id);
  });
});

describe("bottlesQueryCellarId", () => {
  it("未解決かつ未保存なら cellarId を付けない（個人の既定）", () => {
    expect(bottlesQueryCellarId(undefined, null)).toBeUndefined();
    expect(usableStoredCellarId("not-a-uuid")).toBeUndefined();
    expect(usableStoredCellarId(personal.id)).toBe(personal.id);
  });

  it("未解決なら保存済み UUID をそのまま使う", () => {
    expect(bottlesQueryCellarId(undefined, shared.id)).toBe(shared.id);
    expect(bottlesQueryCellarId(undefined, "bogus")).toBeUndefined();
  });

  it("個人を明示選択していなければ cellarId を省略する", () => {
    expect(bottlesQueryCellarId(personal, null)).toBeUndefined();
    expect(bottlesQueryCellarId(personal, personal.id)).toBe(personal.id);
  });

  it("共有または解決後の選択を優先する", () => {
    expect(bottlesQueryCellarId(shared, null)).toBe(shared.id);
    expect(bottlesQueryCellarId(shared, shared.id)).toBe(shared.id);
    expect(bottlesQueryCellarId(personal, shared.id)).toBe(personal.id);
  });
});

describe("cellar labels", () => {
  it("個人と共有で名前と人数を分ける", () => {
    expect(cellarDisplayName(personal)).toBe(CELLAR_PERSONAL_NAME);
    expect(cellarDisplayName(shared)).toBe("ふたりのセラー");
    expect(cellarPeopleLabel(personal)).toBe("自分だけ");
    expect(cellarPeopleLabel(shared)).toBe("2人");
  });
});

describe("conflictFields", () => {
  it("自分が変えた項目だけ自分の入力を優先する", () => {
    const initial = bottle({ name: "旧", memo: "共有メモ" });
    const mine = bottle({ name: "自分", memo: "共有メモ" });
    const current = bottle({ name: "旧", memo: "相手", version: 2 });
    const fields = conflictFields({ initial, mine, current });
    expect(fields.find((field) => field.key === "name")?.prefer).toBe("mine");
    expect(fields.find((field) => field.key === "memo")?.prefer).toBe("current");
    expect(fields.find((field) => field.key === "vintage")).toBeUndefined();
  });
});
