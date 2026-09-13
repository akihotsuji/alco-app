# alco-app：AI補完統一・機能間引き継ぎ・破棄データ混入の修正指示

対象リポジトリ：https://github.com/akihotsuji/alco-app

この文書は実装指示である。**承認済み仕様そのものではない。** 画面・API・保存契約を変える項目は、実装前に `spec/features/` と（画面なら）`spec/screen-designs/` を先に更新し、同じ変更内でコード・テストと同期する。要素表とモックが食い違えば要素表が正。

以下は 2026-09-10 の静的再確認を起点とする。最新 `origin/main` で再確認し、実装・回帰テスト・仕様更新まで進める。調査だけで終了しない。

## 0. 文書の位置づけと再確認メタ

| 項目 | 値 |
| --- | --- |
| 初回調査日 | 2026-09-10 |
| 初回調査SHA | `b6b239eafeee90c2e716f39ac45348dc29170ece`（#120） |
| 再確認日 | 2026-09-10 |
| 再確認SHA | `4a86358ed6986307b5b63a05f8114cfa40b47184`（現行 `origin/main`） |
| 再確認手段 | 静的コード照合。実機再現・実API精度測定・本番DB確認は未実施 |
| `AGENTS.md` | **リポジトリに無い。** `.cursor/rules` と `.cursor/skills` を読む |

初回調査SHAから再確認SHAまでの差分（#121〜#125）は、Google OAuth、Turnstile、写真日次上限、使用量監視。AI認識・写真pending・セラー一覧ページングの中核コードは実質未変更。変わった関連点は次だけ。

- `PHOTO_UPLOAD_DAILY_LIMIT = 80`（ユーザー / JST 日。UI / PP に数値を出さない）。AI日次 10000 回（許容上限 MAX）とは別枠
- `wrangler.jsonc` の Turnstile サイトキー vars

本番デプロイSHAは未確認。取得できなければ完了報告に「未確認」と書く。証拠なく既存レコードを一括書換えしない。

## 1. 目的と作業範囲

優先順位：

1. 破棄した写真・AI結果が別の記録に混入する不具合の解消。
2. 機能間の写真・基本項目の引き継ぎを一貫させる。
3. セラーとテイスティングノートの写真撮影／写真選択時の基本項目補完を、飲酒記録と同じ**解析コア**へ統一する。モデルIDの寄せ替えは含まない。
4. 生産国を実在国の日本語名へ正規化・検証する。
5. セラー一覧のDB側ページング・集計を直す。段階的AI補完と一覧用派生画像は、計測で必要性が出たときだけ。

既存の React / TypeScript、Hono / Cloudflare Workers、D1 / Drizzle、非公開R2、認証基盤を維持する。
今回の目的は実装と検証。mainへの直接push、マージ、本番デプロイ、新規課金契約は含めない。

```bash
git fetch origin main
git checkout -b feature/<内容> origin/main
```

未コミット変更を上書きしない。関心事ごとにレビューできる変更単位に分け、無関係なリファクタリングを混ぜない。画面変更は PR 本文に「画面設計の変更点」を書き、該当ファイル末尾の受け入れチェックを貼る。

## 2. 再確認で確定した事実

全症状の原因確定としては扱わない。実行時の混入時点は、§3 の4時点比較で切り分ける。

### 2.1 AI解析の差分

- `src/server/services/ai-recognition/create-recognizer.ts` は task（`drink` / `label` / `note`）ごとにプロンプトとschemaを分岐する。drink はさらに `requestFormat` で分岐する。
  - Gemini（`gemini-generate-content`）→ `drink-extract.ts` の抽出プロンプト / schema
  - Workers AI（`workers-ai-chat`）→ `drink-recognizer/prompt.ts` の単段プロンプト / schema（lookup なし）
- `drink-recognizer/recognize.ts` の Gemini 経路は、画像抽出 → 必要時の検索補完 → 根拠による候補選択 → キャッシュ / in-flight 集約 → `usage` / `sources` / `searchUsed` / `durationMs` を返す。
- `label-recognizer/recognize.ts` と `note-recognizer/recognize.ts` は別プロンプトの単段処理。`drink-extract.ts` も lookup もキャッシュも共有していない。
- プロバイダ adapter（`factory.ts` / `gemini-adapter.ts` / `workers-ai-adapter.ts`）は共有済み。**モデル名だけ合わせても解析全体は同じにならない。**
- 既存APIは3本のまま残してよい。セラー画面から `POST /api/drink-logs/recognize` を直接呼ぶだけにはしない。

| 経路 | ルート | キャッシュ | lookup | 応答メタ |
| --- | --- | --- | --- | --- |
| 飲酒記録 | `POST /api/drink-logs/recognize` | あり（10分・最大32件） | Gemini かつ `needsProductLookup` のとき | `fields`, `provider`, `remainingToday`, `profile`, `modelId`, `durationMs`, `usage`, `sources`, `searchUsed` |
| セラー | `POST /api/bottles/recognize` | なし | なし | `fields`, `provider`, `remainingToday` のみ |
| ノート | `POST /api/tasting-notes/recognize` | なし | なし | セラーと同じ最小形 |

キャッシュキー（`recognitionCacheKey`）は `userId` / 画像SHA-256 / profile / modelId / promptVersion / schemaVersion / 検索有無。label / note にはキャッシュも in-flight 集約もない。

プロファイル（`wrangler.jsonc` の `env.dev` と **`env.production`**。`env.prod` という名前は無い。他envも無い）:

