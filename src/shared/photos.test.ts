import { describe, expect, it } from "vitest";
import {
  PHOTO_SINGLE_OWNER_MESSAGE,
  photoOwnerIds,
  photoPatchSchema,
  photoUploadFieldsSchema,
} from "./photos.ts";

const BOTTLE = "11111111-1111-4111-8111-111111111111";
const NOTE = "22222222-2222-4222-8222-222222222222";
const LOG = "33333333-3333-4333-8333-333333333333";

describe("photoOwnerIds", () => {
  it("文字列の ID だけ数える", () => {
    expect(photoOwnerIds({})).toEqual([]);
    expect(photoOwnerIds({ bottleId: BOTTLE, tastingNoteId: null, drinkLogId: undefined })).toEqual(
      [BOTTLE],
    );
    expect(photoOwnerIds({ bottleId: BOTTLE, tastingNoteId: NOTE })).toEqual([BOTTLE, NOTE]);
  });
});

describe("photo owner refine", () => {
  it("アップロードは紐付け 1 つまで", () => {
    expect(photoUploadFieldsSchema.parse({ bottleId: BOTTLE }).bottleId).toBe(BOTTLE);
    const result = photoUploadFieldsSchema.safeParse({ bottleId: BOTTLE, tastingNoteId: NOTE });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message === PHOTO_SINGLE_OWNER_MESSAGE),
      ).toBe(true);
    }
  });

  it("パッチも紐付け 1 つまで", () => {
    expect(photoPatchSchema.parse({ drinkLogId: LOG }).drinkLogId).toBe(LOG);
    const result = photoPatchSchema.safeParse({ bottleId: BOTTLE, drinkLogId: LOG });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message === PHOTO_SINGLE_OWNER_MESSAGE),
      ).toBe(true);
    }
  });
});
