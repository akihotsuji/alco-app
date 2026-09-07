import type { LabelRecognizeProvider } from "@/shared/constants.ts";

/**
 * ラベル読み取りの差し替え口。Workers AI 以外（Gemini 等）は将来の実装。
 * 画像バイトだけを渡し、プロンプトにユーザー文を混ぜない。
 */
export type LabelRecognizer = {
  readonly provider: LabelRecognizeProvider;
  recognize(jpegBytes: Uint8Array): Promise<unknown>;
};
