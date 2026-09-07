# テイスティングノート（tasting-note）

Phase 5-01 の成果物。テイスティングノート（作成・編集・削除・写真グリッド一覧・詳細・セラー連携）の **機能仕様**。5-02〜5-05 の実装はこのファイルと画面設計のとおりに作る。

- 状態: **レビュー待ち**（5-01。オーナー承認後に 5-02 着手）
- 要件: [01-requirements.md](../01-requirements.md) 1.4 / 1.5 / 1.6
- 画面の正本: [screen-designs/05-notes.md](../screen-designs/05-notes.md)。ボトル詳細のノート節は [screen-designs/04-cellar.md](../screen-designs/04-cellar.md) T6。**要素表・状態・遷移・モックは画面設計が正**。本ファイルは項目・規則・API・エッジケースを 1 か所にまとめる
- API の正本: [api-design.md](../api-design.md) 4.6 / 4.7。列は [data-model.md](../data-model.md) 5.3 / 5.5 / 5.6 / 6.4 / 6.5
- 写真: [photos.md](photos.md) / [screen-designs/07-photo-capture.md](../screen-designs/07-photo-capture.md)。**新しいアップロード API は作らない**（2-08 の `POST /api/photos` を再利用）
- セラー連携: [cellar.md](cellar.md) 3.4 T6 / 3.7。ピッカーは `GET /api/bottles?view=all&q=`
- ロードマップ: [roadmap/phase-05-tasting-note/](../../roadmap/phase-05-tasting-note/00-phase.md)

---

## 1. 目的

3 つ目のコア機能。体験は **写真を撮って、評価と一言を付ける**。外観 / 香り / 味わい / 余韻の 4 欄はあとから書ける。セラーのボトル（貯蔵庫含む）に紐づけて参照できる。

| ゴール | 内容 |
|---|---|
| 最短作成 | 評価を選び、銘柄（ボトル or 手入力）を入れて保存。写真・4 欄は任意 |
| 写真付き | 一覧の「+」→ 撮影（4:5 / `table` / キャラ合成トグル）→ 評価 → 保存。最大 6 枚 |
| 一覧 | 2 列の写真グリッド。銘柄・種類・評価で絞り込み |
| セラー | ボトル詳細のノート節から一覧・作成。作成時にボトルを選べる（貯蔵庫含む） |

### 対象外（本フェーズで作らない）

| 項目 | 時期 |
|---|---|
| 種類別の評価テンプレート（ワイン用・ウイスキー用の評価軸プリセット） | v1.x |
| ノート作成時の飲酒記録同時作成 | v1.x（[01-requirements.md](../01-requirements.md) 1.5） |
| SNS 共有 | 対象外 |
| 写真パイプライン本体（撮影・編集・合成・`POST /api/photos`・未紐付け GC） | 2-08 済み。本フェーズは呼び出しと `photoIds` 紐付け、複数枚 UI |
| ボトル CRUD / 棚 / 開栓 | Phase 4。本フェーズは参照とピッカーのみ |
| 記録・ノート写真の AI 推定 | v1.x |
| 並び替え DnD | 作らない。MVP は「先頭にする」メニュー |
| Idempotency-Key | 見送り（ボタン disable。[api-design.md](../api-design.md) 7 章） |
| E2E（ボトル登録→ノート作成） | Phase 6-02 |

---

## 2. 用語

| 用語 | 意味 |
|---|---|
| ノート | `tasting_notes` の 1 行。1 行 = 1 回のテイスティング |
| スナップショット | `drink_name` / `drink_type`。ボトル選択時にサーバーがボトルからコピーし、以降ボトルを改名してもノートは当時の値を保持する |
| 都度入力 | `bottle_id` が NULL。銘柄名・種類を手入力する |
| 評価（`ratingX10`） | 総合評価。UI は 1.0〜5.0 の 0.5 刻み。保存・API は整数 **10〜50・5 刻み**。表示は `/ 10` |
| 一言 | **`taste` 列そのもの**の 1 行表示。別列は作らない。折りたたみを開くと複数行 Textarea になる |
| 4 欄 | 外観 `appearance` / 香り `aroma` / 味わい `taste` / 余韻 `finish`。すべて任意。各 ≦2000 |
| 飲んだ日（`tastedOn`） | Asia/Tokyo のカレンダー日（`YYYY-MM-DD`）。時刻は持たない |
| 先頭写真 | `photos.sort_order` が最小の 1 枚。一覧の `thumbPhotoId` |
| ボトルピッカー | `GET /api/bottles?view=all&q=`。棚（`sealed`）と貯蔵庫（`consumed`）の両方 |

---

## 3. 画面と項目

画面 ID・ルート・タブ・ヘッダー文言は [screens.md](../screens.md) と [05-notes.md](../screen-designs/05-notes.md) に従う。要素番号（L1 / N1 / V1 …）は画面設計と同じ。

### 3.1 `note-list` ノート一覧（`/notes?bottleId=&q=&drinkType=&ratingX10Min=`）

親タブはノート。入口は下部タブ「ノート」、詳細の戻り、ボトル詳細 T6「すべて（N）›」。

