import { X } from "lucide-react";
import { type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/client/hooks/use-focus-trap.ts";
import { cn } from "@/client/lib/utils";

const HISTORY_FLAG = "alcoPhotoViewer";

type PhotoViewerProps = {
  open: boolean;
  src: string;
  alt: string;
  /** セラー切り抜きなど透過 PNG を暗い市松で見せる */
  checkerboard?: boolean;
  onClose: () => void;
};

function hasViewerFlag(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    Reflect.get(state, HISTORY_FLAG) === true
  );
}

function stripViewerFlag(state: unknown): unknown {
  if (typeof state !== "object" || state === null) {
    return state;
  }
  const next = { ...state };
  Reflect.deleteProperty(next, HISTORY_FLAG);
  return next;
}

/**
 * 写真全体の拡大表示。ピンチとパン、閉じる、Escape、Android 戻るに対応する。
 */
export function PhotoViewer({
  open,
  src,
  alt,
  checkerboard = false,
  onClose,
}: PhotoViewerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushedRef = useRef(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) {
      setScale(1);
      setTx(0);
      setTy(0);
      return;
    }
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prior = window.history.state;
    window.history.pushState(
      { ...(typeof prior === "object" && prior ? prior : {}), [HISTORY_FLAG]: true },
      "",
    );
    pushedRef.current = true;

    const onPop = () => {
      pushedRef.current = false;
      onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      if (pushedRef.current && hasViewerFlag(window.history.state)) {
        window.history.back();
        return;
      }
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      window.scrollTo(0, scrollY);
      if (pushedRef.current && hasViewerFlag(window.history.state)) {
        pushedRef.current = false;
        window.history.replaceState(stripViewerFlag(window.history.state), "");
      }
    };
  }, [open]);

  if (!open || !src) {
    return null;
  }

  function requestClose() {
    if (pushedRef.current && hasViewerFlag(window.history.state)) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const first = pts[0];
      const second = pts[1];
      if (first && second) {
        pinchStart.current = {
          dist: Math.hypot(first.x - second.x, first.y - second.y),
          scale,
        };
      }
      panStart.current = null;
      return;
    }
    if (scale > 1) {
      panStart.current = { x: event.clientX, y: event.clientY, tx, ty };
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = [...pointers.current.values()];
      const first = pts[0];
      const second = pts[1];
      if (!first || !second) {
        return;
      }
      const dist = Math.hypot(first.x - second.x, first.y - second.y);
      const next = Math.min(
        4,
        Math.max(1, (pinchStart.current.scale * dist) / pinchStart.current.dist),
      );
      setScale(next);
      if (next === 1) {
        setTx(0);
        setTy(0);
      }
      return;
    }
    if (panStart.current && scale > 1) {
      setTx(panStart.current.tx + event.clientX - panStart.current.x);
      setTy(panStart.current.ty + event.clientY - panStart.current.y);
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchStart.current = null;
    }
    if (pointers.current.size === 0) {
      panStart.current = null;
    }
  }

  return createPortal(
    <div
      ref={dialogRef}
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="photo-viewer-bar">
        <h2 id={titleId} className="photo-viewer-title">
          写真
        </h2>
        <button
          type="button"
          className="photo-viewer-close"
          onClick={requestClose}
          aria-label="閉じる"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div
        className={cn("photo-viewer-stage", checkerboard && "is-cutout")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt={alt}
          className="photo-viewer-img"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          }}
          draggable={false}
        />
      </div>
    </div>,
    document.body,
  );
}
