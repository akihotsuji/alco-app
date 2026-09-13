export const colors = {
  background: "#E6E0D6",
  foreground: "#2B261F",
  muted: "#5C564C",
  primary: "#7A3538",
  primaryFg: "#FFF8F4",
  neuDark: "#C9C2B6",
  mascotWine: "#8E2F3C",
} as const;

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const STILL_WIDTH = 1080;
export const STILL_HEIGHT = 1350;
export const FPS = 30;

/** Playwright 実画面ショット（Pixel 7 / DPR 3） */
export const SHOT_WIDTH = 1236;
export const SHOT_HEIGHT = 2517;
export const SHOT_ASPECT = SHOT_WIDTH / SHOT_HEIGHT;

export type ShotBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** ショット全体が枠に収まるサイズ。切り出しはしない */
export function fitShot(maxWidth: number, maxHeight: number): { width: number; height: number } {
  const width = Math.round(maxWidth);
  const heightIfFullWidth = Math.round(width / SHOT_ASPECT);
  if (heightIfFullWidth <= maxHeight) {
    return { width, height: heightIfFullWidth };
  }
  const height = Math.round(maxHeight);
  return { width: Math.round(height * SHOT_ASPECT), height };
}

/** 指定ボックス内にショット全体を置く。既定は上揃え・水平中央 */
export function placeShot(box: ShotBox, align: "top" | "center" = "top"): ShotBox {
  const size = fitShot(box.width, box.height);
  return {
    left: Math.round(box.left + (box.width - size.width) / 2),
    top: align === "top" ? Math.round(box.top) : Math.round(box.top + (box.height - size.height) / 2),
    width: size.width,
    height: size.height,
  };
}

/** SNS の操作表示を避けて、重要な文字を端に置かない */
export const safe = {
  videoTop: 220,
  videoBottom: 200,
  videoSide: 72,
  stillTop: 72,
  stillBottom: 64,
  stillSide: 64,
} as const;

export const shadow = "10px 14px 28px #C9C2B6, -8px -8px 20px rgba(255,255,255,0.72)";
