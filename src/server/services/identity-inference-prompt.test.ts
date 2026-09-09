import { describe, expect, it } from "vitest";
import { DRINK_RECOGNIZE_SYSTEM_PROMPT } from "./drink-recognizer/prompt.ts";
import { IDENTITY_INFERENCE_PROMPT } from "./identity-inference-prompt.ts";
import { LABEL_RECOGNIZE_SYSTEM_PROMPT } from "./label-recognizer/prompt.ts";
import { NOTE_RECOGNIZE_SYSTEM_PROMPT } from "./note-recognizer/prompt.ts";

describe("IDENTITY_INFERENCE_PROMPT", () => {
  it("生産国・品種は根拠があるときだけ埋め、推測で断定しない", () => {
    expect(IDENTITY_INFERENCE_PROMPT).toContain("Prefer a country name printed on the label");
    expect(IDENTITY_INFERENCE_PROMPT).toContain("verified appellation-to-country mapping");
    expect(IDENTITY_INFERENCE_PROMPT).toContain("Do not invent blend ratios");
    expect(IDENTITY_INFERENCE_PROMPT).toContain("omit origin and variety");
    expect(DRINK_RECOGNIZE_SYSTEM_PROMPT).toContain(IDENTITY_INFERENCE_PROMPT);
    expect(LABEL_RECOGNIZE_SYSTEM_PROMPT).toContain(IDENTITY_INFERENCE_PROMPT);
    expect(NOTE_RECOGNIZE_SYSTEM_PROMPT).toContain(IDENTITY_INFERENCE_PROMPT);
  });
});
