import { type ClientResponse, DetailedError, hc, parseResponse } from "hono/client";
import { z } from "zod";
// 型だけ読む。値として import すると Workers 向けのサーバーコードが SPA にバンドルされる
import type { AppType } from "@/server/index.ts";
import { type ApiErrorCode, type ApiErrorFields, apiErrorBodySchema } from "@/shared/api-error.ts";

/**
 * SPA と API は同じ Worker・同じオリジン。ルートのパスに `/api` が含まれる
 * （spec/api-design.md 1 章）ので base はオリジン直下の相対 URL。
 */
const API_BASE_URL = "";

export function createRpcClient(fetchImpl?: typeof fetch) {
  return hc<AppType>(API_BASE_URL, {
    fetch: fetchImpl,
    init: { credentials: "include" },
  });
}

export type RpcClient = ReturnType<typeof createRpcClient>;

/** アプリ全体で共有する RPC クライアント。コンポーネントは直接 `fetch` しない。 */
export const rpc = createRpcClient();

/** サーバーが `{ error, fields? }` を返した（spec/api-design.md 2.6）。ネットワーク断は `TypeError` のまま。 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: ApiErrorFields | undefined;

  constructor(status: number, code: ApiErrorCode, fields?: ApiErrorFields) {
    super(`API ${status} ${code}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

const detailSchema = z.object({ data: apiErrorBodySchema });

/** 本文が共通エラー形式でないとき（中継サーバーの HTML 等）に status から code を補う。 */
const FALLBACK_CODE_BY_STATUS: Readonly<Record<number, ApiErrorCode>> = {
  401: "unauthorized",
  404: "not_found",
  413: "payload_too_large",
  415: "unsupported_media_type",
  429: "rate_limited",
};

function toApiRequestError(error: DetailedError): ApiRequestError {
  const status = typeof error.statusCode === "number" ? error.statusCode : 500;
  const detail = detailSchema.safeParse(error.detail);
  if (detail.success) {
    return new ApiRequestError(status, detail.data.data.error, detail.data.data.fields);
  }
  return new ApiRequestError(status, FALLBACK_CODE_BY_STATUS[status] ?? "internal_error");
}

/**
 * RPC の `Response` を成功時の JSON に解決し、非 2xx は `ApiRequestError` にして投げる。
 * TanStack Query の `queryFn` / `mutationFn` はこれを通す。
 */
export function unwrap<T extends ClientResponse<unknown>>(
  response: T | Promise<T>,
): ReturnType<typeof parseResponse<T>> {
  return parseResponse(response).catch((error: unknown) => {
    if (error instanceof DetailedError) {
      throw toApiRequestError(error);
    }
    throw error;
  });
}
