import { describe, expect, it } from "vitest";
import { LABEL_RECOGNIZE_GEMINI_SCHEMA } from "../label-recognizer/prompt.ts";
import { NOTE_RECOGNIZE_GEMINI_SCHEMA } from "../note-recognizer/prompt.ts";
import { taskPrompts } from "./create-recognizer.ts";
import { DRINK_EXTRACT_GEMINI_SCHEMA } from "./drink-extract.ts";

describe("taskPrompts", () => {
  it("Gemini 経路は3機能とも uppercase responseSchema を使う", () => {
    expect(taskPrompts("drink", "gemini-generate-content").schema).toBe(
      DRINK_EXTRACT_GEMINI_SCHEMA,
    );
    expect(taskPrompts("label", "gemini-generate-content").schema).toBe(
      LABEL_RECOGNIZE_GEMINI_SCHEMA,
    );
    expect(taskPrompts("note", "gemini-generate-content").schema).toBe(
      NOTE_RECOGNIZE_GEMINI_SCHEMA,
    );
    expect(taskPrompts("label", "gemini-generate-content").schema.type).toBe("OBJECT");
    expect(taskPrompts("note", "gemini-generate-content").schema.type).toBe("OBJECT");
  });

  it("Llama 経路は lowercase guided_json のまま", () => {
    expect(taskPrompts("label", "workers-ai-chat").schema.type).toBe("object");
    expect(taskPrompts("note", "workers-ai-chat").schema.type).toBe("object");
    expect(taskPrompts("drink", "workers-ai-chat").schema.type).toBe("object");
  });
});