| キー | 現行値 |
| --- | --- |
| `AI_RECOGNITION_PROFILE` | `gemini-3.7-flash` |
| `AI_LABEL_RECOGNITION_PROFILE` | `gemini-3.7-flash` |
| `AI_NOTE_RECOGNITION_PROFILE` | `gemini-3.7-flash` |

`DEFAULT_PROFILE_BY_TASK` も同じ。`thinkingLevel` は `"low"`。`minimal` は送らない（Gemini 3.7 Flash は `low` / `medium` / `high` のみ。`minimal` は Gateway 400）。

2026-09-10 オーナー判断: 3機能の既定モデルを同じ Gemini 3.7 Flash に揃える。Llama は env で戻せる。モデル ID を揃えることと解析パイプライン（lookup）を揃えることは別。セラー / ノートは単段のまま。

設定UI（`spec/screen-designs/06-settings.md` S5）の副文は「Cloudflare 経由の外部 AI」。モデル名は出さない。

### 2.2 いつ解析が走るか

| 画面 | 解析するか | 条件 |
| --- | --- | --- |
| 飲酒記録 新規 / 編集 | する | JPEGがあれば即時。OFFトグルは**無い** |
| ノート 新規 / 編集 | する | `NoteFormFields` 内。JPEGがあれば即時。OFFトグルは**無い** |
| セラー 単体新規 | する | `mode === "new"` かつ `getCellarRecognizePref()` |
| セラー 一括 | する | `use-bottle-batch.ts` かつ `getCellarRecognizePref()` かつ行の `recognizeJpeg` |
| セラー 編集 | **しない** | `mode !== "new"` で早期return。画面を開いただけでも、新規写真を足しても解析しない |

`getCellarRecognizePref()` のキーは `cellar.recognize`。既定 ON。記録・ノートに同等の設定は無い。

「既存のAI読み取りOFFを3機能で尊重する」は現行仕様と一致しない。OFFを記録・ノートへ広げるなら、設定画面と `06-settings.md` を先に変える。今回の既定は次とする。

- セラー: 既存OFFを維持。OFFなら解析を開始しない
- 記録・ノート: 現行どおり写真があれば解析する。勝手にOFFトグルを足さない
- 3機能とも、編集画面を開いただけでは解析しない（記録・ノートは「その編集セッションで明示的に追加 / 差し替えした写真」だけ）

ラベルAPIは `abvPercent` を返すが、クライアント `applyRecognizeToForm` は捨てる（ボトルに度数列が無い）。ノート認識は評価・香り・味・余韻を埋めない。ボトル容量 750ml を1杯量へコピーしない。セラーに度数列やノートの量欄を足さない。

### 2.3 破棄データ混入につながる経路

`src/client/components/layout/photo-edit-context.tsx`（`AuthenticatedLayout` 配下で認証後アプリ全体に1つ）:

- `attachments` は kind（`log` / `cellar` / `note`）別。`pendingRecognizeJpeg` は **Provider全体で単一の `Blob | null`**。機能・フォーム・レコード・写真世代で識別されていない。
- `ingestLogPhoto` は `processLogFile(file, offerRecognizeJpeg)` で pending をセットする。認識用JPEGはキャラ合成前に作る。
- 記録の通常取り込みは `PhotoEdit` を挟まず `beginUpload("log", processed)` する。`applyProcessed` を呼ばない。`beginUpload` は pending を消さない。アップロード成功後、同じJPEGが `attachments.log.recognizeJpeg` にも載る。
- セラー / ノートの `applyProcessed` は pending を消す。記録直取り込みとの非対称がリークの主因。
- `clearAttachment` / `releaseAttachment` は attachment だけを除去し、pending を消さない。attachment が無いと `clearAttachment` は早期returnする。
- `logIngestTokenRef` は新しい取り込みで更新されるが、破棄・保存では失効しない。遅い `processLogFile` のアップロード抑止にしか使っていない。
- `clearAttachment` は削除API完了後にローカル状態を消す。待機中に新しい取り込みが完了すると、古いIDを消しつつ新しい attachment を拭う競合がある。
- pending を `null` にするのは `popstate`（photo-edit履歴）、`closeOverlay`、`applyProcessed` だけ。ホームへ戻る・破棄・保存では消えない。

`LogNewForm.tsx` / `LogEditForm.tsx`:

- 解析対象は `attachment?.recognizeJpeg ?? pendingRecognizeJpeg`。
- pending があるだけで認識APIを先読みする effect がある。
- 「破棄する」は `clearAttachment("log")` だけ。`setPendingRecognizeJpeg(null)` も `forgetDrinkRecognition` も呼ばない。
- `forgetDrinkRecognition` / `forgetLabelRecognition` / `forgetNoteRecognition` は**テスト以外で未使用**。
- `LogNewForm` の古い attachment 除去も `clearAttachment` だけなので、pending だけ残るケースを防げない。
- 日別一覧の行は `/logs/entries/:id/edit` へ行く。**読み取り専用の詳細画面は無い。** `LogEditForm` が詳細の入口。画面を開くだけで残存 pending が解析対象になる。`LogEditForm` には新規画面相当の stale attachment 除去が無い。
- `recognize-session.ts` の WeakMap は同じ Blob の完了済み Promise を返す。再APIが見えなくても再適用は起こり得る。
- 既存の空欄の識別項目は埋まり得る。編集画面は既存の非空の品名・種類・量を lock する。「品名・種類の上書き」全体をこの経路だけで説明しない。空の生産者 / 生産国 / 品種 / ヴィンテージは埋まり得る。
- pending Blob だけで写真表示は復活しない。表示は `attachments.log`、遅延アップロード、編集の `existingPhotoId`（GET）に依存する。

マイドリンク経路:

