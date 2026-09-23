/**
 * 裏ラベルの自動切り出し（04-cellar B1b / G2b）。
 * 背景除去と同じ瓶マスクの内側で「明るい紙」の塊を探し、ラベルの矩形を返す。
 * ラベルが分離できないとき（透明瓶・暗いラベルなど）は瓶の外接矩形、瓶も取れなければ null。
 */

/** 0..1 に正規化した矩形 */
export type NormalizedRect = { x: number; y: number; w: number; h: number };

export type LabelCropResult = {
  rect: NormalizedRect;
  /** `label` = ラベルを見つけた / `bottle` = 瓶の外接矩形で代用 */
  source: "label" | "bottle";
};

export const LABEL_CROP = {
  /** マスクの前景しきい値（0..255） */
  maskOn: 128,
  /** 瓶が画像に占める最小割合。これ未満は瓶として扱わない */
  minBottleArea: 0.03,
  /** 明暗 2 群の平均輝度差の最小値（0..255）。これ未満はラベルと瓶を分けられない */
  minContrast: 48,
  /** ラベル行: 行内の瓶画素のうち明るい画素の割合 */
  rowBrightRatio: 0.45,
  /** ラベル行: 行の瓶幅が最大幅に対して占める割合（首のラベルより胴のラベルを優先） */
  rowBodyRatio: 0.5,
  /** ラベル列: 選んだ行の範囲で、列内の瓶画素のうち明るい画素の割合 */
  columnBrightRatio: 0.35,
  /** 行の途切れを同じラベルとみなす長さ（瓶の高さに対する割合） */
  gapRatio: 0.03,
  /** ラベルとして採用する最小の高さ・幅（瓶に対する割合） */
  minHeightRatio: 0.08,
  minWidthRatio: 0.3,
  /** 切り出しの余白（瓶の幅・高さに対する割合） */
  padRatio: 0.04,
} as const;

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function otsuThreshold(histogram: Uint32Array, total: number): number {
  let sumAll = 0;
  for (let i = 0; i < 256; i += 1) {
    sumAll += i * (histogram[i] ?? 0);
  }
  let sumBack = 0;
  let weightBack = 0;
  let best = 0;
  let threshold = 127;
  for (let i = 0; i < 256; i += 1) {
    weightBack += histogram[i] ?? 0;
    if (weightBack === 0) {
      continue;
    }
    const weightFore = total - weightBack;
    if (weightFore === 0) {
      break;
    }
    sumBack += i * (histogram[i] ?? 0);
    const meanBack = sumBack / weightBack;
    const meanFore = (sumAll - sumBack) / weightFore;
    const between = weightBack * weightFore * (meanBack - meanFore) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return threshold;
}

function padToRect(box: Box, bottle: Box, width: number, height: number): NormalizedRect {
  const padX = Math.round((bottle.maxX - bottle.minX + 1) * LABEL_CROP.padRatio);
  const padY = Math.round((bottle.maxY - bottle.minY + 1) * LABEL_CROP.padRatio);
  const minX = Math.max(0, box.minX - padX);
  const minY = Math.max(0, box.minY - padY);
  const maxX = Math.min(width - 1, box.maxX + padX);
  const maxY = Math.min(height - 1, box.maxY + padY);
  return {
    x: minX / width,
    y: minY / height,
    w: (maxX - minX + 1) / width,
    h: (maxY - minY + 1) / height,
  };
}

export function findLabelRect(input: {
  luminance: Uint8Array;
  mask: Uint8Array;
  width: number;
  height: number;
}): LabelCropResult | null {
  const { luminance, mask, width, height } = input;
  const bottle: Box = { minX: width, minY: height, maxX: -1, maxY: -1 };
  const histogram = new Uint32Array(256);
  const rowMask = new Uint32Array(height);
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if ((mask[index] ?? 0) < LABEL_CROP.maskOn) {
        continue;
      }
      count += 1;
      rowMask[y] = (rowMask[y] ?? 0) + 1;
      histogram[luminance[index] ?? 0] = (histogram[luminance[index] ?? 0] ?? 0) + 1;
      if (x < bottle.minX) bottle.minX = x;
      if (x > bottle.maxX) bottle.maxX = x;
      if (y < bottle.minY) bottle.minY = y;
      if (y > bottle.maxY) bottle.maxY = y;
    }
  }
  if (count < width * height * LABEL_CROP.minBottleArea) {
    return null;
  }
  const bottleResult: LabelCropResult = {
    rect: padToRect(bottle, bottle, width, height),
    source: "bottle",
  };

  const threshold = otsuThreshold(histogram, count);
  let brightSum = 0;
  let brightCount = 0;
  let darkSum = 0;
  for (let i = 0; i < 256; i += 1) {
    const n = histogram[i] ?? 0;
    if (i > threshold) {
      brightSum += i * n;
      brightCount += n;
    } else {
      darkSum += i * n;
    }
  }
  const darkCount = count - brightCount;
  if (brightCount === 0 || darkCount === 0) {
    return bottleResult;
  }
  if (brightSum / brightCount - darkSum / darkCount < LABEL_CROP.minContrast) {
    return bottleResult;
  }

  const rowBright = new Uint32Array(height);
  for (let y = bottle.minY; y <= bottle.maxY; y += 1) {
    for (let x = bottle.minX; x <= bottle.maxX; x += 1) {
      const index = y * width + x;
      if ((mask[index] ?? 0) >= LABEL_CROP.maskOn && (luminance[index] ?? 0) > threshold) {
        rowBright[y] = (rowBright[y] ?? 0) + 1;
      }
    }
  }
  let widest = 0;
  for (let y = bottle.minY; y <= bottle.maxY; y += 1) {
    widest = Math.max(widest, rowMask[y] ?? 0);
  }
  const isLabelRow = (y: number) => {
    const inRow = rowMask[y] ?? 0;
    return (
      inRow > 0 &&
      inRow >= widest * LABEL_CROP.rowBodyRatio &&
      (rowBright[y] ?? 0) / inRow >= LABEL_CROP.rowBrightRatio
    );
  };

  const bottleHeight = bottle.maxY - bottle.minY + 1;
  const bottleWidth = bottle.maxX - bottle.minX + 1;
  const maxGap = Math.max(2, Math.round(bottleHeight * LABEL_CROP.gapRatio));
  let best: { start: number; end: number; score: number } | null = null;
  let run: { start: number; end: number; score: number } | null = null;
  let gap = 0;
  for (let y = bottle.minY; y <= bottle.maxY + 1; y += 1) {
    if (y <= bottle.maxY && isLabelRow(y)) {
      if (run) {
        run.end = y;
        run.score += rowBright[y] ?? 0;
      } else {
        run = { start: y, end: y, score: rowBright[y] ?? 0 };
      }
      gap = 0;
      continue;
    }
    if (run) {
      gap += 1;
      if (gap > maxGap || y > bottle.maxY) {
        if (!best || run.score > best.score) {
          best = run;
        }
        run = null;
        gap = 0;
      }
    }
  }
  if (!best || best.end - best.start + 1 < bottleHeight * LABEL_CROP.minHeightRatio) {
    return bottleResult;
  }

  let minX = width;
  let maxX = -1;
  for (let x = bottle.minX; x <= bottle.maxX; x += 1) {
    let inColumn = 0;
    let bright = 0;
    for (let y = best.start; y <= best.end; y += 1) {
      const index = y * width + x;
      if ((mask[index] ?? 0) < LABEL_CROP.maskOn) {
        continue;
      }
      inColumn += 1;
      if ((luminance[index] ?? 0) > threshold) {
        bright += 1;
      }
    }
    if (inColumn > 0 && bright / inColumn >= LABEL_CROP.columnBrightRatio) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX < 0 || maxX - minX + 1 < bottleWidth * LABEL_CROP.minWidthRatio) {
    return bottleResult;
  }
  return {
    rect: padToRect({ minX, minY: best.start, maxX, maxY: best.end }, bottle, width, height),
    source: "label",
  };
}

/** RGBA（ImageData.data）から ITU-R BT.601 の輝度（0..255）を作る */
export function luminanceFromRgba(rgba: Uint8ClampedArray, pixels: number): Uint8Array {
  const out = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * 4;
    out[i] = Math.round(
      0.299 * (rgba[offset] ?? 0) +
        0.587 * (rgba[offset + 1] ?? 0) +
        0.114 * (rgba[offset + 2] ?? 0),
    );
  }
  return out;
}

/** 正規化矩形を元画像の画素矩形にする（最低 1px） */
export function rectToPixels(
  rect: NormalizedRect,
  sourceWidth: number,
  sourceHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const sx = Math.max(0, Math.floor(rect.x * sourceWidth));
  const sy = Math.max(0, Math.floor(rect.y * sourceHeight));
  const sw = Math.max(1, Math.min(sourceWidth - sx, Math.round(rect.w * sourceWidth)));
  const sh = Math.max(1, Math.min(sourceHeight - sy, Math.round(rect.h * sourceHeight)));
  return { sx, sy, sw, sh };
}
