import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { ApiErrorBody, ApiErrorFields } from "@/shared/api-error.ts";
import type { AppEnv } from "../app-env.ts";
import { API_ERROR_STATUS, ApiError, errorCodeForStatus } from "../errors.ts";

const ROOT_FIELD = "";
const MALFORMED_REQUEST_MESSAGE = "リクエストの形式が正しくありません";

/** Zod の path 配列を `fields` のキーへ畳む。内部パスやスキーマの所在は出さない。 */
export function fieldsFromZodIssues(issues: readonly z.core.$ZodIssue[]): ApiErrorFields {
  const fields: ApiErrorFields = {};
  for (const issue of issues) {
    const key = issue.path
      .map((segment) =>
        typeof segment === "symbol" ? (segment.description ?? "") : String(segment),
      )
      .join(".");
    const messages = fields[key] ?? [];
    messages.push(issue.message);
    fields[key] = messages;
  }
  return fields;
}

function respond(
  c: Parameters<ErrorHandler<AppEnv>>[1],
  body: ApiErrorBody,
  status: ContentfulStatusCode,
) {
  return c.json(body, status);
}

/**
 * 全 API 共通。クライアントには `error` コード（と 400 の `fields`）だけを返し、
 * スタック・SQL・内部パスは Workers Logs にのみ出す。
 */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof ApiError) {
    return respond(
      c,
      err.fields ? { error: err.code, fields: err.fields } : { error: err.code },
      API_ERROR_STATUS[err.code],
    );
  }

  if (err instanceof z.ZodError) {
    return respond(
      c,
      { error: "validation_error", fields: fieldsFromZodIssues(err.issues) },
      API_ERROR_STATUS.validation_error,
    );
  }

  if (err instanceof HTTPException) {
    const code = errorCodeForStatus(err.status);
    if (code === "validation_error") {
      // hono/validator の JSON 不正・Content-Type 不一致など。詳細文言はエコーしない
      return respond(
        c,
        { error: code, fields: { [ROOT_FIELD]: [MALFORMED_REQUEST_MESSAGE] } },
        API_ERROR_STATUS[code],
      );
    }
    if (code === "internal_error") {
      logUnexpected(err, c.req.method, c.req.path);
    }
    return respond(c, { error: code }, API_ERROR_STATUS[code]);
  }

  logUnexpected(err, c.req.method, c.req.path);
  return respond(c, { error: "internal_error" }, API_ERROR_STATUS.internal_error);
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  c.json({ error: "not_found" } satisfies ApiErrorBody, API_ERROR_STATUS.not_found);

/** クエリ・ヘッダー・ボディはログに出さない（Cookie / パスワード混入防止）。 */
function logUnexpected(err: unknown, method: string, path: string) {
  console.error(`[api] unhandled error: ${method} ${path}`, err);
}
