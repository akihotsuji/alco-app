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

  it("切り抜く前の JPEG を先に呼び出し元へ渡し、ラベル読み取りを背景除去と並列に始められる", () => {
    expect(source).toContain('onRecognizeJpeg: kind === "cellar" ? offerRecognizeJpeg : undefined');
    expect(context).toContain("pendingRecognizeJpeg");
    expect(context).toContain("offerRecognizeJpeg");
    expect(context).toContain("setPendingRecognizeJpeg(null)");
  });
});
