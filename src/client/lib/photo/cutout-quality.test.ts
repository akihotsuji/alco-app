import { describe, expect, it } from "vitest";
import { PHOTO_CUTOUT_MASK } from "@/shared/constants.ts";
import {
  cleanupMask,
  measureBottleMask,
  refineBottleMask,
  validateBottleMask,
} from "./cutout-quality.ts";

const W = 64;
const H = 64;

function blank(fill = 0): Uint8Array {
  return new Uint8Array(W * H).fill(fill);
}

function paintRect(
  mask: Uint8Array,
  rect: { x: number; y: number; width: number; height: number },
  value = 255,
): Uint8Array {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      mask[y * W + x] = value;
    }
  }
  return mask;
}

/** 中央の縦長ボトル（幅 14 / 高さ 52、下端接地） */
function centeredBottle(background = 0): Uint8Array {
  return paintRect(blank(background), { x: 25, y: 12, width: 14, height: 52 });
}

describe("cleanupMask", () => {
  it("薄い alpha を 0、確かな alpha を 255 にし、中間は線形に伸ばす", () => {
    const mask = new Uint8Array([0, 20, 40, 41, 128, 216, 255, 0]);
    const cleaned = cleanupMask(mask, 4, 2, {
      lowAlpha: 40,
      highAlpha: 216,
      minComponentRatio: 0,
    });
    expect([...cleaned.subarray(0, 3)]).toEqual([0, 0, 0]);
    expect(cleaned[3]).toBe(1);
    expect(cleaned[4]).toBe(Math.round(((128 - 40) / 176) * 255));
    expect(cleaned[5]).toBe(255);
    expect(cleaned[6]).toBe(255);
  });

  it("小さな連結成分（ゴミ）を消し、最大成分は残す", () => {
    const mask = centeredBottle();
    paintRect(mask, { x: 2, y: 2, width: 2, height: 2 });
    const cleaned = cleanupMask(mask, W, H);
    expect(cleaned[2 * W + 2]).toBe(0);
    expect(cleaned[30 * W + 30]).toBe(255);
  });

  it("成分比が閾値以上の 2 つ目の物体は残す（複数本の写真を壊さない）", () => {
    const mask = centeredBottle();
    paintRect(mask, { x: 4, y: 20, width: 10, height: 40 });
    const cleaned = cleanupMask(mask, W, H);
    expect(cleaned[30 * W + 8]).toBe(255);
  });

  it("サイズ不一致は例外", () => {
    expect(() => cleanupMask(new Uint8Array(3), 2, 2)).toThrow("cutout_mask_size");
  });
});

describe("measureBottleMask", () => {
  it("中央縦長ボトルの特徴量", () => {
    const features = measureBottleMask(centeredBottle(), W, H);
    expect(features.foregroundRatio).toBeCloseTo((14 * 52) / (W * H), 5);
    expect(features.bbox).toEqual({ x: 25, y: 12, width: 14, height: 52 });
    expect(features.bboxAspect).toBeCloseTo(52 / 14, 5);
    expect(features.centerX).toBeCloseTo(0.5, 1);
    expect(features.borderContact.left).toBe(0);
    expect(features.borderContact.right).toBe(0);
    expect(features.borderContact.bottom).toBeCloseTo(14 / W, 5);
    expect(features.dynamicRange).toBe(1);
    expect(features.largestComponentRatio).toBe(1);
  });

  it("全面透明なら bbox は null", () => {
    const features = measureBottleMask(blank(), W, H);
    expect(features.bbox).toBeNull();
    expect(features.foregroundRatio).toBe(0);
    expect(features.largestComponentRatio).toBe(0);
  });

  it("中間値ばかりのマスクは dynamicRange が低い", () => {
    const features = measureBottleMask(blank(128), W, H);
    expect(features.dynamicRange).toBe(0);
  });
});

describe("validateBottleMask", () => {
  it("1. 中央の縦長 object → valid", () => {
    const result = validateBottleMask(measureBottleMask(centeredBottle(), W, H));
    expect(result.ok).toBe(true);
  });

  it("2. 画像全面 foreground → invalid_mask", () => {
    const result = validateBottleMask(measureBottleMask(blank(255), W, H));
    expect(result).toMatchObject({ ok: false, reason: "invalid_mask" });
  });

  it("3. foreground が 1% 未満 → empty_mask", () => {
    const mask = paintRect(blank(), { x: 30, y: 30, width: 3, height: 3 });
    const result = validateBottleMask(measureBottleMask(mask, W, H));
    expect(result).toMatchObject({ ok: false, reason: "empty_mask" });
  });

  it("4. 背景に薄い alpha だけ残る → cleanup 後 valid で背景は 0", () => {
    const faint = centeredBottle(24);
    const rawBbox = measureBottleMask(faint, W, H, { subjectAlpha: 8 }).bbox;
    expect(rawBbox).toEqual({ x: 0, y: 0, width: W, height: H });

    const refined = refineBottleMask(faint, W, H);
    expect(refined.validation.ok).toBe(true);
    expect(refined.mask[0]).toBe(0);
    expect(refined.mask[30 * W + 30]).toBe(255);
    expect(refined.validation.features.bbox).toEqual({ x: 25, y: 12, width: 14, height: 52 });
  });

  it("5. 左右端が全面 foreground → invalid_mask", () => {
    const mask = paintRect(blank(), { x: 0, y: 0, width: W, height: H }, 255);
    paintRect(mask, { x: 20, y: 0, width: 24, height: H }, 0);
    const features = measureBottleMask(mask, W, H);
    expect(features.foregroundRatio).toBeLessThan(PHOTO_CUTOUT_MASK.maxForegroundRatio);
    const result = validateBottleMask(features);
    expect(result).toMatchObject({ ok: false, reason: "invalid_mask" });
    if (!result.ok) {
      expect(result.detail).toContain("side contact");
    }
  });

  it("片側だけ端に触れる（瓶が画面端に寄った）は valid", () => {
    const mask = paintRect(blank(), { x: 0, y: 8, width: 16, height: 56 });
    expect(validateBottleMask(measureBottleMask(mask, W, H)).ok).toBe(true);
  });

  it("上下端に触れる（背の高い瓶）は valid", () => {
    const mask = paintRect(blank(), { x: 24, y: 0, width: 16, height: H });
    expect(validateBottleMask(measureBottleMask(mask, W, H)).ok).toBe(true);
  });

  it("横長の物体でも比率だけでは落とさない", () => {
    const mask = paintRect(blank(), { x: 8, y: 24, width: 48, height: 12 });
    expect(validateBottleMask(measureBottleMask(mask, W, H)).ok).toBe(true);
  });

  it("旧判定（alpha>16 が 1% 以上）で通っていた全面マスクを落とす", () => {
    const legacyPass = blank(200);
    const result = refineBottleMask(legacyPass, W, H);
    expect(result.validation.ok).toBe(false);
  });
});
