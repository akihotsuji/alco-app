import { PHOTO_CUTOUT_MODEL_BYTES, PHOTO_CUTOUT_MODEL_SHA256 } from "./constants.ts";

export const CUTOUT_MODEL_INVALID_REASONS = ["html", "size", "hash"] as const;

export type CutoutModelInvalidReason = (typeof CUTOUT_MODEL_INVALID_REASONS)[number];

export type CutoutModelInspection = { ok: true } | { ok: false; reason: CutoutModelInvalidReason };

/** SPA fallback の HTML をモデルとして扱わない */
export function isHtmlLikeBytes(bytes: Uint8Array): boolean {
  let index = 0;
  while (index < bytes.length) {
    const value = bytes[index] ?? 0;
    if (value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d) {
      index += 1;
      continue;
    }
    return value === 0x3c;
  }
  return false;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function inspectCutoutModelBytes(
  source: ArrayBuffer | Uint8Array,
): Promise<CutoutModelInspection> {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  if (isHtmlLikeBytes(bytes)) {
    return { ok: false, reason: "html" };
  }
  if (bytes.byteLength !== PHOTO_CUTOUT_MODEL_BYTES) {
    return { ok: false, reason: "size" };
  }
  const digest = await sha256Hex(bytes);
  if (digest !== PHOTO_CUTOUT_MODEL_SHA256) {
    return { ok: false, reason: "hash" };
  }
  return { ok: true };
}
