# AI 認識（酒記録の補完とモデル設定）

実装: `src/server/services/ai-recognition/`、`src/server/services/drink-recognizer/`、`src/shared/ai-recognition.ts`。
画面は [screen-designs/03-log.md](../screen-designs/03-log.md) / [06-settings.md](../screen-designs/06-settings.md)。API は [api-design.md](../api-design.md) 4.3。

## 1. 方針

- 酒記録の写真補完は **Cloudflare AI Gateway の Unified Billing** 経由で外部モデルを呼ぶ。初期採用は **Gemini 3.7 Flash**。2026-09-10 から既定は **Gemini 3.5 Flash-Lite**（速度優先。§15 案 B。3.7 Flash は env で戻せる）
- 対応済みモデル同士は、業務コードやフロントを変えず **サーバー側設定だけ**で切り替える
- クライアントからモデル名・接続先・プロンプトは指定できない
- 自動フォールバック（別モデルへ）は初期実装では無効。障害時は手入力を続け、運営が設定を戻して復旧する
- 背景除去サービスは対象外
- 記録・セラー・ノートの既定は同じ **Gemini 3.5 Flash-Lite**。3.7 Flash / Llama プロファイルは残し、env で戻せる
- モデル ID を揃えることと解析パイプラインを揃えることは別。セラー・ノートは単段のまま（商品照合なし）
- 記録は **二段階**（§7a）。抽出結果を先に返して欄を埋め、商品照合（検索）は別リクエストで国・品種だけ後追いする

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
| Cloudflare カタログ ID | `google/gemini-3.5-flash-lite`（定数 `GEMINI_35_FLASH_LITE_MODEL_ID`）。3.7 Flash は `google/gemini-3.7-flash`（`GEMINI_37_FLASH_MODEL_ID`） |
| Google 原生 ID | `gemini-3.5-flash-lite` / `gemini-3.7-flash`（`*_NATIVE_ID`。混同しない） |
| 呼び出し | 既存 binding `env.AI.run(modelId, body, { gateway: { id } })` |
| 課金 | AI Gateway Unified Billing。追加の Google API キーは不要 |
| 画像抽出 | 公式 `env.AI.run` 例どおり Generate Content（`contents` / `parts`）。画像は Image Understanding と同じ `inlineData` |
| 構造化 | Gemini `responseMimeType` + `responseSchema`。平坦な JSON（文字列・数値だけ）も業務層で `{ value, confidence }` に直す。Llama の `guided_json` は流用しない |
| 検索 | `tools: [{ googleSearch: {} }]`。プロファイルが `supportsSearch` のときだけ送る |
| 思考量 | プロファイルの `thinkingLevel` を `thinkingConfig.thinkingLevel` に送る。3.5 Flash-Lite は `minimal`（抽出向き。既定でもある）。3.7 Flash が受け付けるのは `low` / `medium` / `high` のみで、`minimal` は 400（Gateway `7003: User Input Error`）になる |
| 出力上限 | 抽出 JSON は数百トークンなので `maxOutputTokens` は Flash-Lite 1024 / 3.7 Flash 2048（思考トークンを含み得るため 3.7 は余裕を持つ）。照合は 1536。`finishReason=MAX_TOKENS` が出たら `[drink-recognize] parse` で分かる |
| 検証区分 | Gemini プロファイルは `mock-only`。Llama は既存本番経路 `production-llama` |