| # | 項目 | 内容 | データ |
|---|---|---|---|
| L1 | 検索 | Chip → Input。銘柄（**スナップショット**）の部分一致。300ms デバウンス。最大 100 文字 | `q` |
| L2 | 種類 | Chip「種類 ▼」→ 7 種ダイアログ。単一選択。選択中は「ワイン ×」 | `drinkType` |
| L3 | 評価 | Chip「★4 以上」。トグル。ON で `ratingX10Min=40`。OFF でクエリを外す。`ratingX10Max` は UI に置かない | `ratingX10Min` |
| L4 | カード | 2 列グリッド、間隔 16px。写真 4:5（列幅 ≒165px → 165×206）。`thumbPhotoId` を `<img loading="lazy">`。**写真に文字を重ねない** | `items[]` |
| L5 | 写真なし | inset タイル 4:5。中央に種類アイコン 32px muted | `drinkType` |
| L6 | 名前 / 評価 / 日付 | 名前 14px/600・1 行省略。「★4.5 ・ 8/1」。写真 2 枚以上は日付の右に `images` アイコン + `photoCount` | `drinkName`, `ratingX10`, `tastedOn`, `photoCount` |
| L7 | カードタップ | `/notes/:noteId` | — |
| L8 | `bottleId` 指定時 | ヘッダーは ← + 銘柄名（ボトル詳細へ戻る）。一覧はそのボトルのみ。「作成」は `bottleId` を引き継ぐ（`/notes/new?bottleId=&camera=1`） | `GET /api/tasting-notes?bottleId=` |
| — | 作成 | ヘッダー右 `plus` → `/notes/new?camera=1`（`bottleId` があれば引き継ぐ） | — |

- `q` / `drinkType` / `ratingX10Min` / `bottleId` は URL に載せ、再訪で残す。空の `q` と OFF の評価チップは付けない
- 並びは API 既定（`tastedOn` 降順、同値は `id` 降順）。クライアントで並べ替えない
- 件数が `limit` を超えたら下端で `nextCursor` を辿る（`limit` 既定 50）
- `?ratingX10Min=` が 40 以外の合法値でも API は受け付ける。UI チップは 40 のトグルだけ
- `?ratingX10Max=` は UI に出さない（API は受け付ける）

| 状態 | 表示 |
|---|---|
| ローディング | 4:5 の枠 ×4（静止。到着で M-29） |
| 空（フィルタなし 0 件） | キャラ `default` 96px +「テイスティングノートはまだありません。撮って一言から」+ Button 主「作成」。初回描画で 1 回現れる（M-26 / M-27） |
| フィルタ 0 | 「該当するノートがありません」+「フィルタを解除」（キャラなし） |
| `bottleId` が他人 / 不在 / 不正 | `not-found`（空配列にしない） |
| エラー | 「読み込めませんでした」+ 再試行 |

`bottleId` 指定かつフィルタなし 0 件は、空状態の「作成」が `bottleId` を引き継ぐ。

### 3.2 `note-new` ノートを作成（`/notes/new?bottleId=&camera=1`）

タブバーは隠す。入口は L の「+」、ボトル詳細 T6「書く ›」/ 貯蔵庫詳細 T3「ノートを書く」。ディープリンクでも `?camera=1` が無くてもフォームは開く。

目的: **写真を撮って、評価と一言を付ける**。4 欄は折りたたみ。

| # | 項目 | 入力 | 初期値 | 規則 |
|---|---|---|---|---|
| N1 | 写真ストリップ | 「撮る」タイル + サムネ 96×120 × 最大 6。横スクロール。先頭は撮るタイル | なし | 「撮る」→ `photo-edit`（4:5、`table`、**キャラ合成トグルあり**）。「使う」直後に未紐付け `POST /api/photos`。`?camera=1` ならマウント直後に開く（× でフォームへ）。7 枚目は撮るタイルを無効化し「写真は 6 枚までです」 |
| — | サムネ操作 | タップ → 編集 / 削除。長押し並び替えの代わりに「先頭にする」 | — | 「編集」は元 Blob から再編集（旧 id は `DELETE` して新規アップロード）。「削除」は未保存なら即 `DELETE /api/photos/:id`。「先頭にする」はクライアント配列の先頭へ移す（保存時の `photoIds` 順 = `sortOrder`） |
| N2 | ボトル | 行「選ぶ ›」→ ダイアログ（検索 + 棚サムネ行、貯蔵庫含む） | `?bottleId=` があれば事前選択 | 選択で銘柄名・種類を **表示**（手入力欄は隠す）。行ラベルは棚なら「銘柄（セラー）」、貯蔵庫なら「銘柄（貯蔵庫）」。× で解除し都度入力へ |
| N3 | 銘柄名 / 種類 | Input + Chip ×7 | 空 / なし | **ボトル未選択時のみ表示・必須**。銘柄 1〜100。種類は 7 種 |
| N4 | 飲んだ日 | 行 → ネイティブ `date` | 今日（JST） | `YYYY-MM-DD`。今日は可。**未来不可**。端末 TZ に依存しない |
| N5 | 評価 | 星 5 + 数値 + ステッパー | **未選択** | 1.0〜5.0、0.5 刻み。星タップは整数（1〜5）。± は 0.5。0 / 0.5 / 5.5 は不可。保存に必須 |
| N6 | 一言 | Input（1 行） | 空 | **`taste` そのもの**。別列は作らない。任意 |
| N7 | 詳しく書く | 折りたたみ | 閉じる | 開くと `taste` が複数行 Textarea に広がり、外観 / 香り / 余韻の Textarea が並ぶ。各 ≦2000。残数表示 |
| N8 | 保存する | Button 主（固定バー） | 無効 | 無効: 評価未選択 / 銘柄名空（ボトル未選択時） / 種類未選択（ボトル未選択時） / 飲んだ日が不正・未来 / 写真アップロード中・失敗中 / 保存中 |

