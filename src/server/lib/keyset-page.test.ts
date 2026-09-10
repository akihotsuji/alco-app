import { describe, expect, it } from "vitest";
import { takeLimitPlusOne } from "./keyset-page.ts";

describe("takeLimitPlusOne", () => {
  it("limit+1 件なら次ページありとして先頭 limit を返す", () => {
    expect(takeLimitPlusOne([1, 2, 3], 2)).toEqual({ page: [1, 2], hasMore: true });
    expect(takeLimitPlusOne([1, 2], 2)).toEqual({ page: [1, 2], hasMore: false });
    expect(takeLimitPlusOne([], 2)).toEqual({ page: [], hasMore: false });
  });
});
