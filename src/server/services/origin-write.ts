import { ORIGIN_MESSAGES, resolveWritableOrigin } from "@/shared/origin-countries.ts";
import { ApiError } from "../errors.ts";

/**
 * 書込み用の生産国。省略は undefined、クリアは null。
 * 既存不正値を変えない更新は keep。新しい不正値は 400。
 */
export function writtenOrigin(
  raw: string | null | undefined,
  current?: string | null,
): string | null | undefined {
  const resolved = resolveWritableOrigin(raw, current);
  switch (resolved.status) {
    case "omit":
      return undefined;
    case "clear":
      return null;
    case "ok":
    case "keep":
      return resolved.value ?? null;
    case "invalid":
      throw new ApiError("validation_error", {
        fields: { origin: [ORIGIN_MESSAGES.invalid] },
      });
  }
}
