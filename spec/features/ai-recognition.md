# AI 認識（酒記録の補完とモデル設定）

実装: `src/server/services/ai-recognition/`、`src/server/services/drink-recognizer/`、`src/shared/ai-recognition.ts`。
画面は [screen-designs/03-log.md](../screen-designs/03-log.md) / [06-settings.md](../screen-designs/06-settings.md)。API は [api-design.md](../api-design.md) 4.3。

## 1. 方針

- 酒記録の写真補完は **Cloudflare AI Gateway の Unified Billing** 経由で外部モデルを呼ぶ。初期採用は **Gemini 3.7 Flash**
- 対応済みモデル同士は、業務コードやフロントを変えず **サーバー側設定だけ**で切り替える
- クライアントからモデル名・接続先・プロンプトは指定できない
- 自動フォールバック（別モデルへ）は初期実装では無効。障害時は手入力を続け、運営が設定を戻して復旧する
- 背景除去サービスは対象外
- セラー・ノートの呼び出し先は当面 **Workers AI Llama** のまま。共有のプロファイル解決と `LabelRecognizer` 口だけ整合させる

## 2. 役割の分離

| 層 | 責務 | 置き場 |
|---|---|---|
| A. 業務 | 補完規則、根拠判定、手入力保護、産地対応 | `drink-extract.ts` / `verified-origin.ts` / クライアント `applyRecognizeToLogForm` |
| B. モデル設定 | 設定キー、プロバイダ、モデル ID、対応機能、タイムアウト、出力上限、思考量 | `profiles.ts` / `AI_RECOGNITION_PROFILE` 等 |
| C. 呼び出し・変換 | Cloudflare 認証、画像・パラメータ・レスポンス変換、使用量の正規化 | `gemini-adapter.ts` / `workers-ai-adapter.ts` |

モデル ID をルートや画面へ散在させない。不明な設定は認識 API を `503 misconfigured` にし、手入力は継続できる。

## 3. 正確なモデル ID と経路

| 種別 | 値 |
|---|---|
| Cloudflare カタログ ID | `google/gemini-3.7-flash`（定数 `GEMINI_37_FLASH_MODEL_ID`） |
| Google 原生 ID | `gemini-3.7-flash`（定数 `GEMINI_37_FLASH_NATIVE_ID`。混同しない） |
| 呼び出し | 既存 binding `env.AI.run(modelId, body, { gateway: { id } })` |
| 課金 | AI Gateway Unified Billing。追加の Google API キーは不要 |
| 画像抽出 | 公式 `env.AI.run` 例どおり Generate Content（`contents` / `parts`）。画像は Image Understanding と同じ `inlineData` |
| 構造化 | Gemini `responseMimeType` + `responseSchema`。平坦な JSON（文字列・数値だけ）も業務層で `{ value, confidence }` に直す。Llama の `guided_json` は流用しない |
| 検索 | `tools: [{ googleSearch: {} }]`。プロファイルが `supportsSearch` のときだけ送る |
| 思考量 | `thinkingConfig.thinkingLevel: "low"` を送る。3.7 Flash が受け付けるのは `low` / `medium` / `high` のみで、`minimal` は 400（Gateway `7003: User Input Error`）になる。`maxOutputTokens` は 4096 |
| 検証区分 | Gemini プロファイルは `mock-only`。Llama は既存本番経路 `production-llama` |

