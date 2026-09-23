/**
 * 裏ラベルの自動切り出し（04-cellar B1b / G2b）。
 * 背景除去と同じ瓶マスクの内側で「明るい紙」または「印刷（文字・罫線）のある面」を探し、
 * ラベルの矩形を返す。暗い地に白文字のラベルや、輸入者シールと本ラベルが並ぶ裏面も 1 枚に含める。
 * ラベルが分離できないとき（透明瓶・無地の暗いラベルなど）は瓶の外接矩形、瓶も取れなければ null。
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
  /** 印刷（文字・罫線）とみなす上下または左右の輝度差（0..255）。ガラスの映り込みはこれより緩い */
  printEdge: 40,
  /** 輝度差を比べる距離（画素）。縮小でぼけた文字の輪郭も拾う */
  printStep: 2,
  /** 印刷の間の地をラベル面として埋める半径（画素。クロージングの窓は 2r+1） */
  printRadius: 4,
  /** ラベル行: 行内の瓶画素のうちラベル面（明るい紙・印刷面）の割合 */
  rowSurfaceRatio: 0.45,
  /** ラベル行: 行の瓶幅が最大幅に対して占める割合（首のラベルより胴のラベルを優先） */
  rowBodyRatio: 0.5,
  /** ラベル列: 選んだ行の範囲で、列内の瓶画素のうちラベル面の割合 */
  columnSurfaceRatio: 0.35,
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

function integral(bits: Uint8Array, width: number, height: number): Uint32Array {
  const stride = width + 1;
  const out = new Uint32Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += bits[y * width + x] ?? 0;
      out[(y + 1) * stride + x + 1] = (out[y * stride + x + 1] ?? 0) + rowSum;
    }
  }
  return out;
}

/** (x, y) を中心とする半径 r の窓（画像内に切り詰め）の合計と画素数 */
function windowSum(
  table: Uint32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  r: number,
): { sum: number; area: number } {
  const stride = width + 1;
  const x0 = Math.max(0, x - r);
  const y0 = Math.max(0, y - r);
  const x1 = Math.min(width, x + r + 1);
  const y1 = Math.min(height, y + r + 1);
  const sum =
    (table[y1 * stride + x1] ?? 0) -
    (table[y0 * stride + x1] ?? 0) -
    (table[y1 * stride + x0] ?? 0) +
    (table[y0 * stride + x0] ?? 0);
  return { sum, area: (x1 - x0) * (y1 - y0) };
}

/**
 * 瓶の内側でラベル面とみなす画素（1）。明るい紙か、印刷の輪郭（隣接画素の輝度差）を種にし、
 * クロージングで文字の間の地を埋める。暗い地に白文字のラベルもここで面になる。
 */
function labelSurface(
  luminance: Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): Uint8Array {
  const pixels = width * height;
  const inside = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i += 1) {
    inside[i] = (mask[i] ?? 0) >= LABEL_CROP.maskOn ? 1 : 0;
  }
  const lum = (i: number) => luminance[i] ?? 0;
  const d = LABEL_CROP.printStep;
  // 輪郭の明るい側だけを種にする。暗いガラスとの境目でラベルが外へ太らない
  const brighterThan = (i: number, j: number) =>
    inside[j] === 1 && lum(i) - lum(j) >= LABEL_CROP.printEdge;
  const seed = new Uint8Array(pixels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (!inside[i]) {
        continue;
      }
      if (
        lum(i) > threshold ||
        (x >= d && brighterThan(i, i - d)) ||
        (x < width - d && brighterThan(i, i + d)) ||
        (y >= d && brighterThan(i, i - d * width)) ||
        (y < height - d && brighterThan(i, i + d * width))
      ) {
        seed[i] = 1;
      }
    }
  }

  const r = LABEL_CROP.printRadius;
  const seedTable = integral(seed, width, height);
  // 瓶の外は収縮で削らない（瓶の縁まで貼られたラベルを細らせない）
  const dilated = new Uint8Array(pixels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      dilated[i] = !inside[i] || windowSum(seedTable, width, height, x, y, r).sum > 0 ? 1 : 0;
    }
  }
  const dilatedTable = integral(dilated, width, height);
  const surface = new Uint8Array(pixels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (!inside[i]) {
        continue;
      }
      const { sum, area } = windowSum(dilatedTable, width, height, x, y, r);
      surface[i] = sum === area ? 1 : 0;
    }
  }
  return surface;
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

  const surface = labelSurface(luminance, mask, width, height, threshold);
  const rowSurface = new Uint32Array(height);
  for (let y = bottle.minY; y <= bottle.maxY; y += 1) {
    for (let x = bottle.minX; x <= bottle.maxX; x += 1) {
      rowSurface[y] = (rowSurface[y] ?? 0) + (surface[y * width + x] ?? 0);
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
      (rowSurface[y] ?? 0) / inRow >= LABEL_CROP.rowSurfaceRatio
    );
  };

  const bottleHeight = bottle.maxY - bottle.minY + 1;
  const bottleWidth = bottle.maxX - bottle.minX + 1;
  const maxGap = Math.max(2, Math.round(bottleHeight * LABEL_CROP.gapRatio));
  const minHeight = bottleHeight * LABEL_CROP.minHeightRatio;
  // 裏面は輸入者シールと本ラベルが離れて貼られることがあるので、条件を満たす塊はすべて含める
  const runs: { start: number; end: number }[] = [];
  let run: { start: number; end: number } | null = null;
  let gap = 0;
  for (let y = bottle.minY; y <= bottle.maxY + 1; y += 1) {
    if (y <= bottle.maxY && isLabelRow(y)) {
      if (run) {
        run.end = y;
      } else {
        run = { start: y, end: y };
      }
      gap = 0;
      continue;
    }
    if (run) {
      gap += 1;
      if (gap > maxGap || y > bottle.maxY) {
        if (run.end - run.start + 1 >= minHeight) {
          runs.push(run);
        }
        run = null;
        gap = 0;
      }
    }
  }
  const first = runs[0];
  const last = runs[runs.length - 1];
  if (!first || !last) {
    return bottleResult;
  }

  let minX = width;
  let maxX = -1;
  for (let x = bottle.minX; x <= bottle.maxX; x += 1) {
    let inColumn = 0;
    let onLabel = 0;
    for (const { start, end } of runs) {
      for (let y = start; y <= end; y += 1) {
        const index = y * width + x;
        if ((mask[index] ?? 0) < LABEL_CROP.maskOn) {
          continue;
        }
        inColumn += 1;
        onLabel += surface[index] ?? 0;
      }
    }
    if (inColumn > 0 && onLabel / inColumn >= LABEL_CROP.columnSurfaceRatio) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX < 0 || maxX - minX + 1 < bottleWidth * LABEL_CROP.minWidthRatio) {
    return bottleResult;
  }
  return {
    rect: padToRect({ minX, minY: first.start, maxX, maxY: last.end }, bottle, width, height),
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