- `MyDrinkQuickList` → `useLogMyDrink` → `POST /api/my-drinks/:id/log`。ボディは `{ drunkAt?, memo? }` のみ。
- `createDrinkLogFromMyDrink` はプリセットの種類・量・度数・`myDrinkId` から作り、`createDrinkLog` がプリセット名を入れる。`photoIds` も識別項目も渡さない。1タップは識別列を null のまま作る（`register-identity.md` 2.2）。
- **ワンタップの POST で破棄フォームの写真やAI項目がDBに入る経路は無い。** 「詳細表示時の汚染」と「その後の保存でDBへ書いた」を切り分ける。

OSの写真選択キャンセルは、現行どおり入力を維持する（`pickImage` が空なら `startCapture` / `retake` は return）。壊さない。

未紐付け写真の24h GCは実装済み（`photo-gc.ts`、`PHOTO_GC_TTL_MS`、cron `0 18 * * *`）。破棄中に `photoId` 未採番のアップロードが完走すると孤児になり、24h後に回収される。保存済み元写真は消さない。

### 2.4 機能間引き継ぎの現状

- 飲酒記録→ノート: `noteFormStateFromDrinkLog` が品名・種類・ヴィンテージ・生産者・生産国・品種・飲酒日（`tastedOn = drunkOn`）を初期化する。評価は未選択。メモ・場所・量・度数はコピーしない。画面設計 `05-notes.md` N1 は `?fromLog=` / `?bottleId=` で**認識を走らせない**。
- セラー→飲酒記録: `usePrefillBottle` / `applySelectedBottle` で基本項目を埋め、`inheritOwnedPhoto` で写真を複製する。
- セラー→ノート: `NoteNewWithBottle` が基本項目と写真を引き継ぐ。
- `copyOwnedPhoto` は元写真を取得して未紐付けとして再アップロードする。所有排他を保つコピーであり、AI再解析ではない。`inheritOwnedPhoto` は attachment に `recognizeJpeg` を載せない。
- ノート引き継ぎは `firstPhotoId` の先頭1枚。**記録の `?bottleId=` 初期化も同じ関数を使う。** 複数枚の遷移は引き継ぎ先上限（記録1 / ノート6 / セラー1）と順序を明示する。元写真は移動・削除しない。
- `useNotePhotos.inheritFrom` は、既に同じIDを継承済み、または `items.length > 0` なら何もしない。完了時の無条件upsertではない。失敗時は行を消して `inheritedRef` を戻す。コピー中の欠落を黙って保存できる問題は残る。collect の `onUpdate` は別経路で upsert する。
- **フォーム内ボトル選択は基本項目だけ。写真は引き継がない。** URL初期引き継ぎとは別処理。抜けは確認済み。
- `toCreateTastingNoteBody` は `bottleId` があると品名・種類を送らない。`toCreateDrinkLogBody` は `bottleId` があっても品名を送り得るが、サーバーはボトル値で上書きする。
- サーバー（記録・ノートとも）は `bottleId` があると `drinkName` / `drinkType` をボトルの**現在値**にする。これは `register-identity.md` 2.2 の現行契約（ボトル名 > マイドリンク名 > ボディ）。
- `resolveIdentityFields` は「ボディにキーがあれば採用、省略時はボトル」。クライアントは空欄を **省略** しがちで、`null` を送らない。空にした生産国が保存時にボトル値へ戻ることがある。
- 撮影先行 handoff（`photoHandoffState` / `CaptureIntent`）は型と `LogNewForm` の stale判定だけ。**`navigate` に handoff state を渡す本番呼び出しは無い。** 中央タブは `navigate("/logs/new")` のみ。画面設計も記録は photo-edit を出さず詳細入力へ直接。存在しない正規handoffを前提に全消去を足さない。接続するなら画面設計を先に直す。

### 2.5 生産国

- 記録・セラー・ノートの `origin` は自由文字列 ≦100。UIは `IdentityFields` / `DetailField` のテキスト入力。国名セレクトは無い。
- `drink-extract.ts` はプロンプトで国名を指示しつつ、`printedOrigin` を `fields.origin` に入れ `confidence=0.9` を付ける。
- `subject === "label"` かつ `printedOrigin` が空のとき、自由文字列 `origin` を `printedOrigin` へ昇格する。印字根拠の誤判定になり得る。
- lookup の `origin` に国名辞書検証は無い。
- `verified-origin.ts` は産地（アペラシオン）→国の辞書だけ。一般的な国名正規化・許可リストの代わりにはならない。
- クライアントは確度 0.5 未満を捨てる。国としての許可リストは無い。
- `01-requirements.md` / セラー・ノート仕様は「生産国・品種はラベル情報から推測」。`ai-recognition.md` / `register-identity.md` は根拠不足なら空欄。**仕様が割れている。** 今回の実装は根拠＋国名検証を正とし、緩い「推測」側の文書を同じ変更で直す。

### 2.6 一覧の遅さ

`listBottles`（`src/server/services/bottles.ts`）:

- 集計用に該当行の `drinkType` を全件取得し、JSで `countsByType` を数える。
- 本体も SQL `LIMIT` 無しで全件取得し、`findIndex` + `slice` でページを切る。
- `totalCount` / `countsByType` の範囲は `userId` + view由来の `status` のみ。**`q` と `drinkType` は含めない。** ページ `items` だけが検索・種類フィルタを受ける。この契約を黙って変えない。
- 不正cursor（デコード失敗・行なし）は `validation_error`（HTTP 400、`fields.cursor`）。

`CellarList.tsx`:

- 種類別の初回は `group=type&limit=12` の 1 本（`typeShelves`）。段の追加取得だけ種類ごとの infinite query。

