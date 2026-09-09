import {
  type AiRecognitionProfileKey,
  type AiRecognitionTask,
  isAiRecognitionProfileKey,
} from "@/shared/ai-recognition.ts";
import {
  AI_RECOGNIZE_LOOKUP_TIMEOUT_MS,
  AI_RECOGNIZE_TIMEOUT_MS,
  GEMINI_37_FLASH_MODEL_ID,
  GEMINI_37_FLASH_NATIVE_ID,
  type LabelRecognizeProvider,
  WORKERS_AI_VISION_MODEL,
} from "@/shared/constants.ts";

export type RecognitionRequestFormat = "gemini-generate-content" | "workers-ai-chat";
export type StructuredOutputStyle =
  | "json-prompt"
  | "gemini-response-schema"
  | "workers-ai-guided-json";

export type ModelProfile = {
  key: AiRecognitionProfileKey;
  provider: LabelRecognizeProvider;
  /** Cloudflare AI カタログ / binding に渡す ID */
  modelId: string;
  /** プロバイダー原生のモデル ID（ログと混同防止） */
  nativeModelId: string;
  requestFormat: RecognitionRequestFormat;
  supportsImage: boolean;
  supportsStructuredOutput: boolean;
  structuredOutputStyle: StructuredOutputStyle;
  supportsSearch: boolean;
  supportsThinking: boolean;
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
  /** Cloudflare binding で thinkingConfig の通過が確認できてから true */
  emitThinkingConfig: boolean;
  timeoutMs: number;
  lookupTimeoutMs: number;
  maxOutputTokens: number;
  lookupMaxOutputTokens: number;
  temperature: number;
  verification: "mock-only" | "production-llama";
};

export const MODEL_PROFILES: Record<AiRecognitionProfileKey, ModelProfile> = {
  "gemini-3.7-flash": {
    key: "gemini-3.7-flash",
    provider: "gemini",
    modelId: GEMINI_37_FLASH_MODEL_ID,
    nativeModelId: GEMINI_37_FLASH_NATIVE_ID,
    requestFormat: "gemini-generate-content",
    supportsImage: true,
    supportsStructuredOutput: true,
    structuredOutputStyle: "gemini-response-schema",
    supportsSearch: true,
    supportsThinking: true,
    thinkingLevel: "minimal",
    emitThinkingConfig: true,
    timeoutMs: 25_000,
    lookupTimeoutMs: AI_RECOGNIZE_LOOKUP_TIMEOUT_MS,
    maxOutputTokens: 4096,
    lookupMaxOutputTokens: 2048,
    temperature: 0,
    verification: "mock-only",
  },
  "workers-ai-llama": {
    key: "workers-ai-llama",
    provider: "workers-ai",
    modelId: WORKERS_AI_VISION_MODEL,
    nativeModelId: WORKERS_AI_VISION_MODEL,
    requestFormat: "workers-ai-chat",
    supportsImage: true,
    supportsStructuredOutput: true,
    structuredOutputStyle: "workers-ai-guided-json",
    supportsSearch: false,
    supportsThinking: false,
    emitThinkingConfig: false,
    timeoutMs: AI_RECOGNIZE_TIMEOUT_MS,
    lookupTimeoutMs: AI_RECOGNIZE_LOOKUP_TIMEOUT_MS,
    maxOutputTokens: 500,
    lookupMaxOutputTokens: 400,
    temperature: 0,
    verification: "production-llama",
  },
};

export const PROFILE_ENV_KEYS = {
  drink: "AI_RECOGNITION_PROFILE",
  label: "AI_LABEL_RECOGNITION_PROFILE",
  note: "AI_NOTE_RECOGNITION_PROFILE",
} as const satisfies Record<AiRecognitionTask, string>;

export const DEFAULT_PROFILE_BY_TASK: Record<AiRecognitionTask, AiRecognitionProfileKey> = {
  drink: "gemini-3.7-flash",
  label: "workers-ai-llama",
  note: "workers-ai-llama",
};

export class RecognitionConfigError extends Error {
  readonly reason: "unknown_profile" | "missing_binding";

  constructor(reason: "unknown_profile" | "missing_binding", detail?: string) {
    super(detail ?? reason);
    this.name = "RecognitionConfigError";
    this.reason = reason;
  }
}

function readOptionalString(env: object, key: string): string | undefined {
  const value = Reflect.get(env, key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readProfileKey(env: object, task: AiRecognitionTask): string {
  return readOptionalString(env, PROFILE_ENV_KEYS[task]) ?? DEFAULT_PROFILE_BY_TASK[task];
}

export function resolveModelProfile(env: object, task: AiRecognitionTask): ModelProfile {
  const key = readProfileKey(env, task);
  if (!isAiRecognitionProfileKey(key)) {
    throw new RecognitionConfigError("unknown_profile", key);
  }
  return MODEL_PROFILES[key];
}

export function readGatewayId(env: object): string {
  return readOptionalString(env, "AI_GATEWAY_ID") ?? "default";
}

export function readGatewayCollectLog(env: object): boolean {
  const raw = readOptionalString(env, "AI_GATEWAY_COLLECT_LOG");
  return raw === "1" || raw === "true";
}

export function readAiRecognizeDailyLimit(env: object, fallback: number): number {
  const raw = readOptionalString(env, "AI_RECOGNIZE_DAILY_LIMIT");
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) {
    throw new RecognitionConfigError("unknown_profile", "AI_RECOGNIZE_DAILY_LIMIT");
  }
  return parsed;
}

export function isAiBinding(value: unknown): value is Ai {
  return (
    typeof value === "object" &&
    value !== null &&
    "run" in value &&
    typeof Reflect.get(value, "run") === "function"
  );
}
