import { X } from "lucide-react";
import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { useFocusTrap } from "@/client/hooks/use-focus-trap.ts";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { BOTTLE_BATCH_MESSAGES } from "@/client/lib/bottle-batch.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { applyPreset } from "@/client/lib/photo/apply-preset.ts";
import { pickMascotPose } from "@/client/lib/photo/compose-mascot.ts";
import { cutoutFailedUserMessage } from "@/client/lib/photo/cutout-result.ts";
import { supportsCanvasFilter } from "@/client/lib/photo/filter-support.ts";
import {
  aspectForKind,
  clampScale,
  computeCoverCrop,
  outputSizeForAspect,
} from "@/client/lib/photo/geometry.ts";
import { IMAGE_PICK_LABELS, pickImage } from "@/client/lib/photo/pick-image.ts";
import {
  presetForKind,
  processPhoto,
  previewCutout as renderCutoutPreview,
} from "@/client/lib/photo/process.ts";
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
import type { PhotoMascotPose } from "@/shared/constants.ts";

const PREVIEW_DEBOUNCE_MS = 500;

export function PhotoEdit() {
  const {
    open,
    kind,
    source,
    decodeError,
    closePhotoEdit,
    retake,
    applyProcessed,
    offerRecognizeJpeg,
    burstActive,
    collectedCount,
    canCollectMore,
    loadBurstFile,
  } = usePhotoEdit();
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
  const [mascotPose, setMascotPose] = useState<PhotoMascotPose>("default");
  const filterSupported = useMemo(() => supportsCanvasFilter(), []);
  const cutoutSupported = kind === "cellar" && supportsBackgroundRemoval();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
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
    setMascotPose(pickMascotPose());
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
    const delay = reduceMotion ? 0 : MOTION_MS.state;
    const timer = window.setTimeout(() => setMascotMounted(false), delay);
    return () => window.clearTimeout(timer);
  }, [mascotOn, reduceMotion]);

  useFocusTrap(open, dialogRef);

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

  // プレビューの推論は同一条件で 1 回。結果はマスクとして残り「使う」で再利用される。
  // 条件が変わったら pending を取り消し（走っている推論は結果だけ捨てる）、待ち行列を溜めない
  useEffect(() => {
    if (!open || kind !== "cellar" || !cutoutOn || !cutoutSupported || !source) {
      setPreviewCutout(null);
      setCutoutBusy(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const gen = previewGen.current + 1;
      previewGen.current = gen;
      setCutoutBusy(true);
      setCutoutProgress({ firstDownload: false });
      void renderCutoutPreview({
        source,
        sourceWidth: source.width,
        sourceHeight: source.height,
        kind: "cellar",
        scale,
        offsetX,
        offsetY,
        filterOn: filterOn && filterSupported,
        onCutoutProgress: setCutoutProgress,
        signal: controller.signal,
      }).then((preview) => {
        if (previewGen.current !== gen) {
          return;
        }
        setCutoutBusy(false);
        if (preview.status === "success") {
          setPreviewCutout(preview.canvas);
          return;
        }
        if (preview.reason === "superseded") {
          return;
        }
        // 一時的な失敗は今回の編集画面だけ OFF。`photo.cutout` は変えない（07-photo-capture P5b）
        setPreviewCutout(null);
        setCutoutOn(false);
        setCutoutMessage(cutoutFailedUserMessage(preview.reason));
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      previewGen.current += 1;
      controller.abort();
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
    // 「使う」の同じタップで次のカメラを開く（切り抜き完了を待たない。G8）
    const nextPickPromise =
      burstActive && canCollectMore() ? pickImage("camera") : Promise.resolve<File | null>(null);
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
        mascotPose,
        cutoutOn: kind === "cellar" && cutoutOn && cutoutSupported,
        onCutoutProgress: setCutoutProgress,
        // 背景除去を待たずにラベル読み取りを始められるよう、切り抜く前の JPEG を先に渡す
        onRecognizeJpeg:
          kind === "cellar" || kind === "log" || kind === "note" ? offerRecognizeJpeg : undefined,
      });
      if (processed.cutout?.status === "failed") {
        // 一時的な失敗。`photo.cutout` はユーザーがトグルを操作したときだけ変える
        setCutoutOn(false);
        setPreviewCutout(null);
        setCutoutMessage(cutoutFailedUserMessage(processed.cutout.reason));
      }
      const nextFile = await nextPickPromise;
      applyProcessed(processed, { keepOpen: Boolean(nextFile) });
      if (nextFile) {
        await loadBurstFile(nextFile);
      }
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
    <div
      ref={dialogRef}
      className="photo-edit"
      role="dialog"
      aria-modal="true"
      aria-label="写真を編集"
    >
      <header className="photo-edit-bar">
        <IconButton label="閉じる" onClick={closePhotoEdit}>
          <X size={20} />
        </IconButton>
        <span className="photo-edit-spacer" />
        <button type="button" className="header-text-link" onClick={() => void retake("library")}>
          {IMAGE_PICK_LABELS.library}
        </button>
        <button type="button" className="header-text-link" onClick={() => void retake("camera")}>
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
              className={`photo-edit-mascot${reduceMotion ? " is-instant" : ""}${mascotOn ? "" : " is-off"}`}
              style={{ opacity: mascotOn ? 1 : 0 }}
            >
              <Mascot pose={mascotPose} size={64} aria-hidden />
            </span>
          ) : null}
          {kind === "cellar" && (cutoutBusy || processing) ? (
            <div className="photo-edit-cutout-status">
              <Mascot pose="surprised" size={72} aria-hidden />
              <p>{cutoutOn ? "この写真を切り抜いています" : "この写真を変換しています"}</p>
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
      {burstActive && collectedCount > 0 ? (
        <p className="photo-edit-note" role="status">
          {BOTTLE_BATCH_MESSAGES.burstProcessing(collectedCount)}
        </p>
      ) : null}
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
          {busy ? (kind === "cellar" && cutoutOn ? "切り抜き中" : "変換中") : "使う"}
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
