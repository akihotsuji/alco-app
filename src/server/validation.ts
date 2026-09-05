import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
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
