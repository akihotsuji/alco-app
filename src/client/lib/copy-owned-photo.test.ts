import { describe, expect, it, vi } from "vitest";
import type { PhotoMeta } from "@/shared/photos.ts";
import { copyOwnedPhoto, firstPhotoId, PHOTO_COPY_FAILED } from "./copy-owned-photo.ts";

function meta(id: string): PhotoMeta {
  return {
    id,
    contentType: "image/jpeg",
    byteSize: 12,
    width: 80,
    height: 100,
    bottleId: null,
    tastingNoteId: null,
    drinkLogId: null,
    kind: "photo",
    sortOrder: 0,
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
  };
}

describe("copyOwnedPhoto", () => {
  it("内容を取って未紐付けで上げ、先頭の id だけ返す", async () => {
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    const copied = await copyOwnedPhoto("source-id", {
      fetchBlob: async (photoId) => {
        expect(photoId).toBe("source-id");
        return blob;
      },
      upload: async (file) => {
        expect(file).toBe(blob);
        return meta("new-id");
      },
      createPreview: () => "blob:preview",
    });
    expect(copied.meta.id).toBe("new-id");
    expect(copied.blob).toBe(blob);
    expect(copied.previewUrl).toBe("blob:preview");
    expect(firstPhotoId([{ id: "a" }, { id: "b" }])).toBe("a");
    expect(firstPhotoId([])).toBeNull();
  });

  it("取得失敗は投げて upload しない", async () => {
    const upload = vi.fn();
    await expect(
      copyOwnedPhoto("missing", {
        fetchBlob: async () => {
          throw new Error(PHOTO_COPY_FAILED);
        },
        upload,
        createPreview: () => "",
      }),
    ).rejects.toThrow(PHOTO_COPY_FAILED);
    expect(upload).not.toHaveBeenCalled();
  });
});
