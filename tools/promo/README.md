# 酒のしおり 紹介素材

初めて見る人向けの縦型紹介動画と紹介画像。制作は Remotion（React + TypeScript）で、本番アプリの依存・ビルドには混ぜない。

公開名称: **酒のしおり**  
公開サイト: https://sake-shiori.com

## 成果物

| 種類 | コマンド | 出力 |
|---|---|---|
| 縦型動画 1080×1920 / 30fps / 約30秒 / 音声なし | `pnpm render:video` | `out/sake-shiori-intro.mp4` |
| 紹介画像 1080×1350 × 3 | `pnpm render:stills` | `out/still-overview.png` ほか |
| 主要シーンの確認フレーム | `pnpm render:preview-frames` | `out/frame-*.png` |

巨大な MP4 は git に入れない。書き出しは `out/`（gitignore）と、エージェント実行時の成果物添付先を使う。

## 再実行

リポジトリルートで `.dev.vars` があること（`.dev.vars.example` をコピーし、`BETTER_AUTH_SECRET` を入れる。値は git に出さない）。

```bash
# 1. デモ写真（架空ラベル）を JPEG 化
cd tools/promo
node ../../node_modules/sharp/lib/index.js >/dev/null 2>&1 || true
pnpm --dir ../.. exec node tools/promo/scripts/generate-fixtures.mjs

# 2. ローカルアプリへ架空データを投入し、実画面を撮影
pnpm --dir ../.. exec playwright install chromium
pnpm capture

# 3. Remotion 依存
pnpm install

# 4. プレビュー（Studio）
pnpm preview
# http://localhost:3000/IntroVideo など

# 5. 書き出し
pnpm render:preview-frames
pnpm render:stills
pnpm render:video
```

撮影は毎回サインアップする。本番 DB・本番認証は触らない。`CLOUDFLARE_VITE_FORCE_LOCAL=true` で外部 AI プロキシを切る。

## 構成

```
tools/promo/
  src/                 Remotion コンポジション
  scripts/capture.spec.ts
  public/fixtures/     デモ写真
  public/shots/        実画面スクリーンショット
  public/mascot/       仕様の SVG
  docs/storyboard.md   絵コンテとコピー
  docs/assets.md       出典
```

## 確認した公開機能

本番サイト `https://sake-shiori.com` はログイン後の PWA として動く。紹介しているのは実装済みの記録・セラー・ノート。AI 読み取り、切り抜き、共有セラー、料金、性能、利用実績は出していない。