サムネ:

- `thumbPhotoId` は先頭写真ID。一覧の `<img>` は `photoContentUrl(id, "thumb")`（長辺 400 の派生）。詳細・ライトボックス・編集・複製は原本。
- `ContentPhoto` に `loading="lazy"`、`decoding="async"`、寸法指定あり。
- Query `staleTime` は 30秒、`gcTime` は 24 時間（`query-client.ts`）。写真は `Cache-Control: private, no-cache` + `ETag`（原本 `"{id}"`、サムネ `"{id}:thumb"`）。表示のたびに再検証する。1 年 immutable には戻さない。

`useBottles` の queryKey は `view` / `q` / `drinkType`。**`limit` / `cursor` を含まない。** `useInfiniteBottles` は `limit` を含み、`cursor` は含めない。形式を混同しない。

既存index: `(user_id, status)` / `(user_id, drink_type)` / `(user_id, consumed_at)`。keyset（`createdAt DESC, id DESC`）向けの `(user_id, status, created_at, id)` は無い。必要な複合indexだけ足す。

**同型の全件取得+sliceは確認済み。** `listDrinkLogs`、`listTastingNotes`、`listMyDrinks` も同じ。確認できたものだけ直す。記録の `totalCount` はフィルタ後 `rows.length`（ボトルと数え方が違う）。

## 3. 不具合を先に再現し、セッション境界を修正

必須の再現手順：

1. 飲酒記録の新規画面で写真Aを選択する。
2. AI補完とアップロードが完了してから「破棄する」でホームへ戻る。
3. マイドリンクBをタップして記録する。
4. 今日の一覧からBを開く（実体は編集画面）。
5. Aの画像・品名・種類・識別項目が混入していないか確認する。

次の4時点を比較する。

- ワンタップ登録の POST payload と response
- Bの GET response
- 編集画面初期化後の表示
- 編集を保存した後の GET response

静的再確認では、ワンタップPOSTへの混入経路は見当たらない。混入するなら主に時点3（残存 pending / WeakMap の再適用）。時点4まで進むとDB汚染。写真IDの所有者・紐付けを確認する。画像や認証情報はログへ出さない。

修正原則：

- 編集セッションID（フォームの1回の利用）、機能 kind、編集対象 recordId、写真ID / 世代、requestId を必要な範囲で管理する。
- pending を kind 別にするだけでは、同じ log 内の新規→別レコード編集を防げない。セッション一致と写真世代一致を適用条件にする。
- 破棄・保存完了・写真削除・画面離脱・レコード切替で関連処理を即時失効する。
- ローカル失効は削除API完了を待たない。通信失敗でも失効済み状態を復活させない。
- デコード、画像処理、認識用JPEG通知、背景除去、アップロード、写真コピー、AI応答の全段階で古い結果の適用を拒否する。
- 通信中止が可能なら `AbortController` を使う。中止だけに依存せず、結果適用時にも検証する。`ai-recognition.md` のとおり、上流 `ai.run` 自体の中断は binding 非対応で、アプリ側打ち切り後も上流課金が残り得る。
- 存在しない撮影先行handoffを「正規セッション」として新設しない。現行の記録直取り込み（`startCapture("log")` → `ingestLogPhoto`）を壊さない。
- OSの写真選択キャンセルは、現在の有効な入力・写真を維持する（現行どおり）。
- clear / release / discard は複数回呼んでも安全にする。別の新しいセッションや写真を消さない。
- 破棄後にアップロードが完了した未紐付け写真は安全に回収する。既存の24h GCも使う。保存済み元写真は削除しない。
- 編集画面を開くだけでAI補完や更新APIを実行しない。編集時の補完は、その編集セッションで明示的に追加 / 差し替えした写真だけを対象にする。
- WeakMap の全削除や全 Query キャッシュ破棄だけで解決しない。破棄時は対象 Blob の `forget*` を呼ぶ。

## 4. AI解析の共通化

飲酒記録の現行 Gemini 解析（抽出・根拠・任意lookup・キャッシュ）を共通サービスへ抽出する。既存の3 recognize APIは薄い adapter として残してよい。

**モデル ID は 2026-09-10 のオーナー判断で揃えた**（3機能とも既定 `gemini-3.7-flash`）。§9 の「profileを揃える」は、共有resolverが task別キーを同じ手続きで読むことも含む。コードだけ共通化して、label/note が古い個別profile解決のまま残ることを禁ずる。解析パイプライン（lookup）までは揃えない。セラー / ノートを drink の extract+lookup に置き換えない。

共有する内容：

- 画像からの識別項目抽出
- 必要な場合だけの商品検索（`profile.supportsSearch` のときだけ。現行 Llama は検索不可なので label/note は lookup しない）
- 生産国・品種等の根拠確認。不明時は空欄
- 型検証、信頼度判定、タイムアウトとエラー分類
- モデルprofile・設定解決
- 日次上限（`ai_usage`、3機能で共有の10000回。許容上限 MAX）、失敗時返却
- usage・sources・searchUsed・duration（label/note の応答形は既存クライアント互換を崩さない範囲で足してよい）
- キャッシュと同時リクエスト集約（label/note にも同じキー設計を載せる）

「同じ基本識別」は共有し、「グラスの量推定」など目的依存の結果を別用途へ誤流用しない。回数枠（アプリ10000回。許容上限 MAX）と実API費用、写真アップロード80枚/日を混同しない。

元画像の解析とセラーの背景除去は独立させる。背景除去完了待ちで解析を遅らせない。解析にはキャラ合成前でラベルを保持した画像を使う。

項目マッピング：

