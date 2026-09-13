import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import { feedbackCreatedSchema, feedbackFieldsSchema } from "@/shared/feedback.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError, MALFORMED_REQUEST_MESSAGE } from "../errors.ts";
import { createFeedback } from "../services/feedback.ts";
import type { SendFeedbackEmail } from "../services/feedback-mail.ts";
import type { PhotoBucket } from "../services/photos.ts";

const FORM_KEYS = new Set(["category", "body", "photos"]);

export type FeedbackRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
  getSendMail: (c: Context<AppEnv>) => SendFeedbackEmail;
};

export function createFeedbackRoute(deps: FeedbackRouteDeps) {
  return new Hono<AppEnv>().post("/", async (c) => {
    const user = c.get("user");
    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      throw new ApiError("validation_error", {
        fields: { "": [MALFORMED_REQUEST_MESSAGE] },
      });
    }

    for (const key of form.keys()) {
      if (!FORM_KEYS.has(key)) {
        throw new ApiError("validation_error", {
          fields: { "": [MALFORMED_REQUEST_MESSAGE] },
        });
      }
    }

    const fields = feedbackFieldsSchema.parse({
      category: form.get("category") ?? undefined,
      body: form.get("body") ?? undefined,
    });

    const photos: { bytes: Uint8Array }[] = [];
    for (const entry of form.getAll("photos")) {
      if (!(entry instanceof File) || entry.size === 0) {
        continue;
      }
      if (entry.size > PHOTO_MAX_BYTES) {
        throw new ApiError("payload_too_large");
      }
      photos.push({ bytes: new Uint8Array(await entry.arrayBuffer()) });
    }

    await createFeedback({
      db: deps.getDb(c),
      bucket: deps.getBucket(c),
      userId: user.id,
      userEmail: user.email,
      category: fields.category,
      body: fields.body,
      photos,
      sendMail: deps.getSendMail(c),
    });

    return c.json(feedbackCreatedSchema.parse({ ok: true as const }), 201);
  });
}
