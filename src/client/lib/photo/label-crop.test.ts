import { describe, expect, it } from "vitest";
import { findLabelRect, luminanceFromRgba, rectToPixels } from "./label-crop.ts";

const W = 100;
const H = 150;

type Label = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  paper: number;
  /** 文字（横線）を何行おきに入れるか */
  textEvery?: number;
  /** 文字の輝度。既定は暗い文字 */
  ink?: number;
};

type Scene = {
  background: number;
  glass: number;
  label?: Omit<Label, "textEvery" | "ink">;
  /** ラベル上の文字（暗い横線）を何行おきに入れるか */
  textEvery?: number;
  /** `label` の上に重ねて貼るラベル（裏面の輸入者シール・暗い地の本ラベルなど） */
  labels?: Label[];
  neck?: boolean;
};

function paint(label: Label, x: number, y: number): number | null {
  if (y < label.top || y > label.bottom || x < label.left || x > label.right) {
    return null;
  }
  const text = label.textEvery && y % label.textEvery === 0 && x > label.left + 4;
  return text ? (label.ink ?? 40) : label.paper;
}

/** 瓶（胴 x 30..69・y 40..145、首 x 44..55・y 5..39）の合成画像 */
function scene(input: Scene) {
  const luminance = new Uint8Array(W * H).fill(input.background);
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const body = y >= 40 && y <= 145 && x >= 30 && x <= 69;
      const neck = input.neck !== false && y >= 5 && y < 40 && x >= 44 && x <= 55;
      if (!body && !neck) {
        continue;
      }
      const index = y * W + x;
      mask[index] = 255;
      luminance[index] = input.glass;
      const layers = [
        ...(input.label ? [{ ...input.label, textEvery: input.textEvery }] : []),
        ...(input.labels ?? []),
      ];
      for (const layer of layers) {
        luminance[index] = paint(layer, x, y) ?? luminance[index] ?? 0;
      }
    }
  }
  return { luminance, mask, width: W, height: H };
}

function toPixels(rect: { x: number; y: number; w: number; h: number }) {
  return {
    left: Math.round(rect.x * W),
    top: Math.round(rect.y * H),
    right: Math.round((rect.x + rect.w) * W) - 1,
    bottom: Math.round((rect.y + rect.h) * H) - 1,
  };
}

