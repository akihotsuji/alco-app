# 素材の出典と利用条件

| 素材 | 置き場 | 出典 | 利用 |
|---|---|---|---|
| マスコット 4 ポーズ | `public/mascot/*.svg` | リポジトリ `spec/assets/character/` | プロジェクトオリジナル。名前は付けない。飲酒助長の文言は使わない |
| デモ用ボトル／グラス写真 | `public/fixtures/*.jpg` | 紹介素材用に生成した架空ラベルの静物写真。実在ブランドは使っていない | この紹介素材専用。再生成は親リポジトリの sharp で `generate-fixtures.mjs`。ラベルの西暦は生成画像のまま（例: 20222）で、実在ヴィンテージではない |
| 実画面スクリーンショット | `public/shots/*.png` | ローカル検証環境に架空デモデータを投入し、Playwright で撮影 | 本番の個人情報・認証情報は使っていない。動画・静止画で使っているのは `note-detail` / `photo-edit-cellar` / `cellar` / `notes`。他は撮影ログ用 |
| 書体 | Remotion の `@remotion/google-fonts/NotoSansJP` | [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)（SIL Open Font License 1.1） | 紹介素材のみ。本番アプリはシステムフォントのまま |
| 色 | `src/theme.ts` | `spec/design-system.md` のライトトークン | 背景 `#E6E0D6`、本文 `#2B261F`、主色 `#7A3538` |

## 紹介していないこと

- 写真認識（Gemini / Workers AI）。ローカル撮影では外部 AI を切っているため、動作を確認していない
- ボトルの背景除去。撮影時は切り抜きを OFF にし、長方形写真の実 UI を撮っている
- 共有セラー、料金、性能、利用者数

## 再生成

手順は [README.md](../README.md)。
