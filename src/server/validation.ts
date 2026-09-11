import { zValidator } from "@hono/zod-validator";
import type { Context, MiddlewareHandler, ValidationTargets } from "hono";
import type { z } from "zod";
import { ApiError } from "./errors.ts";
import { fieldsFromZodIssues } from "./middleware/error.ts";

/**
 * `@hono/zod-validator` の共通ラッパー。失敗は 400 `validation_error` + `fields`。
 * スキーマは `src/shared/` のものを渡す（`userId` / `alcoholG` をスキーマに置かない）。
 *
 * @example
 * route.post("/", validate("json", createDrinkLogSchema), (c) => {
 *   const input = c.req.valid("json");
 * });
 */
export function validate<T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ApiError("validation_error", {
        fields: fieldsFromZodIssues(result.error.issues),
      });
    }
  });
}

/**
 * JSON ボディを Zod で検証する。本文が空（ボディなし）のときは `{}` として扱う。
 * consume / restore のように「ボディなし、空オブジェクト可、未知キーは 400」のときに使う。
 * `c.req.json()` は空本文で例外になるため、zValidator の json ターゲットは使わない。
 */
export function validateJsonAllowingEmpty<T extends z.ZodType>(schema: T) {
  const typed = validate("json", schema);
  const middleware: MiddlewareHandler = async (c, next) => {
    const text = await c.req.text();
    let raw: unknown = {};
    if (text.trim() !== "") {
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        throw new ApiError("validation_error", {
          fields: { "": ["リクエストの形式が正しくありません"] },
        });
      }
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError("validation_error", {
        fields: fieldsFromZodIssues(parsed.error.issues),
      });
    }
    c.req.addValidatedData("json", parsed.data as object);
    await next();
  };
  return middleware as typeof typed;
}

/** `validateJsonAllowingEmpty` のあとに JSON を取る。Hono の Input 型は空ボディ検証を載せない。 */
export function validJson<T>(c: Context): T {
  return (c.req as { valid(target: "json"): T }).valid("json");
}
