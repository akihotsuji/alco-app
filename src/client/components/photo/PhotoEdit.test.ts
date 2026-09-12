import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "PhotoEdit.tsx"), "utf8");
const context = readFileSync(join(here, "../layout/photo-edit-context.tsx"), "utf8");

describe("PhotoEdit 切り抜き（Issue #48）", () => {
  it("一時的な切り抜き失敗で photo.cutout を書き換えない（ユーザーのトグル操作でだけ保存する）", () => {
    expect(source).not.toContain("setCutoutPref(false)");
    const toggleCalls = source.match(/setCutoutPref\(([^)]*)\)/g) ?? [];
    expect(toggleCalls).toEqual(["setCutoutPref(value)"]);
    expect(source).toContain("cutoutFailedUserMessage");
    expect(source).not.toContain(
      'setCutoutMessage("うまく抜けませんでした。長方形のまま保存します")',
    );
  });

  it("プレビューは previewCutout（マスク再利用）で、条件変更時に pending を取り消す", () => {
    expect(source).toContain("previewCutout as renderCutoutPreview");
    expect(source).toContain("new AbortController()");
    expect(source).toContain("signal: controller.signal");
    expect(source).toContain("controller.abort()");
    expect(source).not.toContain("URL.revokeObjectURL(processed.previewUrl)");
  });

  it("「使う」は cutout の結果型で判定し、blob の MIME では判定しない", () => {
    expect(source).toContain('processed.cutout?.status === "failed"');
    expect(source).not.toContain('processed.blob.type !== "image/webp"');
  });

  it("セラーの編集は元画像または保存済み写真から photo-edit を開き、カメラを起動しない", () => {
    const fn = context.slice(context.indexOf("const editAttachment = useCallback("));
    expect(fn).toContain("usableAttachmentBlob");
    expect(fn).toContain("fetchOwnedPhotoBlob");
    expect(fn).toContain("openWithSource(targetKind, decoded.bitmap, decoded.error)");
    expect(fn).not.toContain("startCapture(targetKind)");
    expect(fn).toContain("collectRef.current = null");
  });

  it("切り抜き推論中は古い結果を出さず、ピンチは 1 本指だけ capture する", () => {
    expect(source).toContain("previewCutout && !cutoutBusy");
    expect(source).toContain("beginPhotoEditPointer");
    expect(source).toContain("releasePointerCapture");
    expect(source).toContain("event.preventDefault()");
  });

  it("撮り直すは撮影、ライブラリからは保存済み写真（両立）", () => {
    expect(source).toContain('retake("library")');
    expect(source).toContain('retake("camera")');
    expect(source).toContain("IMAGE_PICK_LABELS.library");
    expect(context).toContain('pickImage(options?.source ?? "camera")');
    expect(context).toContain("pickImage(source)");
  });

  it("色補正 UI は出さず、酒記録は photo-edit を挟まない", () => {
    expect(source).not.toContain("色補正");
    expect(source).not.toContain("getColorCorrectionPref");
    expect(context).toContain('if (nextKind === "log")');
    expect(context).toContain("processLogFile");
    expect(context).toContain("ingestLogPhoto");
  });

  it("ノートの撮影・選択は photo-edit を挟まず中央 4:5 で行へ積む。再編集（editFromBlob）だけ photo-edit", () => {
    expect(context).toContain('if (nextKind === "note" && options?.collect)');
    expect(context).toContain("ingestNotePhoto");
    expect(context).toContain("processNoteFile");
    expect(context).toContain('offerRecognizeJpeg(jpeg, "note")');
    const processFile = readFileSync(join(here, "../../lib/photo/process-file.ts"), "utf8");
    const noteFn = processFile.slice(processFile.indexOf("export async function processNoteFile"));
    expect(noteFn).toContain('kind: "note"');
    expect(noteFn).toContain("scale: 1");
    expect(noteFn).toContain("mascotOn: getComposeMascotPref()");
    expect(noteFn).toContain("cutoutOn: false");
    // 再編集はこれまでどおりオーバーレイで位置を直す
    expect(context).toContain("const editFromBlob = useCallback(");
    expect(context.slice(context.indexOf("const editFromBlob"))).toContain(
      "openWithSource(nextKind, decoded.bitmap, decoded.error)",
    );
  });

  it("切り抜く前の JPEG を先に呼び出し元へ渡し、ラベル読み取りを背景除去と並列に始められる", () => {
    expect(source).toContain(
      'kind === "cellar" || kind === "note" ? offerRecognizeJpeg : undefined',
    );
    expect(context).toContain("pendingRecognizeJpeg");
    expect(context).toContain("pendingRecognize");
    expect(context).toContain("offerRecognizeJpeg");
    expect(context).toContain("setPendingRecognize(null)");
    expect(context).toContain("forgetAllRecognition");
    expect(context).toContain("discardRecognize");
    expect(context).toContain("usePhotoFormSession");
  });

  it("セラーの処理中はマスコットと『この写真を切り抜いています』で伝える", () => {
    expect(source).toContain('<Mascot pose="surprised" size={72} aria-hidden />');
    expect(source).toContain("この写真を切り抜いています");
    expect(source).toContain("この写真を変換しています");
    expect(source).toContain('"切り抜き中"');
    expect(source).not.toContain('"処理中"');
  });

  it("まとめて追加の「使う」は同じタップで次のカメラを開き、処理は裏で進める（G8）", () => {
    expect(source).toContain('pickImage("camera")');
    expect(source).toContain("applyProcessed(processed, { keepOpen: Boolean(nextFile) })");
    expect(source).toContain("loadBurstFile(nextFile)");
    expect(source).toContain("BOTTLE_BATCH_MESSAGES.burstProcessing(collectedCount)");
    expect(context).toContain("PhotoBurstSession");
    expect(context).toContain("keepOpen");
    expect(context).toContain("loadBurstFile");
    expect(context).toContain("ingestCollected");
  });
});
