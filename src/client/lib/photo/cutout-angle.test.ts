import { describe, expect, it } from "vitest";
import { PHOTO_CUTOUT_UPRIGHT } from "@/shared/constants.ts";
import {
  clampAngleDegrees,
  estimateBottleUpright,
  majorAxisAngleFromX,
  restoreMaskAspect,
  tiltFromVerticalDegrees,
  wrapAngleDegrees,
} from "./cutout-angle.ts";
import { measureBottleMask } from "./cutout-quality.ts";

const W = 64;
const H = 128;

function blank(width = W, height = H): Uint8Array {
  return new Uint8Array(width * height);
}

/** y 下向き・正が時計回り。軸付き矩形を塗りつぶす */
function paintRotatedRect(
  mask: Uint8Array,
  width: number,
  height: number,
  input: { cx: number; cy: number; rw: number; rh: number; degrees: number },
): Uint8Array {
  const rad = (input.degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = input.rw / 2;
  const hh = input.rh / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - input.cx;
      const dy = y - input.cy;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) {
        mask[y * width + x] = 255;
      }
    }
  }
  return mask;
}

function bottle(degrees: number): Uint8Array {
  return paintRotatedRect(blank(), W, H, {
    cx: W / 2,
    cy: H / 2,
    rw: 16,
    rh: 88,
    degrees,
  });
}

function decide(mask: Uint8Array, width = W, height = H) {
  return estimateBottleUpright({
    mask,
    width,
    height,
    features: measureBottleMask(mask, width, height),
  });
}

describe("wrapAngleDegrees / clampAngleDegrees", () => {
  it("±180 の範囲に畳み、-180 は 180 に寄せる", () => {
    expect(wrapAngleDegrees(190)).toBe(-170);
    expect(wrapAngleDegrees(-190)).toBe(170);
    expect(wrapAngleDegrees(-180)).toBe(180);
    expect(clampAngleDegrees(200)).toBe(180);
    expect(clampAngleDegrees(-200)).toBe(-180);
  });
});

describe("tiltFromVerticalDegrees", () => {
  it("鉛直の長軸は 0 度、180 度の曖昧さを畳む", () => {
    expect(tiltFromVerticalDegrees(Math.PI / 2)).toBeCloseTo(0, 5);
    expect(tiltFromVerticalDegrees(-Math.PI / 2)).toBeCloseTo(0, 5);
    expect(Math.abs(tiltFromVerticalDegrees(0))).toBeCloseTo(90, 5);
  });
});

describe("majorAxisAngleFromX", () => {
  it("分散が y 方向なら鉛直", () => {
    expect(tiltFromVerticalDegrees(majorAxisAngleFromX(1, 0, 20))).toBeCloseTo(0, 5);
  });
});

describe("restoreMaskAspect", () => {
  it("正方形モデル空間を元の縦横比へ戻す", () => {
    const square = new Uint8Array(4);
    square[0] = 10;
    square[1] = 20;
    square[2] = 30;
    square[3] = 40;
    const restored = restoreMaskAspect(square, 2, 4, 2);
    expect(restored.length).toBe(8);
    expect(restored[0]).toBe(10);
    expect(restored[2]).toBe(20);
  });
});

describe("estimateBottleUpright", () => {
  it("直立の明瞭な瓶は回さない", () => {
    const decision = decide(bottle(0));
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("upright");
    expect(Math.abs(decision.correctionDegrees)).toBe(0);
  });

  it.each([5, 10, 20] as const)("時計回り %i 度の合成瓶は残差 2 度以内で逆回転する", (tilt) => {
    const decision = decide(bottle(tilt));
    expect(decision.applied).toBe(true);
    expect(decision.correctionDegrees).toBeLessThanOrEqual(0);
    expect(Math.abs(decision.tiltDegrees - tilt)).toBeLessThanOrEqual(2);
    expect(Math.abs(decision.correctionDegrees + tilt)).toBeLessThanOrEqual(2);
  });

  it.each([-5, -10, -20] as const)(
    "反時計回り %i 度の合成瓶は残差 2 度以内で逆回転する",
    (tilt) => {
      const decision = decide(bottle(tilt));
      expect(decision.applied).toBe(true);
      expect(Math.abs(decision.tiltDegrees - tilt)).toBeLessThanOrEqual(2);
      expect(Math.abs(decision.correctionDegrees + tilt)).toBeLessThanOrEqual(2);
    },
  );

  it("20 度を超える傾きは自動補正しない", () => {
    const decision = decide(bottle(28));
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("too_tilted");
    expect(decision.correctionDegrees).toBe(0);
    expect(PHOTO_CUTOUT_UPRIGHT.maxAutoDegrees).toBe(20);
  });

  it("横置きは自動補正しない", () => {
    const mask = paintRotatedRect(blank(), W, H, {
      cx: W / 2,
      cy: H / 2,
      rw: 88,
      rh: 16,
      degrees: 8,
    });
    const decision = decide(mask);
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("landscape");
  });

  it("逆さまの合成は 180 度反転しない（上下は形状から保証できない）", () => {
    const decision = decide(bottle(180));
    expect(decision.correctionDegrees).toBe(0);
    expect(decision.applied).toBe(false);
  });

  it("円形は自動補正しない", () => {
    const mask = blank();
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if ((x - 32) ** 2 + (y - 64) ** 2 <= 18 ** 2) {
          mask[y * W + x] = 255;
        }
      }
    }
    const decision = decide(mask);
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("round");
  });

  it("同規模の複数物体は自動補正しない", () => {
    const mask = blank();
    paintRotatedRect(mask, W, H, { cx: 18, cy: 64, rw: 12, rh: 70, degrees: 12 });
    paintRotatedRect(mask, W, H, { cx: 46, cy: 64, rw: 12, rh: 70, degrees: -12 });
    const decision = decide(mask);
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("multiple");
  });

  it("上下が欠けた対象は自動補正しない", () => {
    const mask = paintRotatedRect(blank(), W, H, {
      cx: W / 2,
      cy: H / 2,
      rw: 20,
      rh: 140,
      degrees: 10,
    });
    const decision = decide(mask);
    expect(decision.applied).toBe(false);
    expect(["clipped", "too_tilted", "noisy"]).toContain(decision.reason);
  });

  it("散らばったノイズだけでは角度を出さない", () => {
    const mask = blank();
    for (let i = 0; i < mask.length; i += 17) {
      mask[i] = 200;
    }
    const decision = decide(mask);
    expect(decision.applied).toBe(false);
    expect(decision.correctionDegrees).toBe(0);
  });
});