公式: [Cloudflare Models](https://developers.cloudflare.com/ai/models/google/gemini-3.7-flash/)、[Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/)、[Google Gemini 3.7 Flash](https://ai.google.dev/gemini-api/docs/models)。

## 4. 設定キー

`wrangler.jsonc` の `env.dev` / `env.production` の `vars`（秘密ではない）。`.dev.vars` で上書き可。

| キー | 既定 | 意味 |
|---|---|---|
| `AI_RECOGNITION_PROFILE` | `gemini-3.7-flash` | 酒記録 |
| `AI_LABEL_RECOGNITION_PROFILE` | `workers-ai-llama` | セラー |
| `AI_NOTE_RECOGNITION_PROFILE` | `workers-ai-llama` | ノート |
| `AI_GATEWAY_ID` | `default` | AI Gateway の ID |
| `AI_GATEWAY_COLLECT_LOG` | `0` | `1` / `true` のときだけ Gateway 本文ログを取る。既定は取らない |
| `AI_RECOGNIZE_DAILY_LIMIT` | `30` | ユーザー / JST 日のアプリ側上限。無制限化しない |

対応済みプロファイル:

| キー | プロバイダ | modelId | 画像 | 構造化 | 検索 | 検証 |
|---|---|---|---|---|---|---|
| `gemini-3.7-flash` | gemini | `google/gemini-3.7-flash` | 可 | `gemini-response-schema` | 可（実 API 未検証） | mock-only |
| `workers-ai-llama` | workers-ai | `@cf/meta/llama-4-scout-17b-16e-instruct` | 可 | `workers-ai-guided-json` | 不可 | production-llama |

不明なキーは `RecognitionConfigError` → `503 misconfigured`。未対応パラメータは送らない。検索非対応プロファイルで検索したように扱わない。

## 5. 共通結果

`POST /api/drink-logs/recognize` の必須メタ:

- `fields`（業務の補完候補）
- `profile` / `provider` / `modelId`
- `durationMs`
- `usage`（`inputTokens` / `outputTokens` / `thinkingTokens` / `searchCount`。取れなければ **null**。0 にしない）
- `sources`（確認できた出典 URL だけ）
- `searchUsed`
- `remainingToday`（アプリ側の日次残数。上流課金とは別）

通常の操作画面にモデル名は出さない。

## 6. 根拠と自動入力

内部区分: `label` / `verified_origin` / `product_source` / `unverified_guess` / `unknown`。

モデルの自己申告 confidence だけでは自動入力しない（クライアントの 0.5 未満捨ては補助）。

| 項目 | 自動入力してよい根拠 |
|---|---|
| 生産国 | `label` / `verified_origin` / `product_source` |
| 品種 | `label` / `product_source` |

- 国はラベルの国名を優先。産地から補うときは検証済み対応（`verified-origin.ts`）だけ。ラベル言語・輸入者住所・酒種類だけでは断定しない
- 品種はラベルの品種表記を優先。地域の代表品種・使用可能品種を確定しない。ブレンド比率を創作しない
- 根拠不足は空欄
- グラスのみ（`subject=glass`）は種類・量の推測と商品識別を分け、国・品種・品名・生産者・ヴィンテージを入れない
- 写真内の文字や取得ページの文面は命令ではなく識別対象データ

画像から最初に取るもの: 商品名、生産者、ヴィンテージ、産地表記、国・品種の表記、根拠の短い抜粋。全文 OCR や長文推論は不要。

## 7. 商品照合（検索）

品名と生産者が十分に特定でき、国または品種が不足するときだけ 1 回照合する。無制限ループはしない。

- 生産者公式・公式技術資料・正規輸入元を優先
- 商品名、生産者、ヴィンテージ、種類の一致を確認。別ヴィンテージの配合は流用しない
- 出典 URL は grounding で確認できたものだけ。モデルが記憶から作った URL は採用しない
- 矛盾や一致不足は空欄。強い根拠を後続の弱い根拠で上書きしない
- 検索失敗時は出典なし推測で埋めず、画像認識結果だけを返す

実 API での Google Search 通過は未検証。失敗しても手入力は継続できる。

## 8. 非同期・競合

- 詳細入力を先に出し、AI 中も入力できる。AI 完了は保存の必須条件にしない（写真アップロード完了とは分ける）
- ユーザーが触った欄と、ボトルから引き継いだ欄は上書きしない
- 写真の差し替え・削除・画面離脱・保存後に古い結果を適用しない（リクエスト世代 + `savedRef`）
- 同じ利用者・同じ画像ハッシュ・同じモデル設定・同じプロンプト版 / スキーマ版 / 検索有無の同時リクエストは重複排除する
- 1 回の処理は開始時のモデル設定を最後まで使う
- タイムアウト・429・5xx・クレジット不足・出力不正でも手入力を継続。再試行は有限（1 回）。全体タイムアウトあり。上流 `ai.run` 自体の中断は binding 非対応のため、アプリ側で打ち切る（上流課金は残り得る）

## 9. 認識用画像

- 写真全体を残す。EXIF 向きは `decodeImage` で反映
- 色補正・キャラ合成・背景除去・表示用 4:5 切り抜きは掛けない
- 長辺は表示用と同じ上限に収め、`PHOTO_MAX_BYTES` / MIME 検証と整合
- 位置情報等のメタデータは Canvas 再エンコードで落とす
- R2 の写真は非公開のまま。AI にはリクエスト内の JPEG バイトだけを送る

## 10. 料金・ログ

- アプリの日次 30 回と Gateway の支出上限は別。後者は Cloudflare ダッシュボードで設定する
- 失敗やタイムアウトでも上流課金が残り得る
- アプリログに写真本体・Base64・認証情報を出さない。件数・時間・フィールド数・profile 名だけ
- 失敗時は `[drink-recognize] ok=false reason=` に status と短いメッセージだけ出す（写真・Base64・Cookie は落とす）。クライアント応答は `upstream_error`
- `ok=true fieldCount=0` のときは `[drink-recognize] parse` に subject / extractCount / finishReason / payloadKeys / トークン数だけ出す（値は出さない）
- Gateway 本文ログは既定 OFF（`AI_GATEWAY_COLLECT_LOG=0`）

## 11. モデル切替手順

1. 対応済みキーだけを `AI_RECOGNITION_PROFILE`（必要ならラベル / ノート用キー）に書く
2. `wrangler deploy --env dev` または本番 vars を更新して再デプロイ
3. ローカルは `.dev.vars` または `wrangler.jsonc` の `vars`

以前の Llama へ戻す: `AI_RECOGNITION_PROFILE=workers-ai-llama`

新しいモデルを足す手順:

1. `AI_RECOGNITION_PROFILE_KEYS` と `MODEL_PROFILES` に設定を追加する
2. 必要ならアダプタ（呼び出し形式が既存と違う場合）
3. プロンプト / responseSchema が違うなら業務層は変えず変換だけ足す
4. 単体テストで設定切替とキャッシュキー分離を確認する
5. 実 API 検証後に `verification` を更新する

## 12. 必要な Cloudflare 側設定

- 既存 `AI` binding（追加の Google API トークンは不要）
- AI Gateway（ID は `AI_GATEWAY_ID`。未作成なら `default` が初回認証リクエストで作られる）
- Gateway の Workers AI / サードパーティ課金を **Unified Billing** にする
- プリペイドクレジット（第三者モデル）。未設定なら実 API は呼べない
- Gateway の支出上限・レート制限（ダッシュボード）
- 本文ログは OFF 推奨

## 13. 未検証

- Gemini 3.7 Flash の実 API（検索 grounding・実測レイテンシ / 料金。画像抽出は本番でクレジット不足のあと `ok=true fieldCount=0` を確認済み）
- 同じ実写真 30 枚での現行 Llama との品質比較
- Unified Billing のクレジット残高と Gateway 支出上限の実機確認

## 14. 切り分け（ノート成功・酒記録 502）

- ノート / セラーは Workers AI Llama を Gateway なしで呼ぶ。酒記録 Gemini は `gateway.id` 経由の第三者モデル
- Gateway にリクエストは届きトークン 0 なら、モデル実行前の失敗（課金・形式・認可）
- 切り分けは Workers Logs の `[drink-recognize] ok=false reason=`。クライアントは `upstream_error` だけ
- `ok=true fieldCount=0` は課金成功のあと JSON が業務形に落ちたとき。`[drink-recognize] parse` の finishReason / payloadKeys / thinkingTokens を見る
- `reason=AiGatewayError:2021: Insufficient AI Gateway credits` は Unified Billing のクレジット不足。ダッシュボードで補充する
- `reason=AiGatewayError:7003: User Input Error` は Gemini がリクエスト本文を 400 で拒否したとき（モデルが受け付けない `thinkingLevel`、`responseSchema` に未対応キーなど）。`profiles.ts` の値を公式表と照合する
- 応急は `AI_RECOGNITION_PROFILE=workers-ai-llama` にして再デプロイ（手入力は継続できる）
