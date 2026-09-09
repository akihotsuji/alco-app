import type { AiRecognitionTask } from "@/shared/ai-recognition.ts";
import type { RecognitionAdapter } from "./adapter.ts";
import { createGeminiGatewayAdapter } from "./gemini-adapter.ts";
import {
  isAiBinding,
  type ModelProfile,
  RecognitionConfigError,
  resolveModelProfile,
} from "./profiles.ts";
import { createWorkersAiAdapter } from "./workers-ai-adapter.ts";

export function createAdapterForProfile(env: object, profile: ModelProfile): RecognitionAdapter {
  const ai = Reflect.get(env, "AI");
  if (!isAiBinding(ai)) {
    throw new RecognitionConfigError("missing_binding");
  }
  if (profile.requestFormat === "gemini-generate-content") {
    return createGeminiGatewayAdapter(ai);
  }
  return createWorkersAiAdapter(ai);
}

export function resolveRecognitionSetup(
  env: object,
  task: AiRecognitionTask,
): { profile: ModelProfile; adapter: RecognitionAdapter } {
  const profile = resolveModelProfile(env, task);
  return { profile, adapter: createAdapterForProfile(env, profile) };
}
