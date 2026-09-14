import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { takeFilesForBatch } from "./process-file.ts";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "process-file.ts"),
  "utf8",
);

function files(count: number): File[] {
  return Array.from({ length: count }, (_, index) => new File([], `p${index}.jpg`));
}

describe("takeFilesForBatch", () => {
  it("残り枠までだけ取る。0 以下は空", () => {
    expect(takeFilesForBatch(files(5), 3).map((file) => file.name)).toEqual([
      "p0.jpg",
      "p1.jpg",
      "p2.jpg",
    ]);
    expect(takeFilesForBatch(files(2), 0)).toEqual([]);
    expect(takeFilesForBatch(files(2), -1)).toEqual([]);
  });

  it("セラーまとめて登録は fifo 切り抜きと容量保証 JPEG", () => {
    const fn = source.slice(source.indexOf("export async function processCellarFile"));
    expect(fn).toContain('cutoutQueue: "fifo"');
    expect(fn).toContain('kind: "cellar"');
    expect(source).toContain("toJpegBlobWithinLimit");
  });

  it("ご意見は切り抜き・キャラ合成を呼ばない", () => {
    const fn = source.slice(source.indexOf("export async function processFeedbackFile"));
    expect(fn).toContain("fitToLongEdge");
    expect(fn).not.toContain("processPhoto");
    expect(fn).not.toContain("getComposeMascotPref");
    expect(fn).not.toContain("mascotOn");
  });
});
