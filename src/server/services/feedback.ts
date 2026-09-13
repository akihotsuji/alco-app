import { and, count, eq, gte } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import { feedbackPhotos, feedbacks } from "@/db/schema.ts";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import {
  FEEDBACK_DAILY_LIMIT,
  FEEDBACK_PHOTO_MAX,
  type FeedbackCategory,
} from "@/shared/feedback.ts";
import { tokyoDayStartMs, tokyoToday } from "@/shared/tokyo-date.ts";
import { ApiError } from "../errors.ts";
import type { SendFeedbackEmail } from "./feedback-mail.ts";
import { ImageInspectFailure, inspectImageBytes } from "./image-inspect.ts";
import type { PhotoBucket } from "./photos.ts";

export type FeedbackPhotoInput = {
  bytes: Uint8Array;
};

export type CreateFeedbackInput = {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  userEmail: string;
  category: FeedbackCategory;
  body: string;
  photos: readonly FeedbackPhotoInput[];
  sendMail: SendFeedbackEmail;
  now?: Date;
};

function inspectOrThrow(bytes: Uint8Array) {
  try {
    return inspectImageBytes(bytes);
  } catch (error) {
    if (error instanceof ImageInspectFailure) {
      if (error.code === "payload_too_large") {
        throw new ApiError("payload_too_large");
      }
      if (error.code === "unsupported_media_type") {
        throw new ApiError("unsupported_media_type");
      }
      throw new ApiError("validation_error", {
        fields: { photos: ["画像のサイズが大きすぎます"] },
      });
    }
    throw error;
  }
}

export async function createFeedback(input: CreateFeedbackInput): Promise<{ ok: true }> {
  if (input.photos.length > FEEDBACK_PHOTO_MAX) {
    throw new ApiError("validation_error", {
      fields: { photos: ["画像は3枚までです"] },
    });
  }

  const inspected = input.photos.map((photo) => {
    if (photo.bytes.byteLength > PHOTO_MAX_BYTES) {
      throw new ApiError("payload_too_large");
    }
    return { bytes: photo.bytes, image: inspectOrThrow(photo.bytes) };
  });

  const now = input.now ?? new Date();
  const dayStart = new Date(tokyoDayStartMs(tokyoToday(now)));
  const [{ n }] = await input.db
    .select({ n: count() })
    .from(feedbacks)
    .where(and(eq(feedbacks.userId, input.userId), gte(feedbacks.createdAt, dayStart)));

  if (Number(n) >= FEEDBACK_DAILY_LIMIT) {
    throw new ApiError("rate_limited");
  }

  const feedbackId = crypto.randomUUID();
  const photoRows = inspected.map((item, index) => {
    const id = crypto.randomUUID();
    return {
      id,
      feedbackId,
      r2Key: `feedback/${id}.${item.image.extension}`,
      contentType: item.image.contentType,
      byteSize: item.bytes.byteLength,
      width: item.image.width,
      height: item.image.height,
      sortOrder: index,
      createdAt: now,
      bytes: item.bytes,
    };
  });

  for (const photo of photoRows) {
    await input.bucket.put(photo.r2Key, photo.bytes, {
      httpMetadata: { contentType: photo.contentType },
    });
  }

  try {
    const feedbackInsert = input.db.insert(feedbacks).values({
      id: feedbackId,
      userId: input.userId,
      category: input.category,
      body: input.body,
      createdAt: now,
    });
    if (photoRows.length === 0) {
      await feedbackInsert;
    } else {
      await input.db.batch([
        feedbackInsert,
        input.db.insert(feedbackPhotos).values(
          photoRows.map((photo) => ({
            id: photo.id,
            feedbackId: photo.feedbackId,
            r2Key: photo.r2Key,
            contentType: photo.contentType,
            byteSize: photo.byteSize,
            width: photo.width,
            height: photo.height,
            sortOrder: photo.sortOrder,
            createdAt: photo.createdAt,
          })),
        ),
      ]);
    }
  } catch (error) {
    await Promise.all(
      photoRows.map((photo) => input.bucket.delete(photo.r2Key).catch(() => undefined)),
    );
    throw error;
  }

  try {
    await input.sendMail({
      category: input.category,
      body: input.body,
      userId: input.userId,
      userEmail: input.userEmail,
      createdAt: now,
      attachments: photoRows.map((photo) => ({
        filename: `${photo.sortOrder + 1}.${photo.r2Key.split(".").pop() ?? "jpg"}`,
        contentType: photo.contentType,
        bytes: photo.bytes,
      })),
    });
  } catch {
    console.error("feedback email send failed");
  }

  return { ok: true };
}