- 写真なし・4 欄空でも、評価と銘柄（またはボトル）があれば保存できる
- 成功: 作成した `note-detail` へ即 `replace`（N8 は M-04 水位線 / M-05 即遷移 / M-06 失敗の戻し）。トースト「保存しました」（`cheer` + 水面 M-25）。`haptic("success")`。undo は置かない
- 失敗: フォーム上部にインライン汎用文（オフラインなら X4）。入力は保持
- 戻る（未保存）: 入力を触っていれば確認「入力を破棄しますか」。破棄時、未紐付け写真をすべて `DELETE /api/photos/:id`。失敗しても 24h GC
- 戻り先: 履歴があれば戻る。無ければ（ディープリンク）`/notes`（`bottleId` があればそれを維持）
- モーションは共通部品だけ（押下 M-01 / M-02、チップ M-31、ダイアログ M-13 / M-30、トースト M-23〜M-25）。**ノート固有の演出は置かない**
- キャラクター: 空状態と保存トーストのみ。フォーム上には出さない（撮影プレビューの合成は `photo-edit`）

### 3.3 `note-detail` ノート詳細（`/notes/:noteId`）

親タブはノート。入口は一覧カード、ボトル詳細 T6 の行。

| # | 項目 | 内容 | API |
|---|---|---|---|
| V1 | 写真カルーセル | 幅一杯 4:5（350×437）、`scroll-snap`、ドット。タップで全画面。写真なしはカルーセル自体を出さない | `photos[]`（`sortOrder` 昇順） |
| V2 | 評価 + 日付 | 星（塗り = `--primary`）+ 数値 +「2026年8月1日」 | `ratingX10`, `tastedOn` |
| V3 | ボトル行 | `bottle` があれば「🍾 セラーのボトル ›」または「🍾 貯蔵庫のボトル ›」→ `/cellar/:bottleId`。削除済み（`bottle === null`）なら行を出さない | `bottle` |
| V4 | 4 欄 | 見出し 13px muted + 本文 16px。**値のある欄だけ**。順は **外観 / 香り / 味わい / 余韻**。すべて空なら「まだ書いていません」 | `appearance`, `aroma`, `taste`, `finish` |
| V5 | 編集 | ヘッダー右 → `/notes/:noteId/edit` | — |

- ヘッダー左は戻る、中央は銘柄名（スナップショット）
- 4 欄の本文はテキスト描画。`white-space: pre-wrap`。URL 化しない
- キャラクターは出さない
- 他人・不在の `:noteId` は `not-found`

戻り先: 履歴。無ければ `/notes`（来た一覧が `bottleId` 付きならそれを維持）

### 3.4 `note-edit` ノートを編集（`/notes/:noteId/edit`）

`note-new` と同じレイアウト。タブバーは隠す。差分:

| 項目 | 規則 |
|---|---|
| 初期値 | `GET /api/tasting-notes/:id`。写真は `photos[]` の順。ボトルがあれば N2 の選択済み行 |
| 保存 | `PATCH /api/tasting-notes/:id` に **変えたフィールドのみ**。空オブジェクトは 400。成功 → 詳細。トースト「保存しました」（`cheer` + M-25） |
| 写真 | 追加（未紐付け → 保存時 `photoIds`）、削除（未保存の新規は即 `DELETE`。既存は保存時の差し替えで外す）、先頭化（配列を組み替え）。合計 ≦6 |
| `photoIds` | 差し替え（送った集合・配列順が正。外れた写真は R2 も削除） |
| ボトル解除 | × → 都度入力。`drinkName` / `drinkType` 必須。`PATCH { bottleId: null, drinkName, drinkType }` |
| ボトル付け替え | 新しいボトルも自分のもの。スナップショットは **新しいボトルから再コピー**（手入力の銘柄は捨てる） |
| 削除 | 保存バー下「このノートを削除」→ 確認ダイアログ（danger。キャラなし）→ `DELETE /api/tasting-notes/:id` → 一覧（`bottleId` クエリは維持しない。ノートタブの `/notes`）。トースト「削除しました」（undo なし） |
| 404 | 他人・不在の `:noteId` は `not-found` |

### 3.5 ボトル詳細のノート節（5-04。`bottle-detail` T6）

正本は [04-cellar.md](../screen-designs/04-cellar.md) T6 / [cellar.md](cellar.md) 3.4。4-02 では **出さない**。5-04 で出す。

| 項目 | 規則 |
|---|---|
| 見出し | 「ノート」右に「書く ›」→ `/notes/new?bottleId=<id>&camera=1` |
| 行 | 最新 3 件（`tastedOn` 降順）。「日付  ★4.5 ›」→ `/notes/:noteId` |
| すべて | 「すべて（N）›」→ `/notes?bottleId=`。N は `totalCount`（そのボトルの総数。フィルタ前） |
| 0 件 | 行は出さず、見出し +「書く ›」は出す（記録節 T7 が 0 件で節ごと消すのと違う） |
| 貯蔵庫 | T3 の主ボタンが「ノートを書く」（4-03 済み）。着地は同じ `note-new?bottleId=&camera=1` |

