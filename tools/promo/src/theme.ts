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
