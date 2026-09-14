import { type PointerEvent, useCallback, useEffect, useRef } from "react";
import { clampBrushRadius } from "@/client/lib/photo/cutout-mask-brush.ts";
import { applyComposedAlpha } from "@/client/lib/photo/cutout-mask-buffer.ts";
import {
  clampMaskZoom,
  clientToRoiPixel,
  containRect,
  createMaskViewTransform,
  fitMaskView,
  type MaskViewTransform,
  panMaskView,
  screenBrushRadiusToRoi,
  zoomMaskView,
} from "@/client/lib/photo/cutout-mask-coords.ts";
import {
  beginMaskPointer,
  cancelMaskPointers,
  createMaskPointerState,
  endMaskPointer,
  moveMaskPointer,
} from "@/client/lib/photo/cutout-mask-pointers.ts";
import {
  beginMaskStroke,
  cancelMaskStroke,
  commitMaskStroke,
  continueMaskStroke,
  type MaskEditSession,
  type MaskEditTool,
} from "@/client/lib/photo/cutout-mask-session.ts";
import type { CutoutComposeAssets } from "@/client/lib/photo/process.ts";
import { PHOTO_CUTOUT_MASK_EDIT } from "@/shared/constants.ts";

type CursorState = { x: number; y: number } | null;

