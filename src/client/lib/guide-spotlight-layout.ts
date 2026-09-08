export const GUIDE_HOLE_PAD = 8;
export const GUIDE_TIP_ARROW_HALF = 8;
/** 扇が行の上に乗る高さ。設定へ着地したとき「使い方を見る」をこのぶん空ける */
export const GUIDE_FAN_CLEARANCE = 168;

export type GuideHole = {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: string;
};

export type GuideTipLayout = {
  top: number;
  left: number;
  width: number;
  placement: "above" | "below";
  arrowLeft: number;
};

export type GuideTargetCandidate = {
  className: string;
  width: number;
  height: number;
};

export function isGuideTargetVisible(size: { width: number; height: number }): boolean {
  return size.width > 2 && size.height > 2;
}

/** 空状態の主ボタンを FAB より優先する。固定配置の FAB を誤って選ばない */
export function pickPreferredGuideTarget<T extends GuideTargetCandidate>(
  items: readonly T[],
): T | undefined {
  const visible = items.filter((item) => isGuideTargetVisible(item));
  return (
    visible.find((item) => /\bempty-action\b/.test(item.className)) ??
    visible.find((item) => !/\badd-fab\b/.test(item.className)) ??
    visible[0]
  );
}

export type GuideRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function visualViewportOffset(
  view?: {
    offsetTop?: number;
    offsetLeft?: number;
  } | null,
): { top: number; left: number } {
  return {
    top: view?.offsetTop ?? 0,
    left: view?.offsetLeft ?? 0,
  };
}

export function applyViewportOffset(
  rect: GuideRect,
  offset: { top: number; left: number },
): GuideRect {
  return {
    top: rect.top - offset.top,
    left: rect.left - offset.left,
    width: rect.width,
    height: rect.height,
  };
}

export function unionRects(rects: readonly GuideRect[]): GuideRect | null {
  let top = Number.POSITIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.left + rect.width);
    bottom = Math.max(bottom, rect.top + rect.height);
  }
  if (!Number.isFinite(top)) {
    return null;
  }
  return { top, left, width: right - left, height: bottom - top };
}

/** fieldset の legend は border box の外に出る。save-bar は余白がボタンより大きい */
export function shouldMeasureGuideContents(el: { tagName: string; className: string }): boolean {
  return el.tagName === "FIELDSET" || /\bsave-bar\b/.test(el.className);
}

export function needsGuideFanReveal(
  anchor: { top: number; bottom: number },
  visible: { top: number; bottom: number },
  clearance = GUIDE_FAN_CLEARANCE,
): boolean {
  return anchor.top - clearance < visible.top || anchor.bottom > visible.bottom;
}

export function holeFromRect(
  rect: GuideRect,
  radius = "var(--radius-card)",
  pad = GUIDE_HOLE_PAD,
): GuideHole {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    radius,
  };
}

export function guideTipLayout(
  hole: Pick<GuideHole, "top" | "left" | "width" | "height">,
  viewport: { width: number; height: number },
  tip: { width: number; height: number },
): GuideTipLayout {
  const width = Math.min(tip.width, Math.max(160, viewport.width - 32));
  const height = Math.max(tip.height, 1);
  const spaceBelow = viewport.height - (hole.top + hole.height);
  const spaceAbove = hole.top;
  const need = height + 16;
  const placement: "above" | "below" =
    spaceBelow < need && spaceAbove >= spaceBelow ? "above" : "below";
  const rawTop = placement === "above" ? hole.top - height - 12 : hole.top + hole.height + 12;
  const top = Math.max(16, Math.min(rawTop, viewport.height - height - 16));
  const preferRight = hole.left + hole.width / 2 > viewport.width / 2;
  const left = preferRight
    ? Math.max(16, Math.min(hole.left + hole.width - width, viewport.width - 16 - width))
    : Math.max(16, Math.min(hole.left, viewport.width - 16 - width));
  const holeCenter = hole.left + hole.width / 2;
  const arrowLeft = Math.max(16, Math.min(width - 16, holeCenter - left));
  return { top, left, width, placement, arrowLeft };
}

type MeasurableBox = { getBoundingClientRect: () => DOMRect | GuideRect };

function isMeasurable(node: { getBoundingClientRect?: unknown } | null): node is MeasurableBox {
  return node !== null && typeof node.getBoundingClientRect === "function";
}

function rectOf(node: MeasurableBox): GuideRect {
  const rect = node.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function collectGuideMeasureRects(el: HTMLElement): GuideRect[] {
  if (!shouldMeasureGuideContents(el)) {
    return [rectOf(el)];
  }
  const parts: MeasurableBox[] = [];
  const legend = el.querySelector(":scope > legend");
  if (isMeasurable(legend)) {
    parts.push(legend);
  }
  for (const child of el.children) {
    if (child === legend || !isMeasurable(child)) {
      continue;
    }
    parts.push(child);
  }
  const targets = parts.length > 0 ? parts : [el];
  return targets.map(rectOf);
}

export function queryPreferredGuideTarget(selector: string): {
  el: HTMLElement;
  hole: GuideHole;
} | null {
  const nodes = [...document.querySelectorAll<HTMLElement>(selector)];
  const offset = visualViewportOffset(window.visualViewport);
  const candidates = nodes.map((el) => {
    const union = unionRects(
      collectGuideMeasureRects(el).map((rect) => applyViewportOffset(rect, offset)),
    );
    const style = getComputedStyle(el);
    const hidden =
      style.visibility === "hidden" || style.display === "none" || style.opacity === "0";
    return {
      el,
      className: `${el.className} ${el.closest(".add-fab")?.className ?? ""}`,
      width: hidden || !union ? 0 : union.width,
      height: hidden || !union ? 0 : union.height,
      rect: union,
      radius: style.borderRadius || "var(--radius-card)",
    };
  });
  const picked = pickPreferredGuideTarget(candidates);
  if (!picked?.rect) {
    return null;
  }
  return { el: picked.el, hole: holeFromRect(picked.rect, picked.radius) };
}

export function measureGuideTarget(selector: string): GuideHole | null {
  return queryPreferredGuideTarget(selector)?.hole ?? null;
}
