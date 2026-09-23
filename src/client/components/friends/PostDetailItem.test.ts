import { describe, expect, it } from "vitest";
import type { SocialPostItem } from "@/shared/social.ts";
import { postItemDates, postItemMeta } from "./PostDetailItem.tsx";

function item(patch: Partial<SocialPostItem> = {}): SocialPostItem {
  return {
    name: "Storm Vrede Pinot Noir",
    producer: null,
    origin: null,
    variety: null,
    vintage: null,
    photoIds: [],
    drunkOn: null,
    openedOn: null,
    ratingX10: null,
    comment: null,
    tasting: null,
    ...patch,
  };
}

describe("PostDetailItem の本文", () => {
  it("生産者・国・品種・年を 1 行にまとめ、無い値は飛ばす", () => {
    expect(
      postItemMeta(
        item({
          producer: "Storm Wines",
          origin: "南アフリカ",
          variety: "Pinot Noir",
          vintage: 2022,
        }),
      ),
    ).toBe("Storm Wines ・ 南アフリカ ・ Pinot Noir ・ 2022");
    expect(postItemMeta(item({ producer: "BLANKBOTTLE", vintage: 2023 }))).toBe(
      "BLANKBOTTLE ・ 2023",
    );
    expect(postItemMeta(item())).toBe("");
  });

  it("開栓日と飲んだ日を 1 行にまとめる", () => {
    expect(postItemDates(item({ openedOn: "2026-09-22", drunkOn: "2026-09-22" }))).toBe(
      "開栓した日 2026-09-22 ・ 飲んだ日 2026-09-22",
    );
    expect(postItemDates(item({ drunkOn: "2026-09-20" }))).toBe("飲んだ日 2026-09-20");
    expect(postItemDates(item())).toBe("");
  });
});
