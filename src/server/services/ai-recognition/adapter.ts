import type { TokenUsage } from "@/shared/ai-recognition.ts";
import type { ModelProfile } from "./profiles.ts";

export type AdapterCallKind = "extract" | "lookup";

export type AdapterRequest = {
  profile: ModelProfile;
  kind: AdapterCallKind;
  jpegBytes?: Uint8Array;
  systemPrompt: string;
  userPrompt: string;
  schema: Record<string, unknown>;
  search: boolean;
  signal?: AbortSignal;
  gatewayId: string;
  collectLog: boolean;
};

export type AdapterResult = {
  payload: unknown;
  raw: unknown;
  usage: TokenUsage;
  sources: Array<{ url: string; title?: string }>;
  searchUsed: boolean;
};

export type RecognitionAdapter = {
  invoke(request: AdapterRequest): Promise<AdapterResult>;
};