他人の `:bottleId` で詳細を開いた時点で `not-found` なので、ノート節が他人のノートを見ることはない。

### 3.6 日付の扱い

| 項目 | 規則 |
|---|---|
| `tastedOn` | Asia/Tokyo の `YYYY-MM-DD`。未来は不可（今日は可）。端末 TZ に依存しない |
| 一覧の短い日付 | `M/D`（例 `8/1`）。年は出さない（今年前提の個人利用） |
| 詳細の日付 | `YYYY年M月D日`（例 `2026年8月1日`） |
| `createdAt` / `updatedAt` | UTC ISO。画面の主表示には使わない |

---

## 4. バリデーションとエラー文

Zod は `src/shared` に置き、クライアント（即時表示）とサーバー（`@hono/zod-validator`。最終判定）で同じスキーマを使う。サーバーの 400 は `{ "error": "validation_error", "fields": { "<field>": ["<文>"] } }`（[api-design.md](../api-design.md) 2.6）。

評価は **整数 `ratingX10`** だけを送受信する。float の 1.0〜5.0 は API に置かない（比較が脆いため）。

### 4.1 作成・更新（`POST` / `PATCH /api/tasting-notes`）

| フィールド | 規則 | エラー文 |
|---|---|---|
| `ratingX10` | 整数 10〜50、**5 の倍数**。POST 必須 | 欠け・範囲外・刻み不正は「評価を選んでください」 |
| `tastedOn` | `YYYY-MM-DD` かつ暦上存在する日。POST 必須。JST の今日より後は 400 | 形式不正は「日付の形式が正しくありません」。未来は「未来の日付は指定できません」 |
| `bottleId` | UUID。省略可。自分のボトル（`sealed` / `consumed` どちらも可）以外は **404**（400 ではない） | 画面では「ボトルが見つかりません」+ 選択解除 |
| `drinkName` | `bottleId` なしのとき必須。1〜100（trim 後）。`bottleId` ありのときは **送っても無視**し、サーバーがボトル名をコピー | 「1文字以上100文字以内で入力してください」 |
| `drinkType` | `bottleId` なしのとき必須。7 種。`bottleId` ありのときは **送っても無視** | 「種類を選んでください」 |
| `appearance` / `aroma` / `taste` / `finish` | 任意。各 ≦2000。trim 後に空なら `null` | 「2000文字以内で入力してください」 |
| `photoIds` | 配列、**最大 6**。自分の未紐付け写真のみ。他人・紐付け済み・不明は 404。重複 id は 400 | 7 枚以上は「写真は6枚まで添付できます」（キー `photoIds`）。404 は「写真をもう一度撮ってください」 |
| `userId` / `id` / `createdAt` / `drinkName` をボトルありで正とするクライアント計算 | `userId` / `id` は **受け取らない**（未知キー 400）。スナップショットはサーバーが正 | — |

PATCH は全フィールド任意（送ったものだけ更新）。空オブジェクトは 400。

PATCH のボトル:

| 送信 | 規則 |
|---|---|
| `bottleId` を別の自分のボトルへ | スナップショットを **新ボトルから再コピー**。同時に送った `drinkName` / `drinkType` は無視 |
| `bottleId: null` | `drinkName` と `drinkType` が必須。欠けたら 400 |
| `bottleId` を送らない | 既存の紐付きとスナップショットを維持 |

PATCH の `photoIds` は **差し替え**（配列順 = `sortOrder` 0, 1, …）。外れた写真は D1 + R2 から削除。送らない場合は写真を変えない。空配列 `[]` は写真をすべて外して削除する。

### 4.2 クエリ（`GET /api/tasting-notes`）

| クエリ | 規則 | エラー文 |
|---|---|---|
| `bottleId` | UUID。**自分のボトルでなければ 404**（空配列にしない） | — |
| `q` | 最大 100 文字。空は未指定。`drink_name` スナップショットの部分一致 | 「100文字以内で入力してください」 |
| `drinkType` | 7 種 | 「種類を選んでください」 |
| `ratingX10Min` / `ratingX10Max` | 10〜50、5 刻み。両方あるとき `min <= max` | 「評価の範囲が正しくありません」 |
| `limit` | 整数 1〜100（既定 50） | 「件数は1以上100以下で指定してください」 |
| `cursor` | サーバー発行値のみ。改ざんは 400 | 「ページ情報が正しくありません」 |

検索の SQL:

- Drizzle のプレースホルダのみ。文字列結合禁止
- `%` と `_` はエスケープ（リテラルとして探す）
- 大文字小文字は SQLite 既定（ASCII のみ不区別）。日本語の正規化はしない

### 4.3 クライアント側の表示

- 範囲外はフィールド直下にインライン表示し、N8 を無効にする（サーバーを叩かない）
- サーバー 400 は `fields` のキーで該当欄へ、キー `""` はフォーム上部の汎用文
- 404（ボトル / 写真）: 作成・編集では該当欄の文言 + 選択解除。`:noteId` / 一覧の `?bottleId=` の 404 は `not-found`
- 401 は `RequireAuth`

---

## 5. 評価（`ratingX10`）

正本は [data-model.md](../data-model.md) 5.5。**本ファイルに差分はない**。float で保存・比較しない。