| 共通項目 | 飲酒記録 | セラー | ノート |
| --- | --- | --- | --- |
| 品名 | drinkName | name | drinkName |
| 種類 | drinkType | drinkType | drinkType |
| 生産者 | producer | producer | producer |
| 生産国 | origin | origin | origin |
| 品種 | variety | variety | variety |
| ヴィンテージ | vintage | vintage | vintage |

量・度数は、保存先schemaに存在する用途だけに適用する。

セラーの単体登録と一括登録、カメラとライブラリの両方を対象にする。
セラー編集での新規写真追加 / 差し替えも、同じ補完と上書き保護を適用する。これは現行コードにも現行画面設計（S5「ボトル追加時」）にも無い。**実装前に `04-cellar.md` / `06-settings.md` / `cellar.md` を更新する。** 編集画面を開いただけでは解析しない。

AI失敗・上限到達でも手入力を続け、AI未完了だけを理由に保存を禁止しない。未完了アップロード等の既存保存制約は維持する。

## 5. 引き継ぎと再解析の分離

入口を「新規写真」「既存記録から継続」「既存記録の編集」として区別する。
既存記録から継続した場合、基本項目と写真を初期値として取り込み、AIは自動実行しない。空欄があっても無関係な pending で補完しない。
再解析する場合は、新しい写真追加 / 差し替え等の明示操作を起点にする。

最低限の対象経路：

- 飲酒記録保存後→ノート
- 飲酒記録の編集画面にあるノート作成導線
- セラー開栓後→飲酒記録
- セラー詳細→飲酒記録
- セラー開栓後 / 詳細→ノート
- フォーム内でボトルを選択して関連付ける経路（**写真引き継ぎが抜けている**）
- ほかに存在する機能横断の記録導線を検索して同じ規則を適用する

引き継ぐ情報：

- 写真、品名、種類、生産者、生産国、品種、ヴィンテージ
- 関連ボトルID等の正当な関連情報
- 飲酒記録→ノートは飲酒日を試飲日にする
- セラー登録日や写真撮影日を新しい飲酒日時へそのまま移さない
- 新規ノートの評価・感想は空欄。飲酒量はその記録の適切な既定値を維持する

優先順位：

- 利用者がそのセッションで編集した値を、遅延取得・再取得・AI応答で上書きしない。
- 元記録の確定スナップショットを画面初期値にする。
- AIは許可された新規写真について、空欄またはその写真に由来する未編集AI候補のみ補完する。
- 空欄にした手入力も編集済みとして保護する。保存時は省略ではなく `null` を送り、サーバーがボトル値を再投入しないようにする。
- 別のボトルへ切替時は、前ボトル由来の未編集値・写真を残して混合しない。手入力がある場合は既存UIに沿って安全に扱う。
- 同じコンポーネントのまま元IDが変化するケースでも、前の初期化済み ref や state を引きずらない。

`bottleId` と品名・種類の保存契約：

- **現行仕様は「ボトルありなら品名・種類はボトル現在値」**（`register-identity.md` 2.2、`drink-logs.ts` / `tasting-notes.ts`）。
- 「元ログのスナップショットを保存後も維持」は仕様変更。実装前に `register-identity.md` / `api-design.md` / 画面設計を更新する。
- ボトルIDだけを指定する従来クライアントはボトル値へ fallback 可能にする。明示された有効なスナップショットと未指定を区別する。
- 空欄 / `null` と未指定の意味を統一する。意図して消した項目をサーバーが再投入しない。

写真は既存の独立コピー方式でよい。画像の取得 / 複製をAI再解析と混同して削除しない。
写真コピー中・失敗を表示し、黙って写真なし保存へ進まない。再試行または明示的な「写真なしで続ける」を可能にする。これも画面設計の更新対象。
引き継ぎ先の上限内で写真と順序を保持し、元記録の写真を移動・削除しない。
コピー / アップロード完了後もセッション・対象・世代が有効か検証し、削除した写真を復活させない。

## 6. 必須の回帰テスト

文字列の存在確認だけで完了としない。React状態遷移 / 実画面とAPIの挙動を検証する。
AIは制御可能な mock を使い、処理の完了順を意図的に入れ替える。

1. 報告手順の完全再現：補完完了→破棄→マイドリンク→編集画面。POST / GET と DOM の写真・品名・種類・識別項目を比較する。
2. 保存せず編集画面を開くだけでは、更新APIも認識APIも発生しない。
3. AI待機中、デコード中、アップロード中、背景除去中、写真コピー中にそれぞれ破棄する。
4. Aを破棄してBを開いた後にAの各非同期処理が完了しても、Bが変化しない。
5. 写真A→Bの差し替えで、遅いA応答がBを上書きしない。
6. 写真削除、保存成功、戻る、再入場、log / note / cellar 間の往復でも残存結果を適用しない。
7. pending のみ存在し attachment が無い状態の破棄。
8. 写真選択キャンセルは現在の有効入力を保持する。
9. 記録の直取り込み（`ingestLogPhoto`）が1枚1回だけ解析され、破棄後に再適用されない。未接続の `photoHandoffState` を「壊れていない」とみなして成功扱いにしない。
10. 飲酒記録→ノート、開栓→飲酒記録、セラー→ノートで、写真・基本項目を保存後GETまで比較する。追加AI呼び出しが0回。
11. 元ログとボトルの現在値が異なる場合の保存結果は、§5 で更新した仕様どおりであること（現行契約のままならボトル値、スナップショット契約に変えたなら元ログ値）。
12. コピー失敗の再試行、コピー中削除、元写真の保護、他ユーザー写真 / 記録への認可。
13. セラー単体 / 一括、ノート、飲酒記録のカメラ / ライブラリが、共通識別 fixture に対して同じ基本項目を返す。現行どおり label/note が Llama なら、モデル差で値は完全一致しないことがある。その場合は「同じ抽出規則・同じ国名検証・同じ空欄規則」を検証し、モデル出力の一致を成功条件にしない。
14. AI待機中の手入力、手動で空欄にした値、確定済み引き継ぎ値を上書きしない。空欄の保存がボトルfallbackで復活しない。
15. 429 / 5xx / timeout 時の手入力継続、セラーAI OFF、回数枠、古いキャッシュの誤適用防止。
16. 連続写真やノート複数写真で、対象行・削除済み写真の結果が混ざらない。
17. 元ID / 編集対象IDの変更や再取得で、二重コピー・初期値の再適用をしない。
18. フォーム内ボトル選択で写真が引き継がれる（§5 の仕様どおり）。切替時に前ボトル写真が残らない。

