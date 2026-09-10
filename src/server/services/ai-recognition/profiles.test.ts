import { describe, expect, it } from "vitest";
import { GEMINI_37_FLASH_MODEL_ID, WORKERS_AI_VISION_MODEL } from "@/shared/constants.ts";
import { recognitionCacheKey } from "./cache.ts";
import {
  RecognitionConfigError,
  readProfileKey,
  resolveModelProfile,
  timeoutMsForRecognizer,
} from "./profiles.ts";

describe("resolveModelProfile", () => {
  it("未設定なら3機能とも Gemini 3.7 Flash", () => {
    expect(resolveModelProfile({}, "drink").modelId).toBe(GEMINI_37_FLASH_MODEL_ID);
    expect(resolveModelProfile({}, "label").modelId).toBe(GEMINI_37_FLASH_MODEL_ID);
    expect(resolveModelProfile({}, "note").modelId).toBe(GEMINI_37_FLASH_MODEL_ID);
    expect(resolveModelProfile({}, "drink").key).toBe("gemini-3.7-flash");
    expect(resolveModelProfile({}, "label").key).toBe("gemini-3.7-flash");
    expect(resolveModelProfile({}, "note").key).toBe("gemini-3.7-flash");
  });

  it("環境変数だけで呼び出し先が変わる", () => {
    const env = { AI_RECOGNITION_PROFILE: "workers-ai-llama" };
    expect(readProfileKey(env, "drink")).toBe("workers-ai-llama");
    expect(resolveModelProfile(env, "drink").modelId).toBe(WORKERS_AI_VISION_MODEL);
    expect(
      resolveModelProfile({ AI_RECOGNITION_PROFILE: "gemini-3.7-flash" }, "drink").modelId,
    ).toBe(GEMINI_37_FLASH_MODEL_ID);
    expect(
      resolveModelProfile({ AI_LABEL_RECOGNITION_PROFILE: "workers-ai-llama" }, "label").modelId,
    ).toBe(WORKERS_AI_VISION_MODEL);
    expect(
      resolveModelProfile({ AI_NOTE_RECOGNITION_PROFILE: "workers-ai-llama" }, "note").modelId,
    ).toBe(WORKERS_AI_VISION_MODEL);
  });

  it("不明な設定は設定エラー", () => {
    expect(() => resolveModelProfile({ AI_RECOGNITION_PROFILE: "gpt-imaginary" }, "drink")).toThrow(
      RecognitionConfigError,
    );
  });

  it("検索非対応の Llama を検索対応のように扱わない", () => {
    const llama = resolveModelProfile({ AI_RECOGNITION_PROFILE: "workers-ai-llama" }, "drink");
    expect(llama.supportsSearch).toBe(false);
    expect(llama.structuredOutputStyle).toBe("workers-ai-guided-json");
    const gemini = resolveModelProfile({}, "drink");
    expect(gemini.supportsSearch).toBe(true);
    expect(gemini.structuredOutputStyle).toBe("gemini-response-schema");
    expect(gemini.supportsThinking).toBe(true);
    expect(gemini.emitThinkingConfig).toBe(true);
    expect(gemini.thinkingLevel).toBe("low");
  });

  it("打ち切り時間はプロファイルに従い、指定があればそれを使う", () => {
    expect(timeoutMsForRecognizer({ profile: "gemini-3.7-flash" })).toBe(25_000);
    expect(timeoutMsForRecognizer({ profile: "workers-ai-llama" })).toBe(20_000);
    expect(timeoutMsForRecognizer({ profile: "gemini-3.7-flash" }, 20)).toBe(20);
  });
});

describe("recognitionCacheKey", () => {
  it("利用者・画像・モデル設定が違うとキーが混ざらない", () => {
    const base = {
      userId: "user-a",
      imageHash: "abc",
      profile: "gemini-3.7-flash",
      modelId: GEMINI_37_FLASH_MODEL_ID,
      promptVersion: "drink-extract-v2+drink-lookup-v1",
      schemaVersion: "drink-fields-v2",
      searchEnabled: true,
    };
    expect(recognitionCacheKey(base)).not.toBe(recognitionCacheKey({ ...base, userId: "user-b" }));
    expect(recognitionCacheKey(base)).not.toBe(
      recognitionCacheKey({
        ...base,
        profile: "workers-ai-llama",
        modelId: WORKERS_AI_VISION_MODEL,
      }),
    );
    expect(recognitionCacheKey(base)).not.toBe(
      recognitionCacheKey({ ...base, searchEnabled: false }),
    );
  });
});
