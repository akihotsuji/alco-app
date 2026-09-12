import { clampScale } from "./geometry.ts";

export type GesturePoint = { x: number; y: number };

export type PinchState = {
  distance: number;
  scale: number;
};

export type PhotoEditGestureState = {
  pointers: Map<number, GesturePoint>;
  pinch: PinchState | null;
};

export function createPhotoEditGestureState(): PhotoEditGestureState {
  return { pointers: new Map(), pinch: null };
}

export function distanceBetween(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, b.y - a.y);
}

export function clampOffset(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

/**
 * iOS Safari は setPointerCapture 中に 2 本目の pointer が来ない／壊れる。
 * 1 本指だけ capture し、ピンチ開始で解除する。
 */
export function beginPhotoEditPointer(
  state: PhotoEditGestureState,
  pointerId: number,
  point: GesturePoint,
  currentScale: number,
): { capture: boolean; releaseCaptures: boolean } {
  state.pointers.set(pointerId, point);
  if (state.pointers.size >= 2) {
    const points = [...state.pointers.values()];
    const first = points[0];
    const second = points[1];
    if (first && second) {
      state.pinch = { distance: distanceBetween(first, second), scale: currentScale };
    }
    return { capture: false, releaseCaptures: true };
  }
  state.pinch = null;
  return { capture: true, releaseCaptures: false };
}

export type PhotoEditPointerMove =
  | { type: "pinch"; scale: number }
  | { type: "pan"; deltaX: number; deltaY: number };

export function movePhotoEditPointer(
  state: PhotoEditGestureState,
  pointerId: number,
  point: GesturePoint,
  frame: { width: number; height: number },
): PhotoEditPointerMove | null {
  const prev = state.pointers.get(pointerId);
  if (!prev) {
    return null;
  }
  state.pointers.set(pointerId, point);
  if (state.pointers.size >= 2 && state.pinch) {
    const points = [...state.pointers.values()];
    const first = points[0];
    const second = points[1];
    if (!first || !second || state.pinch.distance === 0) {
      return null;
    }
    const nextDistance = distanceBetween(first, second);
    return {
      type: "pinch",
      scale: clampScale(state.pinch.scale * (nextDistance / state.pinch.distance)),
    };
  }
  const width = Math.max(1, frame.width);
  const height = Math.max(1, frame.height);
  return {
    type: "pan",
    deltaX: ((point.x - prev.x) / width) * 2,
    deltaY: ((point.y - prev.y) / height) * 2,
  };
}

export function endPhotoEditPointer(state: PhotoEditGestureState, pointerId: number): void {
  state.pointers.delete(pointerId);
  if (state.pointers.size < 2) {
    state.pinch = null;
  }
}