lint / typecheck、関連 unit / API / E2E とリポジトリ所定のゲートを実行する。
実APIの課金付き検証や実機が使えない場合は mock 検証と分けて明示し、未実施を成功扱いにしない。
既存不具合との切り分けを記録し、無関係な修正で範囲を広げない。

## 7. 主な確認ファイル

クライアント:

- `src/client/components/layout/photo-edit-context.tsx`
- `src/client/layout/AuthenticatedLayout.tsx`
- `src/client/components/photo/PhotoEdit.tsx` / `PhotoEditHost.tsx` / `ContentPhoto.tsx`
- `src/client/components/logs/LogNewForm.tsx` / `LogEditForm.tsx` / `MyDrinkQuickList.tsx` / `BottlePickerRow.tsx`
- `src/client/components/cellar/BottleForm.tsx` / `BottleBatchForm.tsx` / `BottleDetail.tsx` / `CellarList.tsx` / `BottleTile.tsx`
- `src/client/components/notes/NoteForm.tsx`
- `src/client/components/form/IdentityFields.tsx`
- `src/client/hooks/use-note-photos.ts` / `use-bottle-batch.ts` / `use-bottles.ts`
- `src/client/lib/recognize-session.ts`
- `src/client/lib/drink-recognize.ts` / `label-recognize.ts` / `note-recognize.ts`
- `src/client/lib/log-form.ts` / `note-form.ts` / `copy-owned-photo.ts` / `preferences.ts`
- `src/client/lib/app-routes.ts` / `history-state.ts` / `opened-followup.ts` / `query-client.ts` / `query-keys.ts`

サーバー / 共有:

- `src/server/services/ai-recognition/`（`create-recognizer.ts` / `drink-extract.ts` / `verified-origin.ts` / `cache.ts` / `profiles.ts` / adapter）
- `src/server/services/drink-recognizer/` / `label-recognizer/` / `note-recognizer/`
- `src/server/services/drink-logs.ts` / `tasting-notes.ts` / `my-drinks.ts` / `bottles.ts` / `ai-usage.ts` / `photo-gc.ts`
- `src/server/routes/drink-logs.ts` / `bottles.ts` / `tasting-notes.ts`
- `src/shared/` の各 recognize・記録 schema、`identity.ts`、`constants.ts`

仕様:

- `spec/features/ai-recognition.md` / `drink-log.md` / `cellar.md` / `tasting-note.md` / `photos.md` / `register-identity.md`
- `spec/api-design.md` / `data-model.md`
- `spec/screen-designs/03-log.md` / `04-cellar.md` / `05-notes.md` / `06-settings.md` / `07-photo-capture.md`

パスや仕様が変わっていれば最新構成を優先する。

## 8. 完了報告

- 調査SHA（初回と実装時）、再現条件、確認できた原因と未確認部分
- POST / GET / DOM のどの時点で混入していたか
- 修正内容と関連ファイル
- 引き継ぎマッピングと再解析の開始条件
- `bottleId` と品名・種類の、更新後の保存契約
- 回帰テスト結果、実機 / 実APIの検証範囲
- API / schema互換性、写真の複製・回収への影響
- 本番の既存データ修復が必要かどうか。証拠なく既存レコードを一括書換えしない
- 残る制約・リスク

「pendingをnullにした」「モデルを揃えた」だけで完了にしない。別セッションへの混入が防げ、機能を跨いで保存した結果が、更新後の仕様どおり元データと一致するところまで検証する。

## 9. 追加要件：AIの精度を維持して待ち時間を減らす

ユーザーは現行AIの精度を評価しているが、速度に不満がある。安価なモデルへの一律変更ではなく、処理経路を先に最適化する。実測がなければ推定秒数を断定しない。Gemini 経路の `verification` は `mock-only`。Google Search 通過は仕様上も未検証。

追加の静的調査（再確認済み）:

- drink の `thinkingLevel` は `low`。未対応の `minimal` 等を推測で送らない。モデル仕様・対応値を変える場合は、実装時点の公式資料で確認する。
- `needsProductLookup` は「品名と生産者があり、生産国または品種のどちらかが空」で true。品種が適用されない酒類や、これ以上絞り込めない商品でも検索が起動し得る。
- `executeDrinkRecognition` は画像抽出後の検索完了まで結果を返さない。検索を待つため、既に得られた品名等の表示まで遅れる。
- `lookupTimeoutMs` は profile にあるが、値は `AI_RECOGNIZE_LOOKUP_TIMEOUT_MS`（**20秒**）で、`runLookup` は読んでいない。全体 timeout（Gemini抽出 25秒、全体 40秒）の abort では、抽出済み結果も失敗扱いになり得る。
- Gemini の `maxOutputTokens` は抽出 4096、検索 2048。Llama は 500 / 400。上限を下げれば必ず速くなるわけではない。思考分を含む制約やJSON切れを確認する。
- `register-identity.md` の「max_tokens は記録・ノートを 500 程度へ」は現行 Gemini 4096 と食い違う。共通化時に仕様を実装へ合わせる。

