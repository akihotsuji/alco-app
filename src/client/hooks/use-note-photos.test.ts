import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "use-note-photos.ts"),
  "utf8",
);

describe("useNotePhotos 回帰", () => {
  it("ノートはまとめて登録の変換・アップロードキューを使わない", () => {
    expect(source).toContain('startCapture("note"');
    expect(source).toContain("retryCollectedUpload");
    expect(source).not.toContain("acceptFilesForBatch");
    expect(source).not.toContain("runBatchPhotoJobs");
    expect(source).not.toContain("processCellarFile");
  });
});
