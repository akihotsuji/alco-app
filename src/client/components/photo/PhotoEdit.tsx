import { X } from "lucide-react";
import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { applyPreset } from "@/client/lib/photo/apply-preset.ts";
import { prefersReducedMotion, supportsCanvasFilter } from "@/client/lib/photo/filter-support.ts";
import {
  aspectForKind,
  clampScale,
  computeCoverCrop,
  outputSizeForAspect,
} from "@/client/lib/photo/geometry.ts";
import { presetForKind, processPhoto } from "@/client/lib/photo/process.ts";
import {
  type RemoveBackgroundProgress,
  supportsBackgroundRemoval,
} from "@/client/lib/photo/remove-background.ts";
import {
  getColorCorrectionPref,
  getComposeMascotPref,
  getCutoutPref,
  setColorCorrectionPref,
  setComposeMascotPref,
  setCutoutPref,
} from "@/client/lib/preferences.ts";

export function PhotoEdit() {
  const { open, kind, source, decodeError, closePhotoEdit, retake, applyProcessed } =
    usePhotoEdit();
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [filterOn, setFilterOn] = useState(getColorCorrectionPref);
  const [mascotOn, setMascotOn] = useState(getComposeMascotPref);
  const [cutoutOn, setCutoutOn] = useState(getCutoutPref);
  const [processing, setProcessing] = useState(false);
  const [cutoutBusy, setCutoutBusy] = useState(false);
  const [cutoutProgress, setCutoutProgress] = useState<RemoveBackgroundProgress | null>(null);
  const [previewCutout, setPreviewCutout] = useState<HTMLCanvasElement | null>(null);
  const [cutoutMessage, setCutoutMessage] = useState<string | null>(null);
  const [mascotMounted, setMascotMounted] = useState(getComposeMascotPref);
  const filterSupported = useMemo(() => supportsCanvasFilter(), []);
  const cutoutSupported = kind === "cellar" && supportsBackgroundRemoval();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const previewGen = useRef(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    setFilterOn(filterSupported ? getColorCorrectionPref() : false);
    const nextMascot = getComposeMascotPref();
    setMascotOn(nextMascot);
    setMascotMounted(nextMascot);
    setCutoutOn(getCutoutPref());
    setProcessing(false);
    setCutoutBusy(false);
    setCutoutProgress(null);
    setPreviewCutout(null);
    setCutoutMessage(null);
  }, [open, filterSupported]);

  useEffect(() => {
    if (mascotOn) {
      setMascotMounted(true);
      return;
    }
    const delay = prefersReducedMotion() ? 0 : 200;
    const timer = window.setTimeout(() => setMascotMounted(false), delay);
    return () => window.clearTimeout(timer);
  }, [mascotOn]);

  useEffect(() => {
    if (!source) {
      return;
    }
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  }, [source]);

  const aspect = aspectForKind(kind);
  const output = outputSizeForAspect(aspect);

  useEffect(() => {
    if (!open || kind !== "cellar" || !cutoutOn || !cutoutSupported || !source) {
      setPreviewCutout(null);
      setCutoutBusy(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const gen = previewGen.current + 1;
      previewGen.current = gen;
      setCutoutBusy(true);
      setCutoutProgress({ firstDownload: false });
      void processPhoto({
        source,
        sourceWidth: source.width,
        sourceHeight: source.height,
        kind: "cellar",
        scale,
        offsetX,
        offsetY,
        filterOn: filterOn && filterSupported,
        mascotOn: false,
        cutoutOn: true,
        onCutoutProgress: setCutoutProgress,
      }).then((processed) => {
        if (previewGen.current !== gen) {
          URL.revokeObjectURL(processed.previewUrl);
          return;
        }
        if (processed.blob.type !== "image/webp") {
          URL.revokeObjectURL(processed.previewUrl);
          setPreviewCutout(null);
          setCutoutBusy(false);
          return;
        }
        const image = new Image();
        image.onload = () => {
          if (previewGen.current !== gen) {
            URL.revokeObjectURL(processed.previewUrl);
            return;
          }
          const canvas = document.createElement("canvas");
          canvas.width = output.width;
          canvas.height = output.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(processed.previewUrl);
          setPreviewCutout(canvas);
          setCutoutBusy(false);
        };
        image.onerror = () => {
          URL.revokeObjectURL(processed.previewUrl);
          if (previewGen.current === gen) {
            setPreviewCutout(null);
            setCutoutBusy(false);
          }
        };
        image.src = processed.previewUrl;
      });
    }, 500);
    return () => {
      window.clearTimeout(timer);
      previewGen.current += 1;
    };
  }, [
    cutoutOn,
    cutoutSupported,
    filterOn,
    filterSupported,
    kind,
    offsetX,
    offsetY,
    open,
    output.height,
    output.width,
    scale,
    source,
  ]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) {
      return;
    }
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (kind === "cellar" && cutoutOn && previewCutout) {
      ctx.drawImage(previewCutout, 0, 0, canvas.width, canvas.height);
      return;
    }
    const crop = computeCoverCrop({
      sourceWidth: source.width,
      sourceHeight: source.height,
      aspect,
      scale,
      offsetX,
      offsetY,
    });
    const raw = document.createElement("canvas");
    raw.width = canvas.width;
    raw.height = canvas.height;
    const rawCtx = raw.getContext("2d");
    if (!rawCtx) {
      return;
    }
    rawCtx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, raw.width, raw.height);
    const framed = filterOn && filterSupported ? applyPreset(raw, presetForKind(kind, true)) : raw;
    ctx.drawImage(framed, 0, 0);
  }, [
    aspect,
    cutoutOn,
    filterOn,
    filterSupported,
    kind,
    offsetX,
    offsetY,
    output.height,
    output.width,
    previewCutout,
    scale,
    source,
  ]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  if (!open) {
    return null;
  }

  const ratioClass = kind === "cellar" ? "photo-edit-frame-bottle" : "photo-edit-frame-log";
  const filterLabel = kind === "cellar" ? "色補正: セラー" : "色補正: 食卓";
  const busy = processing || cutoutBusy;

  async function onUse() {
    if (!source || processing) {
      return;
    }
    setProcessing(true);
    setCutoutProgress(null);
    try {
      const processed = await processPhoto({
        source,
        sourceWidth: source.width,
        sourceHeight: source.height,
        kind,
        scale,
        offsetX,
        offsetY,
        filterOn: filterOn && filterSupported,
        mascotOn: kind !== "cellar" && mascotOn,
        cutoutOn: kind === "cellar" && cutoutOn && cutoutSupported,
        onCutoutProgress: setCutoutProgress,
      });
      if (
        kind === "cellar" &&
        cutoutOn &&
        cutoutSupported &&
        processed.blob.type !== "image/webp"
      ) {
        setCutoutOn(false);
        setCutoutPref(false);
        setPreviewCutout(null);
        setCutoutMessage("うまく抜けませんでした。長方形のまま保存します");
      }
      applyProcessed(processed);
    } finally {
      setProcessing(false);
      setCutoutProgress(null);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const points = [...pointers.current.values()];
      const first = points[0];
      const second = points[1];
      if (first && second) {
        pinch.current = { distance: distanceBetween(first, second), scale };
      }
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(event.pointerId);
    if (!prev) {
      return;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const points = [...pointers.current.values()];
      const first = points[0];
      const second = points[1];
      if (!first || !second) {
        return;
      }
      const nextDistance = distanceBetween(first, second);
      setScale(clampScale(pinch.current.scale * (nextDistance / pinch.current.distance)));
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setOffsetX((value) => clampOffset(value - ((event.clientX - prev.x) / rect.width) * 2));
    setOffsetY((value) => clampOffset(value - ((event.clientY - prev.y) / rect.height) * 2));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinch.current = null;
    }
  }

  return (
    <div className="photo-edit" role="dialog" aria-modal="true" aria-label="写真を編集">
      <header className="photo-edit-bar">
        <IconButton label="閉じる" onClick={closePhotoEdit}>
          <X size={20} />
        </IconButton>
        <span className="photo-edit-spacer" />
        <button type="button" className="header-text-link" onClick={() => void retake()}>
          撮り直す
        </button>
      </header>
      <div className="photo-edit-body">
        <div
          className={`photo-edit-frame ${ratioClass}${kind === "cellar" && cutoutOn ? " is-cutout" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {source && !decodeError ? (
            <canvas ref={canvasRef} className="photo-edit-canvas" />
          ) : (
            <p className="photo-edit-placeholder">
              {decodeError ?? "この写真を読み込めませんでした"}
            </p>
          )}
          {kind !== "cellar" && source && !decodeError && mascotMounted ? (
            <span
              className={`photo-edit-mascot${reducedMotionClass()}${mascotOn ? "" : " is-off"}`}
              style={{ opacity: mascotOn ? 1 : 0 }}
            >
              <Mascot pose="surprised" size={64} aria-hidden />
            </span>
          ) : null}
          {kind === "cellar" && cutoutOn && (cutoutBusy || processing) ? (
            <div className="photo-edit-cutout-status">
              <span className="photo-edit-cutout-spinner" aria-hidden />
              <p>切り抜き中…</p>
              {cutoutProgress?.firstDownload ? (
                <p>
                  初回のみ数十 MB を取得します
                  {cutoutProgress.percent !== undefined ? ` ${cutoutProgress.percent}%` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {cutoutMessage ? <p className="photo-edit-note">{cutoutMessage}</p> : null}
      {!filterSupported ? <p className="photo-edit-note">この端末では色補正を使えません</p> : null}
      <div className="photo-edit-toggles">
        <Chip
          label={filterLabel}
          checked={filterOn}
          disabled={!filterSupported}
          onChange={(value) => {
            setFilterOn(value);
            setColorCorrectionPref(value);
          }}
        />
        {kind !== "cellar" ? (
          <Chip
            label="キャラを入れる"
            checked={mascotOn}
            onChange={(value) => {
              setMascotOn(value);
              setComposeMascotPref(value);
            }}
          />
        ) : null}
        {kind === "cellar" && cutoutSupported ? (
          <Chip
            label="切り抜く"
            checked={cutoutOn}
            onChange={(value) => {
              setCutoutOn(value);
              setCutoutPref(value);
              setCutoutMessage(null);
              if (!value) {
                setPreviewCutout(null);
              }
            }}
          />
        ) : null}
      </div>
      <div className="save-bar">
        <Button
          type="button"
          onClick={() => void onUse()}
          disabled={!source || Boolean(decodeError) || busy}
        >
          {busy ? "処理中" : "使う"}
        </Button>
      </div>
    </div>
  );
}

function Chip({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={checked ? "chip is-on" : "chip"}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      {checked ? "✓ " : ""}
      {label}
    </button>
  );
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampOffset(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function reducedMotionClass(): string {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    ? " is-instant"
    : "";
}