優先するシンプルな実装：

1. 画像準備、extract、lookup、response、画面への初回補完を分けて計測する。モデル・画像サイズ・検索実行率・再試行数・p50 / p95 を分離する。
2. 検索前に国名正規化と検証済み産地対応を適用し、未解決かつ当該酒類に意味のある項目だけ検索する。ワイン品種と日本酒の原料米等を無造作に同一条件にしない。商品同定の手掛かりが弱い場合は検索を濫発しない。
3. 検索専用の短い時間予算を**新たに**設定する。既存の未使用 20秒フィールドを有効化するだけにしない。例として 3〜5秒を検証用初期値にできるが、実測に応じ調整する。残り全体予算を越えない。
4. 検索を打ち切っても、それ以降に届く結果を別セッションへ適用しない。providerの通信中止が効くかと、画面への適用中止を区別する。
5. 未確定の国・品種は空欄のまま。速度のために根拠条件を緩めない。
6. 共通化した認識キャッシュと同時要求集約を使い、同じ写真の二重解析を避ける。単純な Gateway 共有キャッシュ有効化で認可や異なる解析目的を混ぜない。
7. 画像縮小・出力項目削減は、小さい文字の読み取り精度とJSON完結性を比較してから採用する。原本の表示品質を下げない。

上記で初回補完の待ち時間が残る場合の第二段階：

- extract結果を先にフォームへ表示し、必要な lookup だけ後から空欄へ反映する二段階応答を検討する。
- 既存API互換性と実装量を比較し、分離APIかストリーム等の最小構成を選ぶ。ジョブ基盤は新設しない。
- 単にクライアントへ全結果を返してから「段階表示」するだけでは改善にならない。
- 保存・破棄・手入力後は遅延 lookup で書き換えない。画面表示だけでなく保存結果も保護する。
- 検索なしの初回識別精度と、検索込みの最終補完率を別々に測る。空欄が増えただけなのに「精度維持」と報告しない。

高速モデル比較は上記の後。必要なら同一写真の小規模評価で品名、種類、国、品種の正答率・空欄率・時間・費用を比較して採用判断する。今回のために未検証モデルへ勝手に切り替えない。

## 10. 追加要件：セラー等の一覧表示をシンプルに高速化

第一段階として実装する。

- SQL側で `limit+1` と cursor 条件を適用する keyset pagination へ変更し、全件取得後 slice を廃止する。
- 並び順の日時と id の複合境界を正しく扱う。archive の `consumedAt`、通常の `createdAt`、同時刻の複数行、null、途中削除、空ページ、不正cursor、検索 / 種類フィルタとの整合をテストする。
- 不正cursorは現行どおり 400 `validation_error`。契約を変えるなら明記する。
- 件数は DB の `COUNT` / `GROUP BY` へ移す。`totalCount` / `countsByType` が `q` / `drinkType` を**含まない**現状を維持する。変えるなら仕様とクライアントを同時に直す。
- 独立した集計と一覧取得の不要な直列待ちを減らす。D1での実行方法は現在の利用APIに合わせる。
- `EXPLAIN QUERY PLAN` で既存indexを確認し、実際に必要な複合indexだけ追加する。
- 種類別行 / 次ページに不要な全体集計を繰り返さない。集計の分離か、初回のみ返す方式など小さい変更で改善する。
- `useBottles` の queryKey に `limit` / `cursor` の取りこぼしが無いか確認し、`useQuery` / `useInfiniteQuery` の結果形式を混同しない。
- 保存・開栓・削除・復元時の invalidate を維持する。再取得中に既存一覧を消さない。
- ノート一覧・飲酒記録一覧・マイドリンク一覧の同型問題（確認済み）だけ直す。

画像転送が遅さの中心なら第二段階：

- 一覧専用の小さい画像派生を保存時に1回生成し、一覧でそれを配信する案を採用候補にする。
- 目安は表示寸法×DPRに応じた横 200〜400px 程度。透過ボトルは alpha を保持し、原本は詳細・拡大表示用に維持する。
- 既存の画像処理基盤と Workers で使える機能を確認して最小構成にする。有料画像変換サービス契約を前提にしない。
- 一覧読込のたびに画像を変換しない。既存写真は fallback を持たせ、全件の即時再生成を必須にしない。
- 原本と派生画像の認可、削除、コピー、GCを整合させる。非公開写真を public cache へ変更しない。
- ファーストビューの必要な写真だけ eager、画面外は lazy を維持する。全画像の一斉先読みをしない。
- 一覧の staleTime 延長は再訪改善の候補。初回表示の改善とは分け、保存直後の反映とログアウト時のデータ破棄を守る。

測定：

- 初回と再訪、通常と種類別、20 / 200 / 2000 件程度の fixture を分ける。
- API TTFB、DB取得件数 / クエリ数、応答サイズ、画像合計転送量、最初の棚写真表示までを比較する。
- ローカル fixture の数値を本番の速度改善実績として扱わない。
- Redis、検索エンジン、全面仮想化、新ジョブシステムの導入を先行させない。

## 11. 追加要件：生産国は実在する国の日本語名に限定する

ユーザー報告：「DOCG」「MADE IN CHINA」などが生産国欄へそのまま入る。

必須の設計：

