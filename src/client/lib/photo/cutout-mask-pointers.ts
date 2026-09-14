export type MaskPointerPhase = "idle" | "drawing" | "panning" | "pinching" | "blocked";

export type MaskPointerState = {
  phase: MaskPointerPhase;
  pointers: Map<number, { x: number; y: number }>;
  pinchDistance: number;
  strokePointerId: number | null;
};

export function createMaskPointerState(): MaskPointerState {
  return {
    phase: "idle",
    pointers: new Map(),
    pinchDistance: 0,
    strokePointerId: null,
  };
}

export type MaskPointerBegin =
  | { action: "draw"; pointerId: number; capture: true }
  | { action: "pan"; pointerId: number; capture: true }
  | { action: "pinch-start"; releaseCaptures: true; cancelStroke: boolean };

export function beginMaskPointer(
  state: MaskPointerState,
  pointerId: number,
  point: { x: number; y: number },
  tool: "restore" | "erase" | "pan",
): MaskPointerBegin {
  state.pointers.set(pointerId, point);
  if (state.pointers.size >= 2) {
    const points = [...state.pointers.values()];
    const first = points[0];
    const second = points[1];
    const cancelStroke = state.phase === "drawing";
    if (first && second) {
      state.pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
    }
    state.phase = "pinching";
    state.strokePointerId = null;
    return { action: "pinch-start", releaseCaptures: true, cancelStroke };
  }
  if (state.phase === "blocked" || state.phase === "pinching") {
    state.phase = "blocked";
    return { action: "pan", pointerId, capture: true };
  }
  if (tool === "pan") {
    state.phase = "panning";
    state.strokePointerId = pointerId;
    return { action: "pan", pointerId, capture: true };
  }
  state.phase = "drawing";
  state.strokePointerId = pointerId;
  return { action: "draw", pointerId, capture: true };
}

export type MaskPointerMove =
  | { type: "draw"; x: number; y: number }
  | { type: "pan"; deltaX: number; deltaY: number }
  | { type: "pinch"; scaleRatio: number; originX: number; originY: number }
  | null;

export function moveMaskPointer(
  state: MaskPointerState,
  pointerId: number,
  point: { x: number; y: number },
): MaskPointerMove {
  const prev = state.pointers.get(pointerId);
  if (!prev) {
    return null;
  }
  state.pointers.set(pointerId, point);
  if (state.pointers.size >= 2 && state.phase === "pinching") {
    const points = [...state.pointers.values()];
    const first = points[0];
    const second = points[1];
    if (!first || !second || state.pinchDistance <= 0) {
      return null;
    }
    const nextDistance = Math.hypot(first.x - second.x, first.y - second.y);
    const scaleRatio = nextDistance / state.pinchDistance;
    return {
      type: "pinch",
      scaleRatio,
      originX: (first.x + second.x) / 2,
      originY: (first.y + second.y) / 2,
    };
  }
  if (state.phase === "drawing" && state.strokePointerId === pointerId) {
    return { type: "draw", x: point.x, y: point.y };
  }
  if (state.phase === "panning" && state.strokePointerId === pointerId) {
    return { type: "pan", deltaX: point.x - prev.x, deltaY: point.y - prev.y };
  }
  return null;
}

export function endMaskPointer(state: MaskPointerState, pointerId: number): { endStroke: boolean } {
  state.pointers.delete(pointerId);
  const endStroke = state.phase === "drawing" && state.strokePointerId === pointerId;
  if (state.pointers.size === 0) {
    state.phase = "idle";
    state.pinchDistance = 0;
    state.strokePointerId = null;
    return { endStroke };
  }
  if (state.pointers.size === 1 && (state.phase === "pinching" || state.phase === "blocked")) {
    state.phase = "blocked";
    state.pinchDistance = 0;
    state.strokePointerId = null;
    return { endStroke: false };
  }
  if (state.strokePointerId === pointerId) {
    state.strokePointerId = null;
    if (state.phase === "drawing" || state.phase === "panning") {
      state.phase = "idle";
    }
  }
  return { endStroke };
}

export function cancelMaskPointers(state: MaskPointerState): { cancelStroke: boolean } {
  const cancelStroke = state.phase === "drawing";
  state.pointers.clear();
  state.phase = "idle";
  state.pinchDistance = 0;
  state.strokePointerId = null;
  return { cancelStroke };
}
