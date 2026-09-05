/**
 * design-system トークンと shadcn / Tailwind の対応表。
 * 実行時の値は `src/client/styles.css` の CSS 変数が正。ここは契約の文書化。
 *
 * | design-system | shadcn / @theme | 用途 |
 * |---|---|---|
 * | --background / --surface | background / card / popover | 地・カード。白い別面は置かない |
 * | --foreground | foreground / card-foreground | 本文 |
 * | --muted | muted-foreground | 補助テキスト |
 * | --primary | primary | 主ボタン・選択 |
 * | --primary-fg | primary-foreground | 主ボタン上の文字 |
 * | --danger | destructive | 削除・ログアウト確認 |
 * | --danger-fg | destructive-foreground | 危険ボタン上の文字 |
 * | --rest / --score | rest / score（独自） | 休肝ピル・スコア |
 * | --ring | ring | フォーカス 2px |
 * | --radius | --radius-md | ボタン・入力 16px |
 * | --radius-card | --radius-lg | カード 24px |
 * | --shadow-* | @utility shadow-* | 変数経由。ダークは prefers-color-scheme |
 * | border | transparent | 境界は影だけ |
 */
export const SHADCN_TOKEN_MAP = {
  background: "--background",
  card: "--background",
  foreground: "--foreground",
  primary: "--primary",
  "primary-foreground": "--primary-fg",
  destructive: "--danger",
  "destructive-foreground": "--danger-fg",
  "muted-foreground": "--muted",
  ring: "--ring",
  radius: "--radius",
} as const;

export const LIGHT_COLOR_TOKENS = {
  "--background": "#e6e0d6",
  "--surface": "#e6e0d6",
  "--foreground": "#2b261f",
  "--muted": "#5c564c",
  "--primary": "#7a3538",
  "--primary-fg": "#fff8f4",
  "--danger": "#8b1e1e",
  "--danger-fg": "#fff8f4",
  "--rest": "#2f5d3e",
  "--score": "#7a3538",
  "--ring": "#7a3538",
  "--neu-light": "rgba(255, 255, 255, 0.8)",
  "--neu-dark": "#c9c2b6",
  "--mascot-wine": "#8e2f3c",
  "--mascot-wine-light": "#b34a5a",
  "--mascot-ink": "#1f1b17",
} as const;

export const DARK_COLOR_TOKENS = {
  "--background": "#2c2926",
  "--surface": "#2c2926",
  "--foreground": "#f4ede4",
  "--muted": "#c9bdb0",
  "--primary": "#c47878",
  "--primary-fg": "#2a1818",
  "--danger": "#e07070",
  "--danger-fg": "#2a1818",
  "--rest": "#8fcb9e",
  "--score": "#c47878",
  "--ring": "#c47878",
  "--neu-light": "#3a3632",
  "--neu-dark": "#1a1816",
} as const;