export function PhotoEditMaskView(input: {
  assets: CutoutComposeAssets;
  session: MaskEditSession;
  tool: MaskEditTool;
  brushRadius: number;
  showSource: boolean;
  view: MaskViewTransform;
  onViewChange: (view: MaskViewTransform) => void;
  onRevision: () => void;
  disabled?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roiRef = useRef<HTMLCanvasElement | null>(null);
  const composedRef = useRef<HTMLCanvasElement | null>(null);
  const pointers = useRef(createMaskPointerState());
  const cursorRef = useRef<CursorState>(null);
  const viewRef = useRef(input.view);
  const toolRef = useRef(input.tool);
  const radiusRef = useRef(input.brushRadius);
  const rafRef = useRef(0);
  viewRef.current = input.view;
  toolRef.current = input.tool;
  radiusRef.current = input.brushRadius;

  const ensureRoi = useCallback(() => {
    const { work, roi } = input.assets;
    const width = input.session.width;
    const height = input.session.height;
    let canvas = roiRef.current;
    if (!canvas || canvas.width !== width || canvas.height !== height) {
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      roiRef.current = canvas;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return canvas;
    }
    ctx.drawImage(work, roi.sx, roi.sy, roi.sw, roi.sh, 0, 0, width, height);
    return canvas;
  }, [input.assets, input.session.height, input.session.width]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) {
      return;
    }
    const cssWidth = frame.clientWidth;
    const cssHeight = frame.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    const roi = ensureRoi();
    let composed = composedRef.current;
    if (!composed || composed.width !== roi.width || composed.height !== roi.height) {
      composed = document.createElement("canvas");
      composed.width = roi.width;
      composed.height = roi.height;
      composedRef.current = composed;
    }
    const composedCtx = composed.getContext("2d");
    const roiCtx = roi.getContext("2d");
    if (!composedCtx || !roiCtx) {
      return;
    }
    composedCtx.clearRect(0, 0, composed.width, composed.height);
    composedCtx.drawImage(roi, 0, 0);
    const image = composedCtx.getImageData(0, 0, composed.width, composed.height);
    applyComposedAlpha(image.data, input.session.draftMask, input.session.sourceAlpha);
    composedCtx.putImageData(image, 0, 0);
    const contain = containRect(cssWidth, cssHeight, roi.width, roi.height);
    const view = input.view;
    void input.session.revision;
    ctx.save();
    ctx.translate(
      contain.x + contain.width / 2 + view.panX,
      contain.y + contain.height / 2 + view.panY,
    );
    ctx.scale(view.scale, view.scale);
    ctx.translate(-contain.width / 2, -contain.height / 2);
    if (input.showSource) {
      ctx.globalAlpha = PHOTO_CUTOUT_MASK_EDIT.sourceOverlayAlpha;
      ctx.drawImage(roi, 0, 0, contain.width, contain.height);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(composed, 0, 0, contain.width, contain.height);
    ctx.restore();
    const cursor = cursorRef.current;
    if (cursor && input.tool !== "pan") {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.arc(cursor.x, cursor.y, clampBrushRadius(radiusRef.current), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 1;
      ctx.arc(cursor.x, cursor.y, clampBrushRadius(radiusRef.current), 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [
    ensureRoi,
    input.session.draftMask,
    input.session.revision,
    input.session.sourceAlpha,
    input.showSource,
    input.tool,
    input.view,
  ]);

  const schedulePaint = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(() => {
      paint();
    });
  }, [paint]);

  useEffect(() => {
    schedulePaint();
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [schedulePaint]);

  useEffect(() => {
    function onVisibility() {
      if (document.hidden && cancelMaskStroke(input.session)) {
        input.onRevision();
      }
      cancelMaskPointers(pointers.current);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [input]);

  function viewportRect() {
    return frameRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };
  }

  function containNow() {
    const frame = frameRef.current;
    return containRect(
      frame?.clientWidth ?? 1,
      frame?.clientHeight ?? 1,
      input.session.width,
      input.session.height,
    );
  }

  function clientPointToRoi(clientX: number, clientY: number) {
    const viewport = viewportRect();
    return clientToRoiPixel(
      clientX,
      clientY,
      viewport,
      containNow(),
      viewRef.current,
      input.session.width,
      input.session.height,
    );
  }

  function releaseCaptures() {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    for (const id of pointers.current.pointers.keys()) {
      if (frame.hasPointerCapture(id)) {
        frame.releasePointerCapture(id);
      }
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (input.disabled) {
      return;
    }
    event.preventDefault();
    const started = beginMaskPointer(
      pointers.current,
      event.pointerId,
      { x: event.clientX, y: event.clientY },
      toolRef.current,
    );
    if (started.action === "pinch-start") {
      if (started.cancelStroke && cancelMaskStroke(input.session)) {
        input.onRevision();
      }
      releaseCaptures();
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    cursorRef.current = {
      x: event.clientX - viewportRect().left,
      y: event.clientY - viewportRect().top,
    };
    if (started.action === "draw") {
      const roi = clientPointToRoi(event.clientX, event.clientY);
      if (roi) {
        const radius = screenBrushRadiusToRoi(
          radiusRef.current,
          containNow(),
          viewRef.current.scale,
        );
        beginMaskStroke(
          input.session,
          roi,
          radius,
          toolRef.current === "erase" ? "erase" : "restore",
          viewRef.current.scale,
        );
        input.onRevision();
      }
    }
    schedulePaint();
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    cursorRef.current = {
      x: event.clientX - viewportRect().left,
      y: event.clientY - viewportRect().top,
    };
    const moved = moveMaskPointer(pointers.current, event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (!moved) {
      schedulePaint();
      return;
    }
    event.preventDefault();
    if (moved.type === "draw") {
      const roi = clientPointToRoi(moved.x, moved.y);
      if (roi) {
        const radius = screenBrushRadiusToRoi(
          radiusRef.current,
          containNow(),
          input.session.strokeViewScale,
        );
        continueMaskStroke(
          input.session,
          roi,
          radius,
          toolRef.current === "erase" ? "erase" : "restore",
        );
      }
    } else if (moved.type === "pan") {
      input.onViewChange(panMaskView(viewRef.current, moved.deltaX, moved.deltaY, containNow()));
    } else if (moved.type === "pinch") {
      input.onViewChange(
        zoomMaskView(
          viewRef.current,
          viewRef.current.scale * moved.scaleRatio,
          moved.originX - viewportRect().left,
          moved.originY - viewportRect().top,
          containNow(),
        ),
      );
    }
    schedulePaint();
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    const ended = endMaskPointer(pointers.current, event.pointerId);
    if (ended.endStroke && commitMaskStroke(input.session)) {
      input.onRevision();
    }
    if (pointers.current.pointers.size === 0) {
      cursorRef.current = null;
    }
    schedulePaint();
  }

  function onPointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (cancelMaskStroke(input.session)) {
      input.onRevision();
    }
    cancelMaskPointers(pointers.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cursorRef.current = null;
    schedulePaint();
  }

  function onLostCapture() {
    if (cancelMaskStroke(input.session)) {
      input.onRevision();
    }
    schedulePaint();
  }

  return (
    <div
      ref={frameRef}
      className="photo-edit-frame photo-edit-frame-mask is-cutout"
      style={{ aspectRatio: `${input.session.width} / ${input.session.height}` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostCapture}
      role="img"
      aria-label="切り抜きマスクを編集"
    >
      <canvas ref={canvasRef} className="photo-edit-canvas" />
    </div>
  );
}

export function stepMaskZoom(
  view: MaskViewTransform,
  delta: number,
  width: number,
  height: number,
  cssWidth: number,
  cssHeight: number,
): MaskViewTransform {
  const contain = containRect(cssWidth, cssHeight, width, height);
  return zoomMaskView(
    view,
    clampMaskZoom(view.scale + delta),
    contain.x + contain.width / 2,
    contain.y + contain.height / 2,
    contain,
  );
}

export { createMaskViewTransform, fitMaskView };