| UI | 保存・API | 可否 |
|---|---|---|
| 1.0 | 10 | 可（下限） |
| 1.5 | 15 | 可 |
| … | … | |
| 4.0 | 40 | 可（一覧チップ「★4 以上」の閾値） |
| 5.0 | 50 | 可（上限） |
| 未選択 | 送らない | 保存不可 |
| 0 / 0.5 | — | 不可 |
| 3.3 / 5.1 / 11 | — | 不可（400） |

- 表示は `ratingX10 / 10`。一覧・詳細は小数第 1 位まで出す（`4.0` / `4.5`）
- 星の塗り: `floor(ratingX10 / 10)` 個を `--primary`。0.5 のときは次の星を半分（または同等の見た目）
- 星タップ: 整数 1〜5（`ratingX10 = 10 * n`）。すでにその整数のとき、タップし直しても 0 にはしない（未選択へ戻さない。クリアはしない）
- ステッパー −: `ratingX10 -= 5`（下限 10）。未選択からの − は 10（1.0）にする
- ステッパー +: `ratingX10 += 5`（上限 50）。未選択からの + は 10（1.0）にする
- 共有ヘルパ（5-02 で `src/shared`）: `RATING_X10_MIN = 10` / `MAX = 50` / `STEP = 5`、`isValidRatingX10`、`formatRatingX10`（`"4.5"`）
- Zod は `.int().min(10).max(50).refine(n => n % 5 === 0)`。`.multipleOf(0.5)` を float に使わない

---

## 6. 写真

正本は [photos.md](photos.md) と [07-photo-capture.md](../screen-designs/07-photo-capture.md)。**解像度・MIME・GC の数値を本ファイルで変えない**。ノート固有だけ書く。

| 項目 | 値 |
|---|---|
| 枚数 | ノートあたり **最大 6**（任意。0 枚可）。7 枚目は 400 |
| 比率 | 4:5 |
| プリセット | `table`（既定 ON。設定 S4 と同じ `photo.filter`） |
| キャラ合成 | **あり**（トグル出す。既定 ON。`photo.mascot`）。右下 `surprised` |
| 切り抜き（背景除去） | **しない**（セラーのみ） |
| 出力 | JPEG・長辺 1280・品質 0.82。`kind = photo` |
| サーバー | magic bytes、1MB、長辺 1600、キーはサーバー生成、配信は認可付き GET |
| 未紐付け | 「使う」直後。24h GC |
| 並び | `photoIds` の配列順 = `sortOrder`（0 が先頭 = 一覧サムネ） |
| 所有者 | `photos.tasting_note_id`。`bottle_id` / `drink_log_id` と同時に持たない（CHECK） |

推奨フロー（2-08 / api-design 確定）:

1. `photo-edit` → 「使う」→ 未紐付け `POST /api/photos`（`tastingNoteId` は送らない）
2. フォームが id を配列で保持
3. ノート保存時に `photoIds` を同一トランザクションで紐付け
4. 未保存で破棄したら `DELETE /api/photos/:id`

同時アップロードで 7 枚目がレースした場合、サーバーが紐付け時に **既存 + 今回** を数えて 6 超なら 400（SQLite の同一トランザクション）。クライアントは撮るタイルを 6 枚で止める。

新しい `/api/upload-public` は作らない。4-04 / 2-08 のルートを再利用するだけ。

---

## 7. セラー連携

| 場面 | 規則 |
|---|---|
| 作成・編集のピッカー | `GET /api/bottles?view=all&q=`（貯蔵庫含む）。検索必須（全件ロードしない）。行はサムネ + 銘柄。`consumed` は muted「貯蔵庫」 |
| `?bottleId=` | 事前選択。自分のボトルでなければ作成画面は `not-found`（フォームを出してからエラーにしない） |
| サーバー作成 | `bottleId` が自分のボトルでなければ 404 で **ノートを作らない**。`drinkName` / `drinkType` はボトルからコピー |
| ボトル改名 | 既存ノートのスナップショットは **変わらない**。一覧・詳細はノート側の名前を出す |
| ボトル削除 | `tasting_notes.bottle_id` は SET NULL。ノートとスナップショットと写真は残る。V3 は出さない |
| 開栓 / 復元 | ノートは作らない・消さない・付け替えない |
| ボトル詳細 T6 | 5-04。`GET /api/tasting-notes?bottleId=&limit=3`。`totalCount` を「すべて（N）」に使う |
| 記録の同時作成 | **しない**（v1.x） |

ピッカー部品は `log-new` のボトル行（4-02）と共通化してよい。ノート側は選択時に量・度数を持たない（ボトルにも量は無い）。

---

## 8. API 対応表

契約の正本は [api-design.md](../api-design.md) 4.6。本ファイルは画面との対応と、一覧応答の形を補足する。

| 画面・操作 | API | 実装タスク |
|---|---|---|
| 一覧 | `GET /api/tasting-notes?q=&drinkType=&ratingX10Min=&bottleId=&limit=&cursor=` | 5-02 |
| 作成 | `POST /api/tasting-notes`（`photoIds`, `bottleId`） | 5-02（`photoIds` 空配列可）。複数枚 UI は 5-03 |
| 詳細 / 編集初期値 | `GET /api/tasting-notes/:id` | 5-02 |
| 編集保存 | `PATCH /api/tasting-notes/:id` | 5-02 |
| 削除 | `DELETE /api/tasting-notes/:id` | 5-02 |
| 写真（撮る / 破棄 / 配信） | `POST` / `DELETE` / `GET /api/photos/:id/content`（2-08 済み） | 5-03（呼び出しとストリップ / カルーセル） |
| ボトルピッカー | `GET /api/bottles?view=all&q=`（4-02 済み） | 5-04（ノート作成への接続） |
| ボトル詳細のノート節 | `GET /api/tasting-notes?bottleId=&limit=3` | 5-04 |

