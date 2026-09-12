import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const field = readFileSync(join(here, "CompactPhotoField.tsx"), "utf8");
const logNew = readFileSync(join(here, "../logs/LogNewForm.tsx"), "utf8");
const bottle = readFileSync(join(here, "../cellar/BottleForm.tsx"), "utf8");

describe("CompactPhotoField 撮影と選択", () => {
  it("記録・セラーとも撮影と選択を同じ行で出せる", () => {
    expect(field).toContain("写真を撮る");
    expect(field).toContain("IMAGE_PICK_LABELS.captureLibrary");
    expect(field).toContain("photo-action-row");
    expect(logNew).toContain("CompactPhotoField");
    expect(logNew).toContain('startCapture("log", { source: "library" })');
    expect(bottle).toContain("CompactPhotoField");
    expect(bottle).toContain('startCapture("cellar", { source: "library" })');
    expect(bottle).toContain('ratio="bottle"');
    expect(bottle).not.toContain("PhotoTile");
  });

  it("酒記録の写真タップは拡大で、撮り直しと選び直しは別操作", () => {
    expect(field).toContain("写真を拡大");
    expect(field).toContain("撮り直す");
    expect(field).toContain('actions?: "edit" | "retake"');
    expect(logNew).toContain('actions="retake"');
    expect(logNew).toContain("PhotoViewer");
    expect(logNew).not.toContain("editAttachment");
  });

  it("セラーの撮影後は編集・撮り直す・写真を選ぶが並び、編集はカメラに落とさない", () => {
    expect(field).toContain("編集");
    expect(field).toContain("撮り直す");
    expect(field).toContain("IMAGE_PICK_LABELS.captureLibrary");
    expect(field).not.toContain("onEdit ?? onCapture");
    expect(bottle).toContain("editFrontPhoto");
    expect(bottle).toContain('editAttachment("cellar", { photoId: keptPhotoId })');
    expect(bottle).not.toContain('startCapture("cellar") :');
    expect(bottle).not.toContain("onEdit ?? onCapture");
  });
});
