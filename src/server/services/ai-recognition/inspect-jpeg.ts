import { ApiError } from "../../errors.ts";
import { ImageInspectFailure, inspectImageBytes } from "../image-inspect.ts";

export function inspectRecognizeJpeg(bytes: Uint8Array): void {
  try {
    const inspected = inspectImageBytes(bytes);
    if (inspected.contentType !== "image/jpeg") {
      throw new ApiError("unsupported_media_type");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof ImageInspectFailure) {
      if (error.code === "payload_too_large") {
        throw new ApiError("payload_too_large");
      }
      if (error.code === "unsupported_media_type") {
        throw new ApiError("unsupported_media_type");
      }
      throw new ApiError("validation_error", {
        fields: { file: ["画像のサイズが大きすぎます"] },
      });
    }
    throw error;
  }
}