1. 読み取った原文（例：Made in China）と、保存候補の国名 / 国コードを分ける。
2. 共通サーバー処理で「国コード→日本語の標準表示名」の管理された対応表を持つ。
3. 主要ワイン生産国だけの狭いリストではなく、実在国をカバーする検証済みデータを使う。出典・版・更新方法を明記する。
4. 国コード / 日本語名は Unicode CLDR 等を参照可能だが、CLDR / ISO の地域一覧には国以外の地域・集約地域もある。全項目を無条件で「実在国」として許可せず、国としての採用範囲を定義する。国以外の値を別の国へ強制変換しない。
5. 表記揺れ、英語名、明確な別名、大文字小文字、全角文字等を正規化する。
6. ラベルの国名、検証済み産地からの国、検索で確定した国を、すべて同じ validator へ通す。モデルの confidence 値だけで許可しない。
7. 酒そのものの生産国を対象とする。瓶・グラス・箱の製造国、輸入者住所、販売会社所在地、単なるラベル言語を根拠にしない。
8. 複数の国や根拠が競合する場合は空欄。曖昧な地名・短い略号への部分一致で無理に埋めない。
9. DOCG 等の格付け文字列を国名として保存しない。法的な産地表示との対応を使う場合は、その対応を検証した辞書へ分離し、十分なラベル文脈がある場合だけ日本語の国名にする。未検証なら空欄。
10. 「日本語で出力して」とプロンプトに追記するだけで終了しない。最終応答 / 保存時の正規化と検証を実装する。
11. 手入力も国名候補から選べる入力にする。**これは新規UI。** `IdentityFields` と画面設計（`03-log.md` N8b、`04-cellar.md` B6 / G6、`05-notes.md` N3b）、`register-identity.md`、Zod、書込みAPIを同じ変更で直す。既存の不正値を保持したレコードの無関係な編集を壊さないよう、新規 / 変更された origin の検証と既存値の扱いを分ける。
12. 古いAIキャッシュが不正値を返さないよう schema / prompt / cache version を更新する。

期待例：

| 入力と文脈 | 生産国欄 |
| --- | --- |
| France / FR / フランス：酒の原産国として確認 | フランス |
| Product of Italy：酒の原産国表示 | イタリア |
| MADE IN CHINA：酒そのものの生産国表示と確認 | 中国 |
| ＭＡＤＥ ＩＮ ＣＨＩＮＡ：同上 | 中国 |
| MADE IN CHINA：グラス・容器の刻印のみ | 空欄 |
| DOCGのみ：対応未検証 / 文脈不足 | 空欄 |
| 検証済みの Barolo 産地表示 | イタリア |
| 輸入者住所が Tokyo | その情報では補完しない |
| 架空国、不明、Europe / EU、複数候補の競合 | 空欄 |

既存データを「DOCG→イタリア」「Made in China→中国」のような文字列だけで一括変換しない。根拠のない誤推定を確定データにしてしまう。
まず dry-run で対象件数と、安全に正規化できるもの / 根拠確認が必要なものを分ける。既存データの一括更新は今回自動実行しない。

テストに上記の例、他言語 / 全角 / 別名、架空国、輸入者、容器の製造国、衝突するラベルと検索結果、古いキャッシュ、3機能共通適用を追加する。

## 12. 実装順序

0. 仕様・画面設計の更新（国名入力、セラー編集時の解析、コピー失敗UI、`bottleId` 保存契約、根拠規則の文書統一）。画面変更はコードより先。
1. 編集セッションの隔離と破棄データ混入修正。
2. 生産国の検証・日本語正規化。
3. 写真 / 基本項目の継承契約と保存時の整合修正。
4. 3機能のAI解析コア統一（resolver・根拠・キャッシュ。モデルIDは維持）と、不要検索 / timeout 改善。
5. セラー一覧のDB側ページング・集計の改善。同型の記録 / ノート / マイドリンク一覧も対象。
6. 計測で必要性が確認された場合だけ、段階的AI補完と一覧用画像を追加する。

元の不具合と追加要件をすべて完了報告に含め、性能改善は変更前後の測定条件と数字を添える。実測していない効果を断定しない。

## 13. 初回調査稿からの主な訂正

実装エージェントが旧稿のまま進めると誤る点。

1. 調査SHA `b6b239e` は現行 `main` より4コミット古い。中核は同じだが、写真日次80枚を見落としている。
2. wrangler の本番env名は `production` であり `prod` ではない。
3. `AGENTS.md` は存在しない。
4. AI OFF はセラーだけ。記録・ノートにOFFは無い。
5. 撮影先行handoffは未接続。保護対象の正規経路ではない。
6. `useNotePhotos.inheritFrom` は無条件upsertではない。
7. フォーム内ボトル選択の写真引き継ぎ抜けは確認済み。
8. 読み取り専用の記録詳細は無く、入口は `LogEditForm`。
9. `forget*Recognition` は本番未使用。
10. 記録取り込みは `PhotoEdit` / `applyProcessed` を通らない。
11. キャッシュと lookup は drink（Gemini）だけ。
12. 「profileを揃える」と「モデル移行しない」は、resolverの揃えでありモデルIDの統一ではない。
13. `bottleId` 時の品名・種類上書きは現行仕様。スナップショット維持は仕様変更。
14. 空欄originの省略はボトルfallbackを起こし得る。
15. 記録 / ノート / マイドリンク一覧も全件取得+slice。
16. `countsByType` は `q` / `drinkType` を含まない。
17. `lookupTimeoutMs` の現行値は20秒で、短い検索予算ではない。
18. 国名セレクトとセラー編集時解析は新規UI / 新規仕様である。
