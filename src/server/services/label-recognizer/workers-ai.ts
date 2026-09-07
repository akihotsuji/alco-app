import { WORKERS_AI_VISION_MODEL } from "@/shared/constants.ts";
import type { LabelRecognizer } from "./index.ts";
import {
  LABEL_RECOGNIZE_GUIDED_JSON_SCHEMA,
  LABEL_RECOGNIZE_SYSTEM_PROMPT,
  LABEL_RECOGNIZE_USER_PROMPT,
} from "./prompt.ts";

export function createWorkersAiRecognizer(ai: Ai): LabelRecognizer {
  return {
    provider: "workers-ai",
    async recognize(jpegBytes) {
      const imageUrl = `data:image/jpeg;base64,${bytesToBase64(jpegBytes)}`;
      return ai.run(WORKERS_AI_VISION_MODEL, {
        messages: [
          { role: "system", content: LABEL_RECOGNIZE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl } },
              { type: "text", text: LABEL_RECOGNIZE_USER_PROMPT },
            ],
          },
        ],
        guided_json: LABEL_RECOGNIZE_GUIDED_JSON_SCHEMA,
        max_tokens: 400,
        temperature: 0,
      });
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
