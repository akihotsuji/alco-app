import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { API_ERROR_CODES, type ApiErrorCode, type ApiErrorFields } from "@/shared/api-error.ts";

export const API_ERROR_STATUS = {
  validation_error: 400,
  unauthorized: 401,
  not_found: 404,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  upstream_error: 502,
  internal_error: 500,
} as const satisfies Record<ApiErrorCode, ContentfulStatusCode>;

/**
 * ハンドラから投げる業務エラー。`onError` が `{ error, fields? }` に変換する。
 * 存在しない ID と他人の ID はどちらも `not_found` にする（存在推測防止）。
 */
export class ApiError extends HTTPException {
  readonly code: ApiErrorCode;
  readonly fields: ApiErrorFields | undefined;

  constructor(code: ApiErrorCode, options: { fields?: ApiErrorFields } = {}) {
    super(API_ERROR_STATUS[code], { message: code });
    this.name = "ApiError";
    this.code = code;
    this.fields = options.fields;
  }
}

const CODE_BY_STATUS = new Map<number, ApiErrorCode>(
  API_ERROR_CODES.map((code) => [API_ERROR_STATUS[code], code]),
);

/** Hono 内部や他ミドルウェアが投げた HTTPException のステータスをエラーコードへ寄せる。 */
export function errorCodeForStatus(status: number): ApiErrorCode {
  return CODE_BY_STATUS.get(status) ?? "internal_error";
}
