import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INITIAL_BOTTLE_FORM, validateBottleForm } from "@/client/lib/bottle-form.ts";
import { BOTTLE_MESSAGES } from "@/shared/bottles.ts";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "BottleForm.tsx"),
  "utf8",
);

describe("BottleForm バリデーション表示", () => {
  it("フィールド直下に field-error を出し、保存は canSubmit で無効化する", () => {
    expect(source).toContain("validateBottleForm(state, new Date()");
    expect(source).toContain("canSubmitBottleForm");
    expect(source).toContain("errors.name");
    expect(source).toContain("errors.vintage");
    expect(source).toContain("errors.purchasedOn");
    expect(source).toContain("errors.storedOn");
    expect(source).toContain("BOTTLE_FIELD_LABELS.vintage");
    expect(source).toContain("BOTTLE_FIELD_LABELS.variety");
    expect(source).toContain("BOTTLE_FIELD_LABELS.purchasedOn");
    expect(source).toContain("BOTTLE_FIELD_LABELS.storedOn");
    expect(source).toContain("保管情報");
    expect(source).toContain("購入情報");
    expect(source).toContain('id="bottle-variety"');
    expect(source).not.toContain("ボトル情報");
    expect(source).not.toContain('layout="inline"');
    expect(source).toContain('type="date"');
    expect(source).toContain("visibleFieldErrors");
    expect(source).toContain("firstBottleDetailsErrorField");
    expect(source).toContain('className="field-error"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("disabled={!canSubmit}");
    expect(source).toContain("createEmptyBottleForm");
    expect(validateBottleForm(INITIAL_BOTTLE_FORM).name).toBe(BOTTLE_MESSAGES.name);
  });

  it("読み取り帯を出し、AI 印は触ると消える欄に付ける", () => {
    expect(source).toContain(
      "<RecognizeBanner status={recognizeStatus} onRetry={retryRecognition} />",
    );
    expect(source).toContain("<BackPhotoField");
    expect(source).toContain("removeFrontPhoto()");
    expect(source).toContain("void backPhoto.clear()");
    expect(source).toContain("savedRef.current = true");
    expect(source).not.toContain("if (!hasFront && backPhotoHas)");
    expect(source).toContain("<RecognizeBanner");
    expect(source).toContain("FieldWithAiMark");
    expect(source).toContain("BOTTLE_FIELD_LABELS.name");
    expect(source).toContain("<OriginCountryField");
    expect(source).toContain('id="bottle-origin"');
    expect(source).toContain("capturedAtToCalendarDate");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("読み取りは pendingRecognizeJpeg で先に始め、attachment 側は同じ Blob の結果に相乗りする", () => {
    expect(source).toContain("startLabelRecognition(pendingRecognize.jpeg)");
    expect(source).toContain("startLabelRecognition(jpeg, undefined, { back, force })");
    expect(source).not.toContain("recognizeLabel(");
    expect(source).toContain("offerMatchesSession(pendingRecognize, session)");
    expect(source).toContain('mode !== "new" && !attachment?.recognizeJpeg');
  });
});
