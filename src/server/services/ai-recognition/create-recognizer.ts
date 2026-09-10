import type { AiRecognitionTask } from "@/shared/ai-recognition.ts";
import {
  DRINK_RECOGNIZE_GUIDED_JSON_SCHEMA,
  DRINK_RECOGNIZE_SYSTEM_PROMPT,
  DRINK_RECOGNIZE_USER_PROMPT,
} from "../drink-recognizer/prompt.ts";
import type { LabelRecognizer } from "../label-recognizer/index.ts";
import {
  LABEL_RECOGNIZE_GEMINI_SCHEMA,
  LABEL_RECOGNIZE_GUIDED_JSON_SCHEMA,
  LABEL_RECOGNIZE_SYSTEM_PROMPT,
  LABEL_RECOGNIZE_USER_PROMPT,
} from "../label-recognizer/prompt.ts";
import {
  NOTE_RECOGNIZE_GEMINI_SCHEMA,
  NOTE_RECOGNIZE_GUIDED_JSON_SCHEMA,
  NOTE_RECOGNIZE_SYSTEM_PROMPT,
  NOTE_RECOGNIZE_USER_PROMPT,
} from "../note-recognizer/prompt.ts";
import {
  DRINK_EXTRACT_GEMINI_SCHEMA,
  DRINK_EXTRACT_SYSTEM_PROMPT,
  DRINK_EXTRACT_USER_PROMPT,
} from "./drink-extract.ts";
import { resolveRecognitionSetup } from "./factory.ts";
import { RecognitionConfigError, readGatewayCollectLog, readGatewayId } from "./profiles.ts";

export function taskPrompts(
  task: AiRecognitionTask,
  format: "gemini-generate-content" | "workers-ai-chat",
) {
  if (task === "drink") {
    if (format === "gemini-generate-content") {
      return {
        systemPrompt: DRINK_EXTRACT_SYSTEM_PROMPT,
        userPrompt: DRINK_EXTRACT_USER_PROMPT,
        schema: DRINK_EXTRACT_GEMINI_SCHEMA as Record<string, unknown>,
      };
    }
    return {
      systemPrompt: DRINK_RECOGNIZE_SYSTEM_PROMPT,
      userPrompt: DRINK_RECOGNIZE_USER_PROMPT,
      schema: DRINK_RECOGNIZE_GUIDED_JSON_SCHEMA as Record<string, unknown>,
    };
  }
  if (task === "label") {
    if (format === "gemini-generate-content") {
      return {
        systemPrompt: LABEL_RECOGNIZE_SYSTEM_PROMPT,
        userPrompt: LABEL_RECOGNIZE_USER_PROMPT,
        schema: LABEL_RECOGNIZE_GEMINI_SCHEMA as Record<string, unknown>,
      };
    }
    return {
      systemPrompt: LABEL_RECOGNIZE_SYSTEM_PROMPT,
      userPrompt: LABEL_RECOGNIZE_USER_PROMPT,
      schema: LABEL_RECOGNIZE_GUIDED_JSON_SCHEMA as Record<string, unknown>,
    };
  }
  if (format === "gemini-generate-content") {
    return {
      systemPrompt: NOTE_RECOGNIZE_SYSTEM_PROMPT,
      userPrompt: NOTE_RECOGNIZE_USER_PROMPT,
      schema: NOTE_RECOGNIZE_GEMINI_SCHEMA as Record<string, unknown>,
    };
  }
  return {
    systemPrompt: NOTE_RECOGNIZE_SYSTEM_PROMPT,
    userPrompt: NOTE_RECOGNIZE_USER_PROMPT,
    schema: NOTE_RECOGNIZE_GUIDED_JSON_SCHEMA as Record<string, unknown>,
  };
}

export function createTaskRecognizer(env: object, task: AiRecognitionTask): LabelRecognizer {
  try {
    const { profile, adapter } = resolveRecognitionSetup(env, task);
    const prompts = taskPrompts(task, profile.requestFormat);
    const gatewayId = readGatewayId(env);
    const collectLog = readGatewayCollectLog(env);
    return {
      provider: profile.provider,
      profile: profile.key,
      modelId: profile.modelId,
      async recognize(jpegBytes, options) {
        const result = await adapter.invoke({
          profile,
          kind: "extract",
          jpegBytes,
          systemPrompt: prompts.systemPrompt,
          userPrompt: prompts.userPrompt,
          schema: prompts.schema,
          search: false,
          signal: options?.signal,
          gatewayId,
          collectLog,
        });
        return result.payload;
      },
    };
  } catch (error) {
    if (error instanceof RecognitionConfigError) {
      return createInvalidRecognizer(error);
    }
    throw error;
  }
}

export function createInvalidRecognizer(error: RecognitionConfigError): LabelRecognizer {
  return {
    provider: "gemini",
    profile: "",
    modelId: "",
    recognize() {
      throw error;
    },
  };
}

export function isRecognizerConfigured(recognizer: { profile: string; modelId: string }): boolean {
  return recognizer.profile.length > 0 && recognizer.modelId.length > 0;
}
