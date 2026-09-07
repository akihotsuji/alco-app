import { describe, expect, it } from "vitest";
import { takeFilesForBatch } from "./process-file.ts";

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
});
