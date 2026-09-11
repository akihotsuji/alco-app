import type { Context } from "hono";
import type { AppEnv } from "../app-env.ts";
import { ApiError, MALFORMED_REQUEST_MESSAGE } from "../errors.ts";

/** POST の Origin がリクエスト origin と一致しないときは拒否する。 */
export function assertSameOrigin(c: Context<AppEnv>): void {
  const origin = c.req.header("Origin");
  if (!origin) {
    throw new ApiError("validation_error", {
      fields: { "": [MALFORMED_REQUEST_MESSAGE] },
    });
  }
  const requestOrigin = new URL(c.req.url).origin;
  if (origin !== requestOrigin) {
    throw new ApiError("validation_error", {
      fields: { "": [MALFORMED_REQUEST_MESSAGE] },
    });
  }
}
