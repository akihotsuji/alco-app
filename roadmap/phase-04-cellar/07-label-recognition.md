# 4-07 ラベル読み取り（Cloudflare Workers AI）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | ボトル追加時にラベル写真から銘柄名・生産者・産地・年・種類・度数の候補を取得し、空欄に入れる。自動保存はしない |
| ソース | オーナー決定（2026-09-05）: Workers AI の Vision モデルを使う。セラーのみ。Gemini 等は将来の差し替え候補。画面は [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) B2、API は [api-design 4.5.3](../../spec/api-design.md) |

## 1. 概要

`POST /api/bottles/recognize` を実装し、`bottle-new` の写真確定直後に呼んで候補をフォームへ入れる。DB には利用回数（`ai_usage`）以外を書かない。

## 2. 前提条件

- 2-08（`photo-edit`。切り抜く前の 2:3 JPEG を呼び出し元へ渡す）
- 4-02（`bottle-new`）
- `wrangler.jsonc` に Workers AI binding `AI`（dev / production 共通名）

## 3. スコープ

**対象**

- `src/server/services/label-recognizer/`: `LabelRecognizer` インターフェース + `workers-ai.ts` 実装。モデル名は定数（導入時点の Vision 対応・指示追従モデルを公式一覧から選ぶ）
- 固定プロンプト（JSON のみ返す指示 + スキーマ例。日本語 / 英語ラベル対応）
- 出力の Zod 検証（信頼しない入力として扱う。落ちたフィールドは省く）
- `ai_usage` の日次カウントと上限 30 回（429）。失敗時は加算しない。タイムアウト 20 秒（502）
- クライアント: 読み取り帯（読み取り中 / 成功 / 失敗）、空欄にだけ候補を入れる、確度 0.5 未満は捨てる、AI 印、編集で印を消す、詳細の自動展開
- 設定「ラベルを自動で読み取る」（`cellar.recognize`。既定 ON。副文で送信先を明示）
- テスト: 401、日次上限 429、モデル出力が壊れた JSON / 範囲外のときフィールドが省かれる、画像 MIME 検証、`ai_usage` の加算条件

**対象外**

- Gemini / OpenAI 実装（インターフェースだけ用意）
- 記録・ノートでの推定
- 結果の保存・学習

## 4. 成果物

- ルート・サービス・Zod・テスト
- `bottle-new` の読み取り UI
- `wrangler.jsonc` の `ai` binding（秘密ではない）

## 5. 細分化タスク

1. binding 追加と `wrangler types`
2. `LabelRecognizer` と Workers AI 実装、プロンプト
3. Zod 検証と 4.5.3 のレスポンス形
4. `ai_usage`（2-01 で列がなければ migration）と 429
5. クライアント帯 + フォーム反映ルール
6. 設定スイッチ
7. 精度の手元検証（ワイン・ウイスキー・日本酒のラベル各数枚）。弱いフィールドは既定で省く判断
8. テスト、監査

## 6. 手順

```powershell
git fetch origin main
git checkout -b feature/label-recognition origin/main
pnpm cf-typegen
pnpm test; pnpm lint; pnpm typecheck
```

ローカル: `wrangler dev` は Workers AI をリモート実行する（アカウントの枠を消費）。テストではサービスをモックする。

## 7. 仕様詳細

[api-design 4.5.3](../../spec/api-design.md) を正とする。要点:

- 入力: 切り抜く前の 2:3 JPEG（≦1MB、magic bytes）
- 出力: `fields`（各 `value` / `confidence`）、`provider`、`remainingToday`
- サーバーは検証済みの候補だけ返す。クライアントは空欄にだけ入れる
- ログは件数・所要時間・成否のみ。画像・出力テキストを出さない

## 8. 受け入れ条件

- [ ] 実機で撮影 → 数秒で候補が空欄に入り、AI 印が付く。編集で印が消える
- [ ] 失敗・上限・設定 OFF のいずれでもフォームはそのまま使える
- [ ] 他人 / 未認証は 401。日次 31 回目は 429
- [ ] モデル出力を Zod で検証し、壊れた出力でも 200 で空 `fields`（テスト）
- [ ] [04-cellar.md](../../spec/screen-designs/04-cellar.md) の該当受け入れチェック
- [ ] DoD 5 項

## 9. セキュリティ観点

- 認証必須。公開エンドポイントにしない
- プロンプトにユーザー入力を含めない（画像のみ）。出力は信頼しない入力として Zod で検証し、文字数・enum・範囲で切る
- 上限で無料枠と濫用を抑える。`ai_usage` はセッション `user.id` でスコープ
- 画像・結果・プロンプトを保存・ログしない。Cloudflare 外に送らない（外部 API を足すときは spec 更新と承認）

## 10. 関連ファイル / 関連spec

- [spec/api-design.md](../../spec/api-design.md) 4.5.3
- [spec/data-model.md](../../spec/data-model.md) 6.6 `ai_usage`
- [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md)、[06-settings.md](../../spec/screen-designs/06-settings.md)
- [spec/02-tech-stack.md](../../spec/02-tech-stack.md) ラベル読み取り
- Cloudflare: [Workers AI](https://developers.cloudflare.com/workers-ai/)

## 11. リスク・注意点

- モデルの精度・出力の安定性は導入時点で要確認。JSON が崩れる前提で検証を書く
- 無料枠（日次 Neurons）はモデルによって消費が違う。上限 30 回は初期値で、使用量を見て調整
- ラベルが小さい・手書き風だと読めない。失敗を「普通のこと」として UI に組み込む（帯の文言）
