import { describe, expect, it } from "vitest";
import type { PhotoMeta } from "@/shared/photos.ts";
import {
  canAddNotePhoto,
  itemsFromNotePhotos,
  movePhotoFirst,
  NOTE_PHOTO_STRIP_MAX,
  photoListStatus,
  readyPhotoIds,
  removeNotePhoto,
  samePhotoIds,
  unpersistedPhotoIds,
  upsertNotePhoto,
} from "./note-photos.ts";

function item(
  key: string,
  photoId: string | null,
  extras: Partial<{ status: "uploading" | "ready" | "error"; persisted: boolean }> = {},
) {
  return {
    key,
    photoId,
    previewUrl: `/api/photos/${photoId ?? key}/content`,
    blob: null,
    status: extras.status ?? "ready",
    persisted: extras.persisted ?? false,
  } as const;
}

function meta(id: string, sortOrder: number): PhotoMeta {
  return {
    id,
    contentType: "image/jpeg",
    byteSize: 100,
    width: 320,
    height: 400,
    bottleId: null,
    tastingNoteId: "note",
    drinkLogId: null,
    kind: "photo",
    sortOrder,
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
  };
}

describe("note-photos", () => {
  it("既存 photos の順をキーと photoId にする", () => {
    const items = itemsFromNotePhotos([meta("a", 0), meta("b", 1)]);
    expect(items.map((entry) => entry.photoId)).toEqual(["a", "b"]);
    expect(items.every((entry) => entry.persisted && entry.status === "ready")).toBe(true);
    expect(readyPhotoIds(items)).toEqual(["a", "b"]);
  });

  it("先頭化は指定キーを配列先頭へ移す。先頭の再指定は同じ順", () => {
    const items = [item("a", "a"), item("b", "b"), item("c", "c")];
    expect(movePhotoFirst(items, "c").map((entry) => entry.key)).toEqual(["c", "a", "b"]);
    expect(movePhotoFirst(items, "a").map((entry) => entry.key)).toEqual(["a", "b", "c"]);
    expect(movePhotoFirst(items, "missing")).toEqual(items);
  });

  it("6 枚で追加不可。アップロード中・失敗は status に出す", () => {
    const six = Array.from({ length: NOTE_PHOTO_STRIP_MAX }, (_, index) =>
      item(`k${index}`, `p${index}`),
    );
    expect(canAddNotePhoto(six)).toBe(false);
    expect(canAddNotePhoto(six.slice(0, 5))).toBe(true);
    expect(photoListStatus([...six.slice(0, 1), item("u", null, { status: "uploading" })])).toBe(
      "uploading",
    );
    expect(photoListStatus([item("e", null, { status: "error" })])).toBe("error");
    expect(photoListStatus([])).toBe("none");
  });

  it("差し替え判定は配列順を含める。未紐付け id だけ破棄対象", () => {
    expect(samePhotoIds(["a", "b"], ["a", "b"])).toBe(true);
    expect(samePhotoIds(["a", "b"], ["b", "a"])).toBe(false);
    expect(
      unpersistedPhotoIds([
        item("old", "old", { persisted: true }),
        item("new", "new", { persisted: false }),
        item("up", null, { status: "uploading", persisted: false }),
      ]),
    ).toEqual(["new"]);
  });

  it("upsert は同じキーを置き換え、7 枚目は捨てる", () => {
    const first = upsertNotePhoto([], "k1", item("k1", "p1"));
    const updated = upsertNotePhoto(first, "k1", item("k1", "p2"));
    expect(readyPhotoIds(updated)).toEqual(["p2"]);
    const six = Array.from({ length: NOTE_PHOTO_STRIP_MAX }, (_, index) =>
      item(`k${index}`, `p${index}`),
    );
    expect(upsertNotePhoto(six, "extra", item("extra", "px"))).toHaveLength(6);
    expect(removeNotePhoto(six, "k0")).toHaveLength(5);
  });
});
