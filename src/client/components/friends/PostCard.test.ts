import { describe, expect, it } from "vitest";
import type { SocialPost } from "@/shared/social.ts";
import { firstDisplayablePhotoId } from "./PostCard.tsx";

function post(items: SocialPost["items"]): SocialPost {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "cellar_batch",
    publishedAt: "2026-01-01T00:00:00.000Z",
    contentUpdatedAt: "2026-01-01T00:00:00.000Z",
    edited: false,
    author: {
      userId: "22222222-2222-4222-8222-222222222222",
      nickname: "テスト",
      avatarMode: "mascot",
      mascotColor: "#8E2F3C",
      hasCustomAvatar: false,
    },
    items,
    reactions: [],
    canReact: true,
    isAuthor: false,
    sourceDrinkLogId: null,
    sourceBottleId: null,
  };
}

describe("firstDisplayablePhotoId", () => {
  it("先頭アイテムに写真がなくても後続の写真を使う", () => {
    expect(
      firstDisplayablePhotoId(
        post([
          {
            name: "なし",
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
          },
          {
            name: "あり",
            producer: null,
            origin: null,
            variety: null,
            vintage: null,
            photoIds: ["33333333-3333-4333-8333-333333333333"],
            drunkOn: null,
            openedOn: null,
            ratingX10: null,
            comment: null,
            tasting: null,
          },
        ]),
      ),
    ).toBe("33333333-3333-4333-8333-333333333333");
  });
});
