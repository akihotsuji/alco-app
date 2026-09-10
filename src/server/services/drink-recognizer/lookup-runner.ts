import type { LabelRecognizeProvider } from "@/shared/constants.ts";
import type { DrinkLookupRequest } from "@/shared/drink-recognize.ts";
import type { AdapterResult } from "../ai-recognition/adapter.ts";
import {
  DRINK_LOOKUP_GEMINI_SCHEMA,
  DRINK_LOOKUP_SYSTEM_PROMPT,
  drinkLookupUserPrompt,
} from "../ai-recognition/drink-extract.ts";
import { resolveRecognitionSetup } from "../ai-recognition/factory.ts";
import {
  RecognitionConfigError,
  readGatewayCollectLog,
  readGatewayId,
} from "../ai-recognition/profiles.ts";

/**
 * 商品照合（二段階の後半）の差し替え口。
 * 抽出結果の文字列だけを渡し、検索付きで国・品種の出典を返す。
 */
export type DrinkLookupRunner = {
  readonly provider: LabelRecognizeProvider;
  readonly profile: string;
  readonly modelId: string;
  readonly supportsSearch: boolean;
  /** 照合だけの時間予算 */
  readonly timeoutMs: number;
  lookup(
    request: DrinkLookupRequest,
    options?: { signal?: AbortSignal },
  ): Promise<Pick<AdapterResult, "payload" | "sources" | "usage" | "searchUsed">>;
};

export function createDrinkLookupRunner(env: object): DrinkLookupRunner {
  try {
    const { profile, adapter } = resolveRecognitionSetup(env, "drink");
    const gatewayId = readGatewayId(env);
    const collectLog = readGatewayCollectLog(env);
    const supportsSearch =
      profile.supportsSearch && profile.requestFormat === "gemini-generate-content";
    return {
      provider: profile.provider,
      profile: profile.key,
      modelId: profile.modelId,
      supportsSearch,
      timeoutMs: profile.lookupTimeoutMs,
      async lookup(request, options) {
        const result = await adapter.invoke({
          profile,
          kind: "lookup",
          systemPrompt: DRINK_LOOKUP_SYSTEM_PROMPT,
          userPrompt: drinkLookupUserPrompt(request),
          schema: DRINK_LOOKUP_GEMINI_SCHEMA as Record<string, unknown>,
          search: true,
          signal: options?.signal,
          gatewayId,
          collectLog,
        });
        return {
          payload: result.payload,
          sources: result.sources,
          usage: result.usage,
          searchUsed: result.searchUsed,
        };
      },
    };
  } catch (error) {
    if (error instanceof RecognitionConfigError) {
      return createInvalidLookupRunner(error);
    }
    throw error;
  }
}

export function createInvalidLookupRunner(error: RecognitionConfigError): DrinkLookupRunner {
  return {
    provider: "gemini",
    profile: "",
    modelId: "",
    supportsSearch: false,
    timeoutMs: 0,
    lookup() {
      throw error;
    },
  };
}
