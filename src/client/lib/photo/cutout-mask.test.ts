import { describe, expect, it } from "vitest";
import { PHOTO_CUTOUT_MODEL_SIZE } from "@/shared/constants.ts";
import {
  applyAlphaMask,
  flattenMaskOutput,
  normalizeU2NetMask,
  packU2NetTensor,
  raceWithTimeout,
} from "./cutout-mask.ts";

describe("packU2NetTensor", () => {
  it("NCHW で ImageNet 正規化する", () => {
    const size = 2;
    const rgba = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i += 1) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = 255;
    }
    const tensor = packU2NetTensor(rgba, size);
    expect(tensor.length).toBe(3 * size * size);
    expect(tensor[0]).toBeCloseTo((1 - 0.485) / 0.229);
    expect(tensor[size * size]).toBeCloseTo((0 - 0.456) / 0.224);
  });
});

describe("flattenMaskOutput", () => {
  it("先頭チャンネルだけ取る", () => {
    const first = new Float32Array(PHOTO_CUTOUT_MODEL_SIZE * PHOTO_CUTOUT_MODEL_SIZE).fill(1);
    const second = new Float32Array(PHOTO_CUTOUT_MODEL_SIZE * PHOTO_CUTOUT_MODEL_SIZE).fill(9);
    const stacked = new Float32Array(first.length + second.length);
    stacked.set(first, 0);
    stacked.set(second, first.length);
    const flat = flattenMaskOutput(stacked);
    expect(flat.length).toBe(first.length);
    expect(flat[0]).toBe(1);
  });
});

describe("normalizeU2NetMask", () => {
  it("min-max で 0..255 にする", () => {
    const mask = normalizeU2NetMask(new Float32Array([0, 1, 0.5]));
    expect(mask[0]).toBe(0);
    expect(mask[1]).toBe(255);
    expect(mask[2]).toBe(128);
  });
});

describe("applyAlphaMask", () => {
  it("アルファを書き込む", () => {
    const rgba = new Uint8ClampedArray(8);
    rgba[3] = 255;
    rgba[7] = 255;
    applyAlphaMask(rgba, new Uint8Array([10, 200]));
    expect(rgba[3]).toBe(10);
    expect(rgba[7]).toBe(200);
  });
});

describe("raceWithTimeout", () => {
  it("時間内なら解決し、超過なら CutoutError(timeout)", async () => {
    await expect(raceWithTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
    await expect(raceWithTimeout(new Promise(() => {}), 10)).rejects.toMatchObject({
      name: "CutoutError",
      reason: "timeout",
    });
  });
});
