import { unknownTokenUsage } from "@/shared/ai-recognition.ts";
import type { RecognitionAdapter } from "./adapter.ts";
import { bytesToBase64 } from "./bytes.ts";
import { RecognitionConfigError } from "./profiles.ts";
import { normalizeTokenUsage } from "./usage.ts";

export function createWorkersAiAdapter(ai: Ai): RecognitionAdapter {
  return {
    async invoke(request) {
      if (request.profile.requestFormat !== "workers-ai-chat") {
        throw new RecognitionConfigError("unknown_profile", request.profile.key);
      }
      if (request.search || request.kind === "lookup") {
        throw new RecognitionConfigError("unknown_profile", "search_unsupported");
      }
      if (!request.jpegBytes) {
        throw new RecognitionConfigError("unknown_profile", "image_required");
      }
      throwIfAborted(request.signal);
      const imageUrl = `data:image/jpeg;base64,${bytesToBase64(request.jpegBytes)}`;
      const raw: unknown = await ai.run(request.profile.modelId, {
        messages: [
          { role: "system", content: request.systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl } },
              { type: "text", text: request.userPrompt },
            ],
          },
        ],
        guided_json: request.schema,
        max_tokens: request.profile.maxOutputTokens,
        temperature: request.profile.temperature,
      });
      throwIfAborted(request.signal);
      return {
        payload: raw,
        raw,
        usage: normalizeTokenUsage(raw) ?? { ...unknownTokenUsage },
        sources: [],
        searchUsed: false,
      };
    },
  };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  }
}