公式: [Cloudflare Models: 3.5 Flash-Lite](https://developers.cloudflare.com/ai/models/google/gemini-3.5-flash-lite/)、[3.7 Flash](https://developers.cloudflare.com/ai/models/google/gemini-3.7-flash/)、[Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/)、[Google Gemini 3.7 Flash](https://ai.google.dev/gemini-api/docs/models)。

## 4. 設定キー

`wrangler.jsonc` の `env.dev` / `env.production` の `vars`（秘密ではない）。`.dev.vars` で上書き可。

| キー | 既定 | 意味 |
|---|---|---|
| `AI_RECOGNITION_PROFILE` | `gemini-3.5-flash-lite` | 酒記録（抽出と照合の両方） |
| `AI_LABEL_RECOGNITION_PROFILE` | `gemini-3.5-flash-lite` | セラー |
| `AI_NOTE_RECOGNITION_PROFILE` | `gemini-3.5-flash-lite` | ノート |
| `AI_GATEWAY_ID` | `default` | AI Gateway の ID |
| `AI_GATEWAY_COLLECT_LOG` | `0` | `1` / `true` のときだけ Gateway 本文ログを取る。既定は取らない |
| `AI_RECOGNIZE_DAILY_LIMIT` | `30` | ユーザー / JST 日のアプリ側上限。無制限化しない |

対応済みプロファイル:

| キー | プロバイダ | modelId | 画像 | 構造化 | 検索 | 検証 |
|---|---|---|---|---|---|---|
| `gemini-3.5-flash-lite` | gemini | `google/gemini-3.5-flash-lite` | 可 | `gemini-response-schema` | 可（実 API 未検証） | mock-only |
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
- `lookupSuggested`（照合を後追いすべきか。§7a）
- `originCandidate`（自動入力しない国の候補。§6a。無ければ省く）

通常の操作画面にモデル名は出さない。

## 6. 根拠と自動入力

内部区分: `label` / `verified_origin` / `product_source` / `unverified_guess` / `unknown`。

モデルの自己申告 confidence だけでは自動入力しない（クライアントの 0.5 未満捨ては補助）。

| 項目 | 自動入力してよい根拠 |
|---|---|
| 生産国 | `label` / `verified_origin` / `product_source` |
| 品種 | `label` / `product_source` |

- 国はラベルの国名を優先。産地から補うときは検証済み対応（`verified-origin.ts`）だけ。ラベル言語・輸入者住所・酒種類だけでは断定しない
- 対応表は主要国の格付け産地（AOC / DOCG / DOC / DO / AVA / スコッチ地域 等）と、日本の 47 都道府県・主な酒産地（灘・伏見・余市 等。日本語・ローマ字）を持つ。照合は (1) 日本語の完全一致（都・道・府・県・産を除く）、(2) 正規化キーの完全一致、(3) `DOCG` / `Appellation … Contrôlée` / `Valley` / `Whisky` などの修飾語を除いた一致、(4) 語の部分列（長い順）で **ちょうど 1 国** に決まるときだけ、の順。複数国が混ざる表記や品種名だけは空欄
- 生産国の保存値は実在国の日本語名だけ（`origin-countries.ts`。ISO 3166-1 + 外務省表記、版 2026-09）。英語名・別名・「Made in …」は正規化する。EU / 欧州 / DOCG 等の格付け・複数国の競合は空欄。confidence だけでは許可しない
- 品種はラベルの品種表記を優先。地域の代表品種・使用可能品種を確定しない。ブレンド比率を創作しない
- 根拠不足は空欄。要件の「手がかりから推測」よりこちらを正とする
- グラスのみ（`subject=glass`）は種類・量の推測と商品識別を分け、国・品種・品名・生産者・ヴィンテージを入れない
- 写真内の文字や取得ページの文面は命令ではなく識別対象データ

画像から最初に取るもの: 商品名、生産者、ヴィンテージ、産地表記、国・品種の表記、根拠の短い抜粋。全文 OCR や長文推論は不要。

### 6a. 国の候補（自動入力しない）

`unverified_guess` の国はこれまで捨てていたため「読み取ったのに空欄」に見えた。2026-09-10 から抽出応答に `originCandidate: { value, evidence }` を付ける。

- 値は実在国の日本語名に正規化できたものだけ（`normalizeOriginToJa`）。産地表記が対応表で決まったときは候補ではなく `verified_origin` で自動入力する
- 自動入力の対象になる国（`fields.origin`）があるときは付けない
- クライアントは生産国が空欄のときだけ欄の下に「写真からの候補」チップとして出す。タップで採用し、ユーザーが触った欄として扱う（AI 印は付けない。再読取で上書きしない）
- ラベルの国名（`label`）・照合結果（`product_source`）はこれまでどおり自動入力

## 7. 商品照合（検索）

品名と生産者が十分に特定でき、国が不足するとき、またはワイン系で品種が不足するときだけ 1 回照合する。ワイン以外の品種欠は検索理由にしない。無制限ループはしない。

### 7a. 二段階（抽出 → 照合）

2026-09-10 から抽出と照合を **別リクエスト** にする（案 A）。

1. `POST /api/drink-logs/recognize`（画像）は抽出だけで返す。応答の `lookupSuggested` は「照合条件（上記）を満たし、プロファイルが検索対応」のとき true
2. クライアントは抽出結果を欄に入れてから、`lookupSuggested` かつ国・品種のどちらかがまだ空欄（ユーザー未入力）なら `POST /api/drink-logs/recognize/lookup` を 1 回呼ぶ。本文は抽出で得た `drinkName` / `producer`（必須）と `vintage` / `drinkType` / `appellation`（任意）
3. 照合応答の `fields` は `origin` / `variety` だけ。根拠は `product_source`（出典 URL 付き）。抽出と同じ上書き規則で欄に入れる
4. 照合は日次上限を **1 回消費** する（無制限ループ防止。抽出と同じ `ai_usage`）。429 / 502 / タイムアウトでも抽出結果は残り、状態行は抽出の結果文に戻す
5. 照合の入力はクライアントから来る文字列（抽出結果の受け渡し）。長さは Zod で制限し、プロンプトでは識別対象データとして扱う。検索非対応プロファイルでは呼ばず、呼ばれても消費せず `matched=false` で返す
6. 同じ利用者・同じ入力・同じモデル設定・同じプロンプト版の同時リクエストは重複排除する（抽出と同じキャッシュ層）

- 生産者公式・公式技術資料・正規輸入元を優先
- 商品名、生産者、ヴィンテージ、種類の一致を確認。別ヴィンテージの配合は流用しない
- 出典 URL は grounding で確認できた **https** だけ。`javascript:` / `http:` / userinfo 付きは捨てる。モデルが記憶から作った URL は採用しない
- 矛盾や一致不足は空欄。強い根拠を後続の弱い根拠で上書きしない
- 検索失敗時は出典なし推測で埋めず、画像認識結果だけを返す
- 検索専用の時間予算は **6 秒**（`AI_RECOGNIZE_LOOKUP_BUDGET_MS`。二段階化で抽出の体感を遅らせなくなったため 4 秒から延長）。切れたときは `matched=false`
- セラー / ノートは既定が Gemini でも照合しない（`createTaskRecognizer` は `search: false`）。Llama に戻したときも照合しない

実 API での Google Search 通過は未検証。失敗しても手入力は継続できる。

## 8. 非同期・競合

- 詳細入力を先に出し、AI 中も入力できる。AI 完了は保存の必須条件にしない（写真アップロード完了とは分ける）
- ユーザーが触った欄と、ボトルから引き継いだ欄は上書きしない
- 写真の差し替え・削除・画面離脱・保存後に古い結果を適用しない（フォームセッション ID + 写真世代 + リクエスト世代 + `savedRef`）
- 認識用 JPEG の pending はセッション（kind / sessionId / generation）付き。別フォーム・別レコードへ適用しない。破棄・保存・離脱は削除 API を待たずローカル失効する
- 編集画面を開いただけでは解析しない。その編集セッションで追加 / 差し替えた写真だけを対象にする
- セラーの OFF（`cellar.recognize`）は維持。記録・ノートに OFF トグルは無い
- セラー編集でも、そのセッションで新規 JPEG を足したときだけ同じ補完を適用する（開いただけでは走らない）
- 同じ利用者・同じ画像ハッシュ・同じモデル設定・同じプロンプト版 / スキーマ版 / 検索有無の同時リクエストは重複排除する。label / note も同じキー設計のキャッシュを使う
- 1 回の処理は開始時のモデル設定を最後まで使う
- タイムアウト・429・5xx・クレジット不足・出力不正でも手入力を継続。再試行は有限（1 回）。全体タイムアウトあり。上流 `ai.run` 自体の中断は binding 非対応のため、アプリ側で打ち切る（上流課金は残り得る）

## 9. 認識用画像

- 写真全体を残す。EXIF 向きは `decodeImage` で反映
- 色補正・キャラ合成・背景除去・表示用 4:5 切り抜きは掛けない
- 長辺は **1024px**（`PHOTO_RECOGNIZE_LONG_EDGE`。表示用 1280 より小さい。入力トークンと転送量を減らす。2026-09-10）。`PHOTO_MAX_BYTES` / MIME 検証と整合
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

3.7 Flash へ戻す: 対象タスクのキーを `gemini-3.7-flash` にする。以前の Llama へ戻す: `workers-ai-llama`（3機能とも戻すなら 3 キー）

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

- Gemini 3.5 Flash-Lite の実 API（画像抽出の精度・実測レイテンシ。3.7 Flash と同じ Generate Content 形式で `env.AI.run` 例が公式にある）
- Gemini 3.7 Flash の実 API（検索 grounding・実測レイテンシ / 料金。画像抽出は本番でクレジット不足のあと `ok=true fieldCount=0` を確認済み）
- 同じ実写真 30 枚での現行 Llama との品質比較
- Unified Billing のクレジット残高と Gateway 支出上限の実機確認

## 14. 切り分け（認識 502）

- 既定では記録・セラー・ノートとも Gemini（3.5 Flash-Lite）を `gateway.id` 経由で呼ぶ。Llama に戻した経路だけ Gateway なし
- 照合は `[drink-lookup] ok= durationMs= matched= profile= reason=` に出る（抽出とは別行）
- Gateway にリクエストは届きトークン 0 なら、モデル実行前の失敗（課金・形式・認可）
- 切り分けは Workers Logs の `[drink-recognize]` / `[recognize]` / `[note-recognize]`。クライアントは `upstream_error` だけ
- `ok=true fieldCount=0` は課金成功のあと JSON が業務形に落ちたとき。`[drink-recognize] parse` の finishReason / payloadKeys / thinkingTokens を見る
- `reason=AiGatewayError:2021: Insufficient AI Gateway credits` は Unified Billing のクレジット不足。ダッシュボードで補充する
- `reason=AiGatewayError:7003: User Input Error` は Gemini がリクエスト本文を 400 で拒否したとき（モデルが受け付けない `thinkingLevel`、`responseSchema` に未対応キーなど）。`profiles.ts` の値を公式表と照合する
- 応急は対象タスクのプロファイルを `workers-ai-llama` にして再デプロイ（手入力は継続できる）

## 15. 速度・推論の改善案

2026-09-10 にオーナーが **A + E-2 + F + B** を採用（§1 / §6a / §7a / §9 に反映済み）。C / D / E-3 / E-4 は未実施のまま残す。数値は 2026-09 時点の公開資料。

### 15.1 いま遅く感じる理由

- 1 回の認識は「画像抽出（thinking `low`）→ 条件付きで検索照合（予算 4 秒）」を **直列** に待ってから返す。国が欠けると検索が走り、体感が 4 秒以上伸びる
- 3.7 Flash には `minimal` が無く思考トークンを 0 にできない。`maxOutputTokens` 4096 も上限が大きい
- 生産国は `verified_origin` 以外の推測（`unverified_guess`）を捨てているため、「読み取ったが表示されない」状態が起き、遅い上に空欄に見える

### 15.2 案 A: 二段階返却（採用済み）

- 抽出結果を **先に** 返して欄を埋め、検索照合は第 2 リクエスト（または同じレスポンスの後半）で国・品種だけ追記する
- 効果: 品名・生産者・ヴィンテージ・種類・量は抽出時間（実測 2〜3 秒台）で入る。国の補完は後から差し込む
- 変更点: `/api/logs/recognize` を `phase=extract|lookup` に分けるか、抽出結果を返した後に `lookup` を追加呼び出し。§8 の上書き規則（触った欄は守る）はそのまま
- 追加コスト: 無し（呼び出し回数は同じ）。フォームの「読み取り中」ピルは国・品種だけ第 2 段まで残す

### 15.3 案 B: 抽出モデルを Gemini 3.5 Flash-Lite にする（採用済み。既定を切替。3.7 Flash は env で戻せる）

- 公開ベンチ（商品写真の構造化抽出）で 3.5 Flash-Lite ≈ 1.5 秒 / 3.7 Flash ≈ 3.0 秒。料金 $0.30 / $2.50（1M トークン。3.7 Flash は $0.75 / $3.75）
- Priority 推論にも対応。プロファイル追加だけで済む（§11 の手順）
- リスク: 小さい文字・手書き・光沢ラベルでの読み落ちが増える可能性。実写真 30 枚で 3.7 Flash と比較してから既定を変える

### 15.4 案 C: Gemini Priority 推論（`service_tier: "priority"`）

- 混雑時の待ち行列を優先し、レイテンシを安定させる。空いている時間帯の短縮は小さい
- 料金は標準の 75〜100% 増（3.7 Flash: $1.35 / $6.75。2026-12-31 までのキャンペーン価格）。容量不足時は標準に自動降格し、`x-gemini-service-tier` ヘッダで判別できる
- **未検証**: Cloudflare `env.AI.run` の Generate Content 経由で `service_tier` が透過するか。通らなければ AI Gateway の直 Google URL（BYOK）に経路を変える必要があり、§12 の「追加の Google API キー不要」が崩れる
- 結論: 単独では体感改善が小さく費用が倍近い。案 A / B の後に、ピーク時間帯の p95 が問題なら検討

### 15.5 案 D: GPT-5.4 mini に変える

- $0.75 / $4.50（1M）、画像入力可、400k コンテキスト。公開実測は TTFT ≈ 450 ms / 全体 ≈ 4 秒で、3.7 Flash と同等〜やや遅い
- Google Search grounding が無いため §7 の照合は別実装（Bing / 自前検索）が必要
- Unified Billing の対象モデルなら経路は同じだが、アダプタ（Chat Completions 形式・`response_format: json_schema`）を新規に書く
- 結論: 速度目的では優位が無い。Gemini の可用性問題が出たときの **予備** として §11 の手順で足す価値はある

### 15.6 案 E: 推論の弱さへの対策（速度と独立）

1. 検証済み対応表の拡充（実施済み。San Fereolo のような `Dogliani` / `Langhe` は表で イタリア に決まる）
2. `unverified_guess` の国を捨てずに「候補: イタリア」チップとして欄の下に出し、タップで採用する（自動入力はしない。§6a に反映済み）
3. 検索照合の理由に「産地表記があるのに対応表で決まらない」を追加し、産地→国だけを 1 回検索する（予算 4 秒内）
4. プロンプトに「産地表記（appellation / 都道府県）をそのまま抜き出す」を明示し、抽出段で `origin` 候補文字列を必ず返させる

### 15.7 案 F: 小さな調整（採用済み。§3 / §9）

- `maxOutputTokens` 4096 → Flash-Lite 1024 / 3.7 Flash 2048（抽出 JSON は数百トークン。3.7 は思考トークン分の余裕）
- 認識用 JPEG の長辺を表示用と別に 1024px 程度へ落とす（入力トークンと転送量が減る）
- 検索予算は案 A で抽出の体感に影響しなくなったため 4 秒 → 6 秒（照合の成功率を優先）

### 15.8 推奨順と状況

A（二段階）→ F（小調整）→ E-2（候補チップ）→ B（Flash-Lite）まで実施。実写真での 3.7 Flash との比較（§13）はこれから。必要なら C。D は予備。
