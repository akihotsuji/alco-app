/**
 * JS 側でタイマーに使うモーション時間（ms）。CSS の `--dur-*` と同じ値で、
 * `design-tokens.test.ts` が styles.css との一致を確認する。演出そのものは CSS が担い、
 * ここは「退場後に unmount する」「1 回演出の終わりを待つ」ためだけに使う。
 */
export const MOTION_MS = {
  press: 90,
  release: 160,
  state: 200,
  enter: 240,
  open: 300,
  fill: 400,
  toastIn: 180,
  toastOut: 150,
  stagger: 80,
  highlightHold: 1400,
  highlightFade: 600,
} as const;

/** `Button` / `Chip` の `data-state`。CSS がこれに反応し、React は状態を置くだけ（motion-design 6.7） */
export const MOTION_STATES = ["idle", "pressed", "loading", "success", "error"] as const;

export type MotionState = (typeof MOTION_STATES)[number];
