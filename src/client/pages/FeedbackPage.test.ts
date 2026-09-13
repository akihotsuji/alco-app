import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "FeedbackPage.tsx"), "utf8");
const processFile = readFileSync(join(here, "../lib/photo/process-file.ts"), "utf8");

describe("FeedbackPage 12-feedback", () => {
  it("種類 3 択と必須の本文、任意の撮る/選ぶがある", () => {
    expect(source).toContain("FEEDBACK_CATEGORIES");
    expect(source).toContain("FEEDBACK_COPY.categoryLabel");
    expect(source).toContain("FEEDBACK_COPY.bodyLabel");
    expect(source).toContain("required");
    expect(source).toContain("FEEDBACK_COPY.capture");
    expect(source).toContain("FEEDBACK_COPY.library");
    expect(source).toContain('pickImages(source, { multiple: source === "library" })');
    expect(source).toContain("processFeedbackFile");
    expect(source).toContain("FEEDBACK_COPY.note");
    expect(source).toContain("FEEDBACK_COPY.submit");
  });

  it("空の本文では送信できず、成功は cheer なしで設定へ戻る", () => {
    expect(source).toContain("body.trim().length > 0");
    expect(source).toContain("FEEDBACK_COPY.sent");
    expect(source).toContain("cheer: false");
    expect(source).toContain('navigate("/settings", { replace: true })');
    expect(source).not.toContain("PhotoEdit");
    expect(source).not.toContain("processLogFile");
    expect(source).not.toContain("processNoteFile");
    expect(source).not.toContain("processPhoto(");
    expect(source).not.toContain("getComposeMascotPref");
  });

  it("ご意見の画像処理は切り抜き・キャラ合成を呼ばない", () => {
    const fn = processFile.slice(processFile.indexOf("export async function processFeedbackFile"));
    expect(fn).toContain("fitToLongEdge");
    expect(fn).not.toContain("processPhoto");
    expect(fn).not.toContain("processLogPhoto");
    expect(fn).not.toContain("getComposeMascotPref");
    expect(fn).not.toContain("mascotOn");
    expect(fn).not.toContain("cutoutOn");
  });
});
