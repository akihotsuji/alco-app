# 素材の出典と利用条件

| 素材 | 置き場 | 出典 | 利用 |
|---|---|---|---|
| マスコット 4 ポーズ | `public/mascot/*.svg` | リポジトリ `spec/assets/character/` | プロジェクトオリジナル。名前は付けない。飲酒助長の文言は使わない。紹介画像では全体が見える余白を取る |
| デモ用ボトル／グラス写真 | `public/fixtures/*.jpg` | 紹介素材用に生成した架空ラベルの静物写真。実在ブランドは使っていない | この紹介素材専用。再生成は親リポジトリの sharp で `generate-fixtures.mjs`。ラベルの西暦は生成画像のまま（例: 20222） |
| 実画面スクリーンショット | `public/shots/*.png` | ローカル検証環境に架空デモデータを投入し、Playwright で撮影 | 本番の個人情報・認証情報は使っていない。動画・静止画で使うのは `log-day` / `log-new` / `cellar` / `notes`。合成時はショット全体を枠内に収め、切り出さない。セラーは 6 本のボトル写真が欠けないこと |
| AI 読み取りの画面 | `public/shots/log-new.png` | 実フォーム。認識 API はローカルで外部 AI を切れないため、デモカタログと同じ候補を Playwright で返す | 別画面の捏造ではない。速度・精度は約束しない |
| 書体 | Remotion の `@remotion/google-fonts/NotoSansJP` | [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)（SIL Open Font License 1.1） | 紹介素材のみ |
| 色 | `src/theme.ts` | `spec/design-system.md` のライトトークン | 背景 `#E6E0D6`、本文 `#2B261F`、主色 `#7A3538` |

## 紹介していないこと

- ボトルの背景除去。撮影時は切り抜きを OFF
- 共有セラー、料金、性能、利用者数
- 本番の Gemini 実応答（ローカルではデモ応答）

## 再生成

手順は [README.md](../README.md)。
