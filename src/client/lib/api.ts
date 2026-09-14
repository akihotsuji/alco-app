import { type ClientRequestOptions, type ClientResponse, hc } from "hono/client";
import type { AppType } from "@/server/index.ts";
import {
  type ApiErrorCode,
  type ApiErrorConflict,
  type ApiErrorFields,
  apiErrorBodySchema,
} from "@/shared/api-error.ts";
import { EARLY_FETCH_TIMEOUT_MS } from "./boot.ts";
import { takeEarlyFetch } from "./early-fetch.ts";
import { settleEarlyFetch } from "./fetch-timeout.ts";

/**
 * Hono RPC クライアント。SPA と API は同一 Worker・同一オリジンなので base は相対 `/`。
 * `AppType` は型だけを import する（サーバー実装をクライアントにバンドルしない）。
 * 画面・hooks は必ずこのクライアント経由で呼び、裸の `fetch` を書かない。
 */
export function createApiClient(options: ClientRequestOptions = {}) {
  return hc<AppType>("/", {
    ...options,
    fetch: (input: Request | string | URL, init?: RequestInit) => {
      const live = async () => {
        if (options.fetch) {
          return options.fetch(input, init);
        }
        return fetch(input, init);
      };
      const early = takeEarlyFetch(input, init);
      if (early) {
        return settleEarlyFetch(early, live, EARLY_FETCH_TIMEOUT_MS);
      }
      return live();
    },
    // セッション Cookie を必ず付ける（同一オリジンでも明示する）
    init: { credentials: "include", ...options.init },
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const api: ApiClient = createApiClient();

/**
 * API の非 2xx 応答。`code` は `spec/api-design.md` 2.6 のエラーコードで、クライアントは
 * これと 400 の `fields` だけを見る（メッセージ本文は表示に使わない）。
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: ApiErrorFields | undefined;
  readonly conflict: ApiErrorConflict | undefined;
  readonly retryAfterSec: number | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    fields?: ApiErrorFields,
    conflict?: ApiErrorConflict,
    retryAfterSec?: number,
  ) {
    super(`API ${status} ${code}`);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.conflict = conflict;
    this.retryAfterSec = retryAfterSec;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function isUnauthorizedError(error: unknown): boolean {
  return isApiClientError(error) && error.code === "unauthorized";
}

/** 本文が共通エラー形式でないとき（プロキシ応答など）のコード。401 だけはログイン導線に乗せる。 */
function fallbackCode(status: number): ApiErrorCode {
  return status === 401 ? "unauthorized" : "internal_error";
}

export function parseRetryAfterHeader(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }
  const date = Date.parse(value);
  if (Number.isFinite(date)) {
    return Math.max(0, Math.round((date - Date.now()) / 1000));
  }
  return undefined;
}

export async function toApiClientError(response: {
  status: number;
  headers?: Headers;
  text(): Promise<string>;
}): Promise<ApiClientError> {
  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    body = undefined;
  }
  const retryAfterSec = parseRetryAfterHeader(response.headers?.get("Retry-After"));
  const parsed = apiErrorBodySchema.safeParse(body);
  if (parsed.success) {
    return new ApiClientError(
      response.status,
      parsed.data.error,
      parsed.data.fields,
      parsed.data.conflict,
      retryAfterSec,
    );
  }
  return new ApiClientError(
    response.status,
    fallbackCode(response.status),
    undefined,
    undefined,
    retryAfterSec,
  );
}

/**
 * RPC の応答を JSON に解いて返す。非 2xx は `ApiClientError` として投げ、TanStack Query の
 * error に載せる。queryFn / mutationFn はこれで包んで書く。
 */
export async function unwrap<T>(request: Promise<ClientResponse<T, number, "json">>): Promise<T> {
  const response = await request;
  if (!response.ok) {
    throw await toApiClientError(response);
  }
  return response.json();
}
