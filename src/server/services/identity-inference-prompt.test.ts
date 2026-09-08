import { describe, expect, it } from "vitest";
import { DRINK_RECOGNIZE_SYSTEM_PROMPT } from "./drink-recognizer/prompt.ts";
import { IDENTITY_INFERENCE_PROMPT } from "./identity-inference-prompt.ts";
import { LABEL_RECOGNIZE_SYSTEM_PROMPT } from "./label-recognizer/prompt.ts";
import { NOTE_RECOGNIZE_SYSTEM_PROMPT } from "./note-recognizer/prompt.ts";

describe("IDENTITY_INFERENCE_PROMPT", () => {
  it("生産国と品種をラベル表記ではなく手がかりから推測する", () => {
    expect(IDENTITY_INFERENCE_PROMPT).toContain("country name is often missing");
    expect(IDENTITY_INFERENCE_PROMPT).toContain("Labels often omit it");
    expect(IDENTITY_INFERENCE_PROMPT).toContain("Infer it from appellation");
    expect(DRINK_RECOGNIZE_SYSTEM_PROMPT).toContain(IDENTITY_INFERENCE_PROMPT);
    expect(LABEL_RECOGNIZE_SYSTEM_PROMPT).toContain(IDENTITY_INFERENCE_PROMPT);
    expect(NOTE_RECOGNIZE_SYSTEM_PROMPT).toContain(IDENTITY_INFERENCE_PROMPT);
  });
});
