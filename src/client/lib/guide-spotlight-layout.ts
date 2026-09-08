export const GUIDE_HOLE_PAD = 8;
export const GUIDE_TIP_ARROW_HALF = 8;

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

export function holeFromRect(
  rect: { top: number; left: number; width: number; height: number },
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

export function measureGuideTarget(selector: string): GuideHole | null {
  const nodes = [...document.querySelectorAll<HTMLElement>(selector)];
  const candidates = nodes.map((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const hidden =
      style.visibility === "hidden" || style.display === "none" || style.opacity === "0";
    return {
      el,
      className: `${el.className} ${el.closest(".add-fab")?.className ?? ""}`,
      width: hidden ? 0 : rect.width,
      height: hidden ? 0 : rect.height,
      rect,
      radius: style.borderRadius || "var(--radius-card)",
    };
  });
  const picked = pickPreferredGuideTarget(candidates);
  if (!picked) {
    return null;
  }
  return holeFromRect(picked.rect, picked.radius);
}
