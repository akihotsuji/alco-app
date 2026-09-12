# 酒のしおり 紹介素材

初めて見る人向けの縦型紹介動画と紹介画像。制作は Remotion（React + TypeScript）で、本番アプリの依存・ビルドには混ぜない。

公開名称: **酒のしおり**  
公開サイト: https://sake-shiori.com

絵コンテ: [docs/storyboard.md](docs/storyboard.md)  
素材出典: [docs/assets.md](docs/assets.md)

## 成果物

| 種類 | コマンド | 出力 |
|---|---|---|
| 縦型動画 1080×1920 / 30fps / 約30秒 / 音声なし H.264 | `pnpm render:video` | `out/sake-shiori-intro.mp4` |
| 紹介画像 1080×1350 × 4 | `pnpm render:stills` | `out/still-overview.png` `out/still-logs.png` `out/still-cellar.png` `out/still-notes.png` |
| 主要シーンの確認フレーム | `pnpm render:preview-frames` | `out/frame-*.png` |
| Remotion Studio | `pnpm preview` | 既定でポート 3000 |

巨大な MP4 は git に入れない。`out/` は gitignore。書き出したファイルは実行環境の成果物添付先へコピーする。

書き出し確認（この環境）:

- `sake-shiori-intro.mp4` — 1080×1920、30fps、30.07秒、H.264、音声ストリームなし、約 1.4MB
- 紹介画像 4 枚（まとめ＋飲酒記録＋セラー＋ノート）— 各 1080×1350 PNG。実画面はヘッダーからタブバーまで枠内に収まっている
- スマホ幅（390px）に縮小しても、見出しとノートの銘柄・感想、エンドの URL は読めた

実画面はショット全体（ヘッダーからタブバーまで）を枠内に収める。切り出しや拡大ではみ出さない。

書き出しに必要な実画面は `public/shots/` の次の 4 枚（コミット済み）:

- `log-day.png`（日別の飲酒記録）
- `log-new.png`（写真からの自動入力）
- `cellar.png`
- `notes.png`

## 再実行

リポジトリルートに `.dev.vars` があること（`.dev.vars.example` をコピーし、`BETTER_AUTH_SECRET` を入れる。値は git に出さない）。

```bash
cd tools/promo
pnpm install

# デモ写真（架空ラベル）を JPEG 化。親リポジトリの sharp を使う
pnpm --dir ../.. exec node tools/promo/scripts/generate-fixtures.mjs

# ローカルアプリへ架空データを投入し、実画面を撮影（任意。shots を取り直すとき）
pnpm --dir ../.. exec playwright install chromium
pnpm capture

# 型チェック
pnpm typecheck

# プレビュー
pnpm preview

# 書き出し
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

本番サイト `https://sake-shiori.com` はログイン後の PWA として動く。紹介しているのは実装済みの飲酒記録・セラー・テイスティングノートと、写真からの自動入力（実フォーム＋ローカルのデモ応答）。切り抜き、共有セラー、料金、性能、利用実績は出していない。
