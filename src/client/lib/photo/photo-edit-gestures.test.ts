import { describe, expect, it } from "vitest";
import { PHOTO_SCALE_MAX } from "@/shared/constants.ts";
import {
  beginPhotoEditPointer,
  clampOffset,
  createPhotoEditGestureState,
  distanceBetween,
  endPhotoEditPointer,
  movePhotoEditPointer,
} from "./photo-edit-gestures.ts";

describe("photo-edit gestures", () => {
  it("1 本指は capture、2 本目で capture を解除してピンチにする（iOS）", () => {
    const state = createPhotoEditGestureState();
    expect(beginPhotoEditPointer(state, 1, { x: 0, y: 0 }, 1)).toEqual({
      capture: true,
      releaseCaptures: false,
    });
    expect(beginPhotoEditPointer(state, 2, { x: 30, y: 40 }, 1.2)).toEqual({
      capture: false,
      releaseCaptures: true,
    });
    expect(state.pinch).toEqual({ distance: 50, scale: 1.2 });
  });

  it("1 本指の移動は枠サイズで正規化したパン量", () => {
    const state = createPhotoEditGestureState();
    beginPhotoEditPointer(state, 1, { x: 10, y: 10 }, 1);
    expect(movePhotoEditPointer(state, 1, { x: 20, y: 30 }, { width: 100, height: 200 })).toEqual({
      type: "pan",
      deltaX: 0.2,
      deltaY: 0.2,
    });
  });

  it("2 本指は距離比で拡縮し、指を離すとピンチを終わる", () => {
    const state = createPhotoEditGestureState();
    beginPhotoEditPointer(state, 1, { x: 0, y: 0 }, 1);
    beginPhotoEditPointer(state, 2, { x: 40, y: 0 }, 1);
    expect(movePhotoEditPointer(state, 2, { x: 80, y: 0 }, { width: 100, height: 100 })).toEqual({
      type: "pinch",
      scale: 2,
    });
    const stretched = movePhotoEditPointer(state, 2, { x: 400, y: 0 }, { width: 100, height: 100 });
    expect(stretched).toEqual({ type: "pinch", scale: PHOTO_SCALE_MAX });
    endPhotoEditPointer(state, 2);
    expect(state.pinch).toBeNull();
    expect(movePhotoEditPointer(state, 1, { x: 10, y: 0 }, { width: 100, height: 100 })?.type).toBe(
      "pan",
    );
  });

  it("未知の pointer とオフセットのクランプ", () => {
    const state = createPhotoEditGestureState();
    expect(movePhotoEditPointer(state, 9, { x: 1, y: 1 }, { width: 10, height: 10 })).toBeNull();
    expect(clampOffset(2)).toBe(1);
    expect(clampOffset(-3)).toBe(-1);
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
