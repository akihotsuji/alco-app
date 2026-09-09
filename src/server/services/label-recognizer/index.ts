import type { LabelRecognizeProvider } from "@/shared/constants.ts";

/**
 * ラベル読み取りの差し替え口。
 * 画像バイトだけを渡し、プロンプトにユーザー文を混ぜない。
 */
export type LabelRecognizer = {
  readonly provider: LabelRecognizeProvider;
  readonly profile: string;
  readonly modelId: string;
  recognize(jpegBytes: Uint8Array, options?: { signal?: AbortSignal }): Promise<unknown>;
};
