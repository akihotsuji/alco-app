import type { LabelRecognizeProvider } from "@/shared/constants.ts";

/**
 * ラベル読み取りの差し替え口。
 * 画像バイトだけを渡し、プロンプトにユーザー文を混ぜない。
 */
export type LabelRecognizeOptions = {
  signal?: AbortSignal;
  /** ボトル裏面の JPEG。あれば表面と同じ 1 回の呼び出しに 2 枚目として渡す。 */
  backJpegBytes?: Uint8Array;
};

export type LabelRecognizer = {
  readonly provider: LabelRecognizeProvider;
  readonly profile: string;
  readonly modelId: string;
  recognize(jpegBytes: Uint8Array, options?: LabelRecognizeOptions): Promise<unknown>;
};