describe("findLabelRect", () => {
  it("暗い瓶の上の白いラベルだけを切り出す（背景が明るくても瓶の外は見ない）", () => {
    const result = findLabelRect(
      scene({
        background: 225,
        glass: 35,
        label: { top: 80, bottom: 125, left: 30, right: 69, paper: 235 },
        textEvery: 6,
      }),
    );
    expect(result?.source).toBe("label");
    const box = toPixels(result?.rect ?? { x: 0, y: 0, w: 0, h: 0 });
    expect(box.top).toBeGreaterThanOrEqual(74);
    expect(box.top).toBeLessThanOrEqual(80);
    expect(box.bottom).toBeGreaterThanOrEqual(125);
    expect(box.bottom).toBeLessThanOrEqual(131);
    expect(box.left).toBeGreaterThanOrEqual(28);
    expect(box.right).toBeLessThanOrEqual(71);
  });

  it("首の小さなラベルより胴のラベルを選ぶ", () => {
    const withNeckLabel = scene({
      background: 200,
      glass: 30,
      label: { top: 90, bottom: 130, left: 32, right: 67, paper: 230 },
    });
    for (let y = 15; y <= 30; y += 1) {
      for (let x = 44; x <= 55; x += 1) {
        withNeckLabel.luminance[y * W + x] = 240;
      }
    }
    const result = findLabelRect(withNeckLabel);
    expect(result?.source).toBe("label");
    expect(toPixels(result?.rect ?? { x: 0, y: 0, w: 0, h: 0 }).top).toBeGreaterThan(80);
  });

  it("白いシールの下に続く暗い地・白文字のラベルも含めて切り出す", () => {
    const result = findLabelRect(
      scene({
        background: 225,
        glass: 30,
        labels: [
          { top: 50, bottom: 68, left: 36, right: 63, paper: 235, textEvery: 5 },
          { top: 70, bottom: 132, left: 32, right: 67, paper: 75, textEvery: 8, ink: 225 },
        ],
      }),
    );
    expect(result?.source).toBe("label");
    const box = toPixels(result?.rect ?? { x: 0, y: 0, w: 0, h: 0 });
    expect(box.top).toBeGreaterThanOrEqual(42);
    expect(box.top).toBeLessThanOrEqual(50);
    expect(box.bottom).toBeGreaterThanOrEqual(132);
    expect(box.bottom).toBeLessThanOrEqual(140);
    expect(box.left).toBeLessThanOrEqual(32);
    expect(box.right).toBeGreaterThanOrEqual(67);
  });

  it("ガラスをはさんで離れて貼られた 2 枚のラベルを両方含める", () => {
    const result = findLabelRect(
      scene({
        background: 225,
        glass: 30,
        labels: [
          { top: 48, bottom: 70, left: 34, right: 65, paper: 235, textEvery: 6 },
          { top: 95, bottom: 130, left: 30, right: 69, paper: 230, textEvery: 6 },
        ],
      }),
    );
    expect(result?.source).toBe("label");
    const box = toPixels(result?.rect ?? { x: 0, y: 0, w: 0, h: 0 });
    expect(box.top).toBeLessThanOrEqual(48);
    expect(box.bottom).toBeGreaterThanOrEqual(130);
    expect(box.bottom).toBeLessThanOrEqual(138);
  });

  it("中間の明るさのガラス（緑瓶など）では瓶全体でなく白いラベルだけを切り出す", () => {
    const result = findLabelRect(
      scene({
        background: 225,
        glass: 95,
        label: { top: 85, bottom: 125, left: 30, right: 69, paper: 235 },
        textEvery: 6,
      }),
    );
    expect(result?.source).toBe("label");
    const box = toPixels(result?.rect ?? { x: 0, y: 0, w: 0, h: 0 });
    expect(box.top).toBeGreaterThanOrEqual(78);
    expect(box.bottom).toBeLessThanOrEqual(131);
  });

  it("ラベルと瓶の明暗差が小さいときは瓶の外接矩形で代用する", () => {
    const result = findLabelRect(
      scene({
        background: 240,
        glass: 180,
        label: { top: 80, bottom: 125, left: 30, right: 69, paper: 200 },
      }),
    );
    expect(result?.source).toBe("bottle");
    const box = toPixels(result?.rect ?? { x: 0, y: 0, w: 0, h: 0 });
    expect(box.top).toBeLessThanOrEqual(5);
    expect(box.bottom).toBeGreaterThanOrEqual(145);
  });

  it("細すぎる明るい帯（映り込み）はラベルにしない", () => {
    const result = findLabelRect(
      scene({
        background: 220,
        glass: 30,
        label: { top: 40, bottom: 145, left: 60, right: 64, paper: 250 },
      }),
    );
    expect(result?.source).toBe("bottle");
  });

  it("瓶のマスクがほとんど無いときは null（呼び出し側が中央 2:3 に戻す）", () => {
    const luminance = new Uint8Array(W * H).fill(120);
    const mask = new Uint8Array(W * H);
    mask[0] = 255;
    expect(findLabelRect({ luminance, mask, width: W, height: H })).toBeNull();
  });
});

describe("luminanceFromRgba / rectToPixels", () => {
  it("RGBA から輝度を作る", () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]);
    expect([...luminanceFromRgba(rgba, 3)]).toEqual([255, 0, 76]);
  });

  it("正規化矩形を元画像の範囲に収めた画素矩形にする", () => {
    expect(rectToPixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.5 }, 1000, 2000)).toEqual({
      sx: 250,
      sy: 1000,
      sw: 500,
      sh: 1000,
    });
    expect(rectToPixels({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, 100, 100)).toEqual({
      sx: 90,
      sy: 90,
      sw: 10,
      sh: 10,
    });
  });
});