### 8.1 一覧応答（補足）

```
{
  items: TastingNoteListItem[],
  nextCursor: string | null,
  totalCount: number
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | |
| `drinkName` | string | スナップショット |
| `drinkType` | 7 種 | スナップショット（写真なしタイルのアイコン） |
| `tastedOn` | `YYYY-MM-DD` | |
| `ratingX10` | number | 10〜50 |
| `bottleId` | string \| null | 削除後は null |
| `thumbPhotoId` | string \| null | `sortOrder` 最小。無ければ null |
| `photoCount` | number | 0〜6 |
| `createdAt` / `updatedAt` | string | UTC ISO |

`totalCount` は **フィルタ前**の件数。`bottleId` 指定時はそのボトルの総数（T6 の N）。`q` / `drinkType` / `ratingX10Min` は掛けない。

### 8.2 詳細・作成・更新応答（補足）

data-model 6.4 の列 + `photos` メタ配列（`sortOrder` 昇順、最大 6）+ `bottle`。

| フィールド | 型 | 説明 |
|---|---|---|
| `bottle` | `{ id, name, status } \| null` | `bottleId` がありボトルが残っているとき。`status` は `sealed` \| `consumed`（V3 の文言）。削除済みは null |
| `photos` | 4.7 のメタ配列 | `r2Key` / `userId` は出さない |

成功: POST は 201、GET / PATCH は 200。DELETE は 200 `{ ok: true }`（他リソースと同じ）。

### 8.3 サーバー側の規則

- 全エンドポイント認証必須。`c.get("user").id` のみでスコープ。Zod に `userId` を置かない
- 更新・削除は `id AND user_id`。他人・不在は同じ 404 本文。403 は使わない
- `bottleId` / `photoIds` が他人なら 404 で **作成・更新しない**（トランザクション内で確認）
- `POST` / `PATCH` の `photoIds` 紐付けは同一トランザクション（D1 batch）
- `DELETE /api/tasting-notes/:id` は写真 CASCADE + R2 削除（失敗分は日次 GC）
- 一覧は `user_id = session` を必ず付ける。`bottleId` 指定時は先に自分のボトル存在を確認し、無ければ 404
- 検索 `LIKE` はプレースホルダ + `%` `_` エスケープ
- スナップショットはサーバーがボトルからコピーする。クライアントの `drinkName` / `drinkType` はボトルありでは採用しない

---

## 9. エッジケース

| # | ケース | 振る舞い |
|---|---|---|
| E1 | 写真なし・4 欄空で保存 | 可。一覧は種類アイコン。詳細はカルーセルなし +「まだ書いていません」 |
| E2 | 一言だけ書いて折りたたみは閉じたまま | `taste` に保存。詳細は「味わい」として出す（外観・香り・余韻が空なら味わいだけ） |
| E3 | 4 欄に HTML / スクリプト | テキスト描画。`dangerouslySetInnerHTML` 禁止。URL 化しない |
| E4 | 4 欄が空白のみ | trim 後に空なら `null`。詳細では出さない |
| E5 | 評価未選択で保存 | N8 無効。サーバーに届いたら 400 |
| E6 | 評価 3.3 / 5.1 / 0 / 11 | 400「評価を選んでください」 |
| E7 | 飲んだ日が未来 | N8 無効 + 400 |
| E8 | 飲んだ日が不正（`2026-02-30`） | 400「日付の形式が正しくありません」 |
| E9 | ボトル未選択で銘柄空 | N8 無効。種類だけ選んでも保存不可 |
| E10 | ボトル選択時に銘柄を送る | 無視。サーバーがボトル名をコピー |
| E11 | 他人 / 不明の `bottleId` で POST | 404。ノートは作らない |
| E12 | `?bottleId=` が他人 / 不在 | `note-new` / `note-list` とも `not-found` |
| E13 | ボトルを改名したあと古いノートを開く | ノートのスナップショットのまま。V3 のリンク先ボトル名は現在名でも可（行ラベルは「セラーのボトル」） |
| E14 | ボトル削除後のノート | `bottleId` SET NULL。一覧・詳細の銘柄はスナップショット。V3 なし |
| E15 | 貯蔵庫のボトルを選ぶ | 可。行は「銘柄（貯蔵庫）」。開栓はノートを作らない |
| E16 | 開栓してもノートは増えない | 仕様どおり |
| E17 | 写真 6 枚 | 撮るタイル無効 +「写真は 6 枚までです」 |
| E18 | 写真 7 枚目（API） | 400（`fields.photoIds`） |
| E19 | 他人の `photoId` を紐付け | 404。ノートは作らない / 更新しない |
| E20 | すでに他リソースへ紐付いた `photoId` | 404（または 400。存在漏洩を避けるなら 404）。紐付けない |
| E21 | `photoIds` 差し替えで外れた写真 | D1 + R2 削除 |
| E22 | 未保存で戻る（写真あり） | 確認 → 破棄で各 id を `DELETE`。失敗しても 24h GC |
| E23 | 写真アップロード中に保存 | N8 無効 |
| E24 | 写真アップロード失敗 | サムネ「!」+ 再試行。その枚を消せば残枚で進める |
| E25 | 同時アップロードの 7 枚レース | サーバーが件数を見て 400。クライアントは 6 で止める |
| E26 | 「先頭にする」 | 配列の先頭へ。保存まで DB は変わらなくてよい（編集の既存写真も、保存時 `photoIds` で確定） |
| E27 | 二重タップ（保存 / 削除） | ボタンを応答まで無効。Idempotency-Key は持たない |
| E28 | 他人の `:noteId` | GET / PATCH / DELETE とも 404。一覧に混ざらない |
| E29 | 検索 `%` `_` | ワイルドカードにせずリテラル一致 |
| E30 | `?ratingX10Min=40` と種類を同時指定 | AND。両方に合う行だけ |
| E31 | 不正な `:noteId` | `not-found` |
| E32 | セッション切れ | `RequireAuth`。入力は失われる（MVP） |
| E33 | 同名のノート | 許可（ユーザー内ユニークにしない） |
| E34 | 同じボトルに複数ノート | 許可。T6 は新しい 3 件 |
| E35 | 一覧 51 件目 | `nextCursor`。下端で追加取得 |
| E36 | `camera=1` で撮影キャンセル | フォームは残る。写真 0 枚のまま進められる |

---

## 10. セキュリティ

正本は [`.cursor/rules/security.mdc`](../../.cursor/rules/security.mdc) と [api-design.md](../api-design.md) 2 章。

| 観点 | 規則 |
|---|---|
| 認可 | 全 API はセッションの `user.id`。`userId` をクエリ・ボディに置かない。他人・不在は 404 同一本文。403 は使わない |
| 参照 ID | `bottleId` / `photoIds` は自分のもののみ。他人なら 404 で作成せず、存在を漏らさない |
| 一覧の `bottleId` | 他人のボトルなら **404**（空配列にしない。件数 0 で存在を推測させない） |
| スナップショット | ボトルありではクライアントの銘柄・種類を採用しない（改ざん防止） |
| 入力検証 | Zod。評価 10〜50 の 5 刻み、銘柄 1〜100、4 欄 ≦2000、`photoIds` ≦6、`tastedOn` 暦日、`limit` ≦100 |
| XSS | 銘柄・4 欄はテキスト。`dangerouslySetInnerHTML` 禁止。URL 化しない |
| SQL | Drizzle のみ。`LIKE` はプレースホルダ。`%` `_` をエスケープ |
| 写真 | magic bytes・1MB・キー生成・配信認可は 2-08 のまま。紐付け時も `photos.user_id === session` |
| エラー | 400 の `fields` に内部パスを出さない。500 はスタックを出さない |
| ログ | 4 欄本文・写真をサーバーログに出さない（メソッドとパスだけ） |
| レート制限 | アプリ全体は Phase 8。本フェーズはボタン disable のみ |

---

## 11. 決定事項（本仕様で確定した「要確認」）

ロードマップ 5-01〜5-05 と [01-spec-tasting-note.md](../../roadmap/phase-05-tasting-note/01-spec-tasting-note.md) に残っていた判断を以下のとおり確定する。異議があれば本 PR のレビューで指摘する。

| 出典 | 項目 | 決定 | 根拠 |
|---|---|---|---|
| 5-01 | 評価の内部表現 | **`ratingX10` 整数 10〜50、5 刻み**。API に float を置かない | [data-model.md](../data-model.md) 5.5。float 比較を避ける |
| 5-01 | 1.0 未満（0 / 0.5） | **不可**。下限は 1.0（10） | data-model 5.5、画面バリデーション「10〜50」 |
| 5-01 | 評価 UI | **星 5 + 数値 + ステッパー**。星タップは整数、± は 0.5。どちらか一方にはしない | [05-notes.md](../screen-designs/05-notes.md) N5 |
| 5-01 | 評価の既定 | **未選択**（3.0 などを入れない）。保存必須 | 同上 |
| 5-01 | ボトル未選択時 | `drinkName`（1〜100）と `drinkType`（7 種）が **必須**。`bottleId` は null | data-model 6.4、N3 |
| 5-01 | スナップショット vs 参照 | **スナップショット**。サーバーがボトルから `drink_name` / `drink_type` をコピー。改名は追従しない。一覧検索もスナップショット | data-model 6.4、api-design 4.6 |
| 5-01 | 写真枚数 | **最大 6**（0 枚可） | 2026-09-05 オーナー決定、data-model 5.6 |
| 5-01 | 検索 | 銘柄スナップショット部分一致（`q`）+ 種類単一（`drinkType`）+「★4 以上」（`ratingX10Min=40`）。AND | 05-notes L1〜L3 |
| 5-01 | 一覧のデフォルト順 | **`tastedOn` 降順、同値は `id` 降順** | api-design 2.7 |
| 5-01 | 4 欄の最大長 | **各 ≦2000**。trim 後空は `null` | data-model 5.6 / 6.4 |
| 本仕様 | 一言の「≦200」 | 画面モックの推奨であり **API 上限ではない**。`taste` は 4 欄と同じ ≦2000。1 行 Input でも同じ列 | 要素表 N6 とバリデーション表が食い違うときはバリデーション + data-model が正 |
| 本仕様 | 詳細の 4 欄の順 | **外観 / 香り / 味わい / 余韻**。空欄は出さない | 05-notes V4（N6「詳細で先頭」は一言 = taste の意味） |
| 5-04 | ピッカーに飲み切り | **含める**（`view=all`）。テイスティングは開栓後も書く | 04-cellar T3 貯蔵庫「ノートを書く」、cellar E39 |
| 5-04 | 他人 `bottleId` の一覧 | **404**（空配列にしない） | api-design 4.6 |
| 5-04 | ボトル削除後 | ノートは残す。`bottle_id` SET NULL。V3 非表示 | data-model 削除方針 |
| 4-02 / 5-04 | ボトル詳細 T6 | **5-04 で出す**。0 件でも見出し +「書く ›」は出す | cellar 3.4 / 10 章 |
| 本仕様 | 保存の undo | **置かない**（記録の 5 秒 undo とは違う）。削除は確認のみ | 05-notes 成功トーストに取り消すが無い |
| 本仕様 | 二重 POST | 持たない。ボタン disable | api-design 7 章 |
| 本仕様 | 一覧 `totalCount` | フィルタ前。`bottleId` 時はそのボトルの総数（T6 の N） | 04-cellar T6 |
| 本仕様 | 詳細の `bottle` | `{ id, name, status } \| null` を埋め込む | V3 の「セラーの / 貯蔵庫の」 |
| 本仕様 | 写真なし作成 | 可 | 要件 1.4「写真は任意」 |
| 本仕様 | `datetime` ではなく日だけ | `tastedOn` のみ。時刻は持たない | data-model 6.4 |

未決事項は **残さない**。上表以外に判断が必要になったら、本ファイルを更新して承認を得てから実装する。

---

## 12. 実装タスクとの対応

| タスク | 本ファイルの節 | 画面設計 |
|---|---|---|
| 5-01 本仕様 | 全体 | — |
| 5-02 ノート CRUD | 3.1〜3.4（写真 UI は仮で 0 枚でも可）/ 4 / 5 / 8 | `note-list` / `note-new` / `note-detail` / `note-edit` |
| 5-03 写真複数枚 | 3.2 N1 / 3.3 V1 / 6 | N1、V1、07-photo-capture |
| 5-04 セラー連携 | 3.5 / 7 | 04-cellar T6、N2 ピッカー |
| 5-05 テスト総仕上げ | 4 / 9 / 10 / 14 | 各受け入れ。抜けは本タスク |

推奨順は 01（承認）→ 02（写真・ボトル ID は任意で保存できる状態）→ 03 → 04 → 05（[00-phase.md](../../roadmap/phase-05-tasting-note/00-phase.md)）。03 と 04 はどちらも 02 依存。各実装 PR は [05-notes.md](../screen-designs/05-notes.md) の **受け入れチェックを本文に貼る**。5-04 は 04-cellar のノート節項目も貼る。

5-02 の API は最初から `photoIds: []` と任意の `bottleId` を受け付ける。UI の完成度だけを 03 / 04 に分ける。

モーションの正本は [motion-design.md](../motion-design.md)。ノート固有の `M-xx` は足さない。

---

## 13. 受け入れ（5-01）

- [x] ファイルが存在し、画面項目・バリデーション・API・連携・写真枚数がある
- [x] [01-requirements.md](../01-requirements.md) 1.4 と矛盾しない（v1.x を混ぜていない）
- [x] 未決を残さず、決定事項を 11 章に列挙した
- [x] Phase 4 / 2-08 の写真基盤を再利用すると明記した（新アップロード API なし）
- [x] 写真の認可方針が [security.mdc](../../.cursor/rules/security.mdc) / [photos.md](photos.md) と矛盾しない
- [x] 実装ファイル（`src/`）を含まない
- [ ] オーナー承認（本 PR のマージをもって承認とする）

---

## 14. 実機チェック（5-05 用。5 行）

実装後にオーナーが確認する最小セット。E2E は Phase 6。

1. 写真なしで評価と銘柄（手入力）を保存し、一覧・詳細で見られる
2. 写真を最大 6 枚付け、7 枚目が不可。詳細でカルーセルが見られる
3. ボトルを選んで保存し、解除して都度入力に戻せる。貯蔵庫の本も選める
4. ボトル詳細のノート節から一覧・作成でき、作成したノートが節に出る
5. 他人のノート URL / `?bottleId=` は `not-found`

---

## 15. 関連

- [01-requirements.md](../01-requirements.md) 1.4 / 1.5
- [api-design.md](../api-design.md) 4.6 / 4.7
- [data-model.md](../data-model.md) 5.5 / 6.4 / 6.5
- [screens.md](../screens.md)、[screen-designs/05-notes.md](../screen-designs/05-notes.md)、[04-cellar.md](../screen-designs/04-cellar.md) T6、[07-photo-capture.md](../screen-designs/07-photo-capture.md)
- [motion-design.md](../motion-design.md)
- [photos.md](photos.md)、[cellar.md](cellar.md) 3.7、[character.md](../character.md)
- [roadmap/phase-05-tasting-note/01-spec-tasting-note.md](../../roadmap/phase-05-tasting-note/01-spec-tasting-note.md)
