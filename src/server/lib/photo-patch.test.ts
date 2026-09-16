import { describe, expect, it } from "vitest";
import { photosRemovedByPatch } from "./photo-patch.ts";

describe("photosRemovedByPatch", () => {
  const current = [{ id: "front" }, { id: "back" }];

  it("photoIds 未指定は1枚も外さない", () => {
    expect(photosRemovedByPatch(current, undefined)).toEqual([]);
  });

  it("空配列は既存をすべて外す", () => {
    expect(photosRemovedByPatch(current, [])).toEqual(current);
  });

  it("残す id 以外を外す", () => {
    expect(photosRemovedByPatch(current, [{ id: "front" }])).toEqual([{ id: "back" }]);
    expect(photosRemovedByPatch(current, [{ id: "front" }, { id: "back" }])).toEqual([]);
  });
});
