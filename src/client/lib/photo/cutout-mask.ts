import {
  PHOTO_CUTOUT_MEAN,
  PHOTO_CUTOUT_MODEL_SIZE,
  PHOTO_CUTOUT_STD,
} from "@/shared/constants.ts";
import { CutoutError } from "./cutout-result.ts";

/** rembg U2-Net と同じ正規化（max で割り ImageNet mean/std、NCHW） */
export function packU2NetTensor(
  rgba: Uint8ClampedArray,
  size = PHOTO_CUTOUT_MODEL_SIZE,
): Float32Array {
  const plane = size * size;
  if (rgba.length < plane * 4) {
    throw new Error("cutout_tensor_size");
  }
  let max = 1e-6;
  for (let i = 0; i < plane; i += 1) {
    const offset = i * 4;
    max = Math.max(max, rgba[offset] ?? 0, rgba[offset + 1] ?? 0, rgba[offset + 2] ?? 0);
  }
  const out = new Float32Array(3 * plane);
  const mean = PHOTO_CUTOUT_MEAN;
  const std = PHOTO_CUTOUT_STD;
  for (let i = 0; i < plane; i += 1) {
    const offset = i * 4;
    const r = (rgba[offset] ?? 0) / max;
    const g = (rgba[offset + 1] ?? 0) / max;
    const b = (rgba[offset + 2] ?? 0) / max;
    out[i] = (r - mean[0]) / std[0];
    out[plane + i] = (g - mean[1]) / std[1];
    out[plane * 2 + i] = (b - mean[2]) / std[2];
  }
  return out;
}

export function flattenMaskOutput(
  data: Float32Array,
  modelSize = PHOTO_CUTOUT_MODEL_SIZE,
): Float32Array {
  const expected = modelSize * modelSize;
  if (data.length === expected) {
    return data;
  }
  if (data.length > expected && data.length % expected === 0) {
    return data.subarray(0, expected);
  }
  throw new Error("cutout_mask_shape");
}

export function normalizeU2NetMask(pred: Float32Array): Uint8Array {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of pred) {
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }
  const range = max - min || 1;
  const out = new Uint8Array(pred.length);
  for (let i = 0; i < pred.length; i += 1) {
    out[i] = Math.round((((pred[i] ?? 0) - min) / range) * 255);
  }
  return out;
}

export function applyAlphaMask(rgba: Uint8ClampedArray, mask: Uint8Array): void {
  const pixels = Math.min(mask.length, Math.floor(rgba.length / 4));
  for (let i = 0; i < pixels; i += 1) {
    rgba[i * 4 + 3] = mask[i] ?? 0;
  }
}

/** 外側だけを打ち切る。`promise` 自体は続くので、推論の直列化は呼び出し側（scheduler の hold）で担う */
export function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new CutoutError("timeout"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
