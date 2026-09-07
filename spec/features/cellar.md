# セラー（cellar）

Phase 4-01 の成果物。セラー管理（棚・貯蔵庫・追加・詳細・開栓・復元・切り抜き・ラベル読み取り）の **機能仕様**。4-02〜4-07 の実装はこのファイルと画面設計のとおりに作る。

- 状態: **承認済み**（#39 マージ。4-02〜4-07 実装済み。4-05 テスト総仕上げは 2026-09-07）
- 要件: [01-requirements.md](../01-requirements.md) 1.3 / 1.5 / 1.6
- 画面の正本: [screen-designs/04-cellar.md](../screen-designs/04-cellar.md)。**要素表・状態・遷移・モックは画面設計が正**。本ファイルは項目・規則・API・エッジケースを 1 か所にまとめる
- API の正本: [api-design.md](../api-design.md) 4.5 / 4.7。列は [data-model.md](../data-model.md) 5.3 / 5.4 / 6.3 / 6.5 / 6.6
- 写真: [photos.md](photos.md) / [screen-designs/07-photo-capture.md](../screen-designs/07-photo-capture.md)。陳列の描画は画面設計「陳列の写真」
- 記録との紐付け: [drink-log.md](drink-log.md) 3.8（`log-new` のボトル行は **4-02 で有効化**）
- ロードマップ: [roadmap/phase-04-cellar/](../../roadmap/phase-04-cellar/00-phase.md)

---

## 1. 目的

手持ちのボトルを **撮って棚に並べ、開栓で貯蔵庫へ移す**。操作は **追加**と**開栓**の 2 つ。1 杯の記録は作らない。

| ゴール | 内容 |
|---|---|
| 追加 | 「+」→ 撮影（2:3 / `cellar` / 切り抜き既定 ON / キャラなし）→ 確認して「棚に並べる」。本数 N で N 行 |
| 棚 | 地色の上にガラス棚板。切り抜き（または長方形）が立つ。種類ごと / 1 本ずつ |
| 開栓 | 確認なしで貯蔵庫へ。記録は増えない。トースト 5 秒の undo = 復元のみ |
| ラベル | 空欄に候補を入れるだけ。自動保存しない。読めなくても登録は止まらない |

### 対象外（本フェーズで作らない）

| 項目 | 時期 |
|---|---|
| 飲み頃メモ・アラート、在庫金額サマリー | v1.x |
| バーコード・外部銘柄 DB | 対象外（[00-overview.md](../00-overview.md)） |
| Gemini 等の外部 Vision API | v1.x（`LabelRecognizer` の差し替え。送信先の明記と承認が必要） |
| 記録・ノート写真の AI 推定 | v1.x |
| 棚に残す「開栓済み」（`opened`） | 作らない（2026-09-06） |
| 開栓時の記録自動作成 | 作らない（2026-09-06）。1 杯は `log-new` |
| ノート CRUD / ノート節の中身 | Phase 5。4-02 ではノート節を **出さない** |
| 写真パイプライン本体（撮影・編集・`POST /api/photos`・未紐付け GC） | 2-08 済み。本フェーズは呼び出しと `photoIds` 紐付け、切り抜き（4-06）、陳列描画（4-04） |
| 並び替え DnD | 作らない（`createdAt` 降順固定） |
| Idempotency-Key | 見送り（ボタン disable + undo。[api-design.md](../api-design.md) 7 章） |

---

## 2. 用語

| 用語 | 意味 |
|---|---|
| ボトル | `bottles` の 1 行。**1 行 = 1 本**。`quantity` 列は無い |
| 本数 `count` | 登録時だけ送る API 入力（1〜12）。同じ属性・同じ写真元で **N 行**を作る。列には残さない |
| 棚（セラー） | `status = sealed` の在庫。`/cellar`。状態フィルタは持たない |
| 貯蔵庫 | `status = consumed` の開栓済み。`/cellar/archive`。月見出しは `consumedOn` の JST 月 |
| 開栓 | `POST /api/bottles/:id/consume`。`sealed → consumed`。`consumedAt` = サーバー現在、`consumedOn` = その JST 日。**記録は作らない** |
| 復元 | `POST /api/bottles/:id/restore`。`consumed → sealed`。`consumedAt` / `consumedOn` を null。紐付く記録は消さない。トースト undo もこれ |
| 種類 | 飲酒記録と同じ 7 種（ワイン / ビール / ウイスキー / 日本酒 / 焼酎 / カクテル / その他）。DB 値は [data-model.md](../data-model.md) 5.3 |
| NV | ヴィンテージなし。DB は `vintage = null`。表示は「NV」 |
| 切り抜き | `photos.kind = cutout`。透過 WebP。棚では `object-fit: contain` で下端を棚板に |
| 長方形 | `photos.kind = photo`。JPEG 2:3。棚では角 8px。切り抜き失敗時のフォールバック |
| ラベル読み取り | `POST /api/bottles/recognize`。切り抜く前の 2:3 JPEG から候補を返す。**保存しない**（回数以外） |
| undo | 開栓成功トーストの「取り消す」（5 秒）。`restore` のみ |
| 表示切替 | クライアントの棚レイアウト。`?view=one\|type`（API の `view=cellar\|archive\|all` とは別） |

---

## 3. 画面と項目

画面 ID・ルート・タブ・ヘッダー文言は [screens.md](../screens.md) と [04-cellar.md](../screen-designs/04-cellar.md) に従う。要素番号（C1 / B1 / T1 …）は画面設計と同じ。C7 は欠番。

### 3.1 `bottle-list` セラー（`/cellar?view=one|type&q=&drinkType=`）

親タブはセラー。入口は下部タブ「セラー」。在庫（`sealed`）だけを出す。

| # | 項目 | 内容 | データ |
|---|---|---|---|
| C1 | 貯蔵庫 | ヘッダー左。円ボタン `archive` → `/cellar/archive`。バッジなし | — |
| C2 | タイトル | 「セラー」+ muted「N 本」。**N はフィルタ前**の棚在庫数 | `GET /api/bottles?view=cellar` の `totalCount` |
| C3 | 追加 | 右下 FAB `plus`（円 52px）→ `/cellar/new?camera=1` | — |
| C3b | まとめて追加 | ヘッダー右 `images` → `/cellar/batch?camera=1` | — |
| C4 | 表示切替 | 「種類ごと」「1 本ずつ」。URL `?view=` と `localStorage` `cellar.listView`（既定 `one`） | クライアント |
| C5 | 検索 | Chip → Input。銘柄名・生産者の部分一致。300ms デバウンス。最大 100 文字 | `q` |
| C6 | 種類フィルタ | Chip「種類 ▼」→ 7 種ダイアログ。単一選択。選択中は「ワイン ×」。**種類ごと表示では非表示** | `drinkType` |
| C8 | 棚（1 本ずつ） | 3 列 / 段（480px 以上は 4 列）。`createdAt` 降順（新しい本が左上）。段ごとにガラス棚板。最後の段が 1〜2 本でも棚板は横一杯 | `items[]` |
| C9 | 棚（種類ごと） | 種類は 7 種の定義順。在庫 0 の種類は出さない。段は横スクロール（`scroll-snap`）。ゴースト見出し「種類名 N 本」（N は `countsByType`）。棚板は本数分の幅 | 種類ごとに `GET /api/bottles?view=cellar&drinkType=&limit=12` |
| C10 | ボトル | 切り抜き 100×150（種類ごとは 72×120）+ 名前 13px 1 行省略。`cutout` は contain・下端揃え。`photo` は cover・角 8px。無ければ種類別シルエット | `GET /api/photos/:id/content`、`thumbPhotoKind` |
| C11 | サブ行 | 1 本ずつだけ。年、無ければ「NV」。種類ごとでは出さない | `vintage` |
| C12 | タップ | `/cellar/:bottleId` | — |
| C13 | もっと読む | 1 本ずつ: 下端で `nextCursor`（2 段ずつ。390px は `limit=6`、480px 以上は `limit=8`）。種類ごと: 段の右端でその種類を追加取得 | `cursor` |

- 状態フィルタ（未開栓 / 開栓済）は持たない
- `?view=` が `one` / `type` 以外、または無し → `localStorage`、それも無ければ `one`。404 にしない
- `q` / `drinkType` は URL に載せ、再訪で残す。空の `q` は付けない
- `<img loading="lazy">`。同一オリジン GET なので Cookie が付く。切り抜きの背後に白を敷かない
- 陳列の寸法・棚板トークン・シルエット形状は画面設計「陳列の写真」が正（4-04）

| 状態 | 表示 |
|---|---|
| ローディング | 棚 2 段分の枠（100×150 inset-sm ×6 + 棚板） |
| 空（在庫 0） | 棚板 1 本 + キャラ `surprised` 96px +「ボトルはまだありません。撮って 1 本目を並べましょう」+ Button 主「ボトルを追加」。初回だけ M-26 / M-27 / M-28 |
| フィルタ結果 0 | 棚板 1 本 +「該当するボトルがありません」+ Chip「フィルタを解除」（キャラなし） |
| エラー | 「読み込めませんでした」+ 再試行 |
| 直前操作あり | 対象の段の棚板ハイライト（M-32 / M-12 / M-10）。開栓後は本数カウントダウン。復元で戻ったタイルは M-11。対象は `history.state`、再生後に消す |

### 3.2 `bottle-archive` 貯蔵庫（`/cellar/archive?q=&drinkType=`）

| # | 項目 | 内容 | データ |
|---|---|---|---|
| A1 | 見出し | 「貯蔵庫」+ 総数（フィルタ前） | `GET /api/bottles?view=archive` の `totalCount` |
| — | 検索 / 種類 | 棚の C5 / C6 と同じ（種類ごとは無いので種類フィルタは出す） | `q`, `drinkType` |
| A2 | 月見出し | `consumedOn` の JST 年月。降順。クライアントが `items[]` を区切る | `consumedOn` |
| A3 | ボトル | 棚と同じ切り抜き。CSS `filter: saturate(0.5) brightness(0.9)`（要素表が正。モックの数値は使わない）。右上に「9/5」ピル（`consumedOn`） | `items[]` |
| A4 | タップ | `/cellar/:bottleId`（詳細は貯蔵庫表示） | — |

- 並びは `consumedAt` 降順（同値は `id` 降順）
- 追加読み込みは下端で `nextCursor`（`limit=50`）
- 空: 「開栓したボトルはここに並びます」+ キャラ `default` 96px。主ボタンなし。戻りは履歴（無ければ `/cellar`）
- フィルタ 0 件は棚と同じ文言 +「フィルタを解除」

### 3.3 `bottle-new` ボトルを追加（`/cellar/new?camera=1`）

タブバーは隠す。入口は C3。ディープリンクでも `?camera=1` が無くてもフォームは開く。

| # | 項目 | 入力 | 初期値 | 規則 |
|---|---|---|---|---|
| B1 | 写真タイル | `photo-edit`（2:3、`cellar`、切り抜き既定 ON、**キャラ合成なし**） | なし | 1 枚。任意。タップは撮影、下の「ライブラリから」は保存済み写真。「使う」直後に未紐付け `POST /api/photos`。`?camera=1` ならマウント直後に撮影から開く（× で閉じてもフォームは残る） |
| B2 | ラベル読み取り帯 | 自動 | — | 「使う」で切り抜く前の 2:3 JPEG ができた時点で `POST /api/bottles/recognize`（背景除去・アップロードを待たない。同じ JPEG への要求は 1 リクエストにまとめる）。設定 `cellar.recognize` が OFF なら帯もリクエストも出さない |
| B3 | 銘柄名 | Input | 空 | 必須 1〜100。AI は **空のときだけ**入れ、右端に `pill.ai`。ユーザー編集で印が消える |
| B4 | 種類 | Chip ×7 | **ワイン** | 必須。AI はユーザーが先に触っていなければ選択を変える |
| B5 | 本数 | ステッパー | 1 | 1〜12。同じ写真・属性で N 行 |
| B6 | 詳細 | 折りたたみ | 閉じる | 生産者・産地（≦100）、年（1800〜2100 / 空 = NV）、購入日、価格（整数円）、購入場所・保管場所（≦100）、メモ（≦2000）。AI が **生産者 / 産地 / 年**のいずれかを入れたら自動で開く |
| B7 | 棚に並べる | Button 主 | 有効 | ラベル「棚に並べる（N 本）」。無効: 名前が空 / 範囲外、写真アップロード中・失敗中、保存中。**読み取り中は無効にしない** |

- 写真なしでも保存できる（名前と種類があれば）
- 成功: 作成した **最初の本**の `bottle-detail` へ `replace`（B7 は M-04〜M-06）。トースト「棚に並べました」（`cheer` + M-25）。N ≥ 2 なら「棚に N 本並べました」。その後一覧へ戻ると該当棚板に M-32（`history.state`）

### 3.3b `bottle-batch` まとめて追加（`/cellar/batch?camera=1`。Phase 5.5 #56）

タブバーは隠す。入口は C3b（棚ヘッダー右の「まとめて追加」）。何本もあるときに **撮る → 「使う」→ 裏で行に積む → すぐ次の撮影** を繰り返し、最後に 1 回で棚に並べる。画面の詳細は [screen-designs/04-cellar.md](../screen-designs/04-cellar.md) `bottle-batch`。

| 項目 | 規則 |
|---|---|
| 行 | 1 枚の写真 = 1 行 = 1 銘柄。本数 N 可（1〜12）。上限 **20 行**。行の項目は銘柄名 / 種類 / 本数 / 生産者 / 産地 / 年（購入日・価格・場所・メモは持たない。あとで `bottle-edit`） |
| 写真 | `bottle-new` と同じパイプライン（2:3、`cellar`、切り抜き既定 ON、キャラ合成なし）。「使う」直後に未紐付け `POST /api/photos`。行を外す × と破棄で未紐付けの写真を `DELETE /api/photos/:id` |
| ラベル読み取り | 行ごとに `POST /api/bottles/recognize`（切り抜く前の 2:3 JPEG）。結果はその行の空欄にだけ入れて AI 印。設定 `cellar.recognize` OFF なら呼ばない。1 日 30 回の上限はそのまま（超えた行は失敗帯、保存は止めない） |
| 連続撮影 | 「使う」の **同じタップ**で次の `input[type=file] capture=environment` を開く（切り抜き完了を待たない）。今の写真は裏で処理して行に積む。OS キャンセルでループ終了。ライブラリは `multiple` で複数枚を順に積む |
| 保存 | 「棚に並べる（N 本）」N = 全行の `count` 合計。行を上から順に `POST /api/bottles`（**1 行 = 1 リクエスト**。バッチ API は作らない）。全部成功で `/cellar` へ `replace` + トースト「棚に N 本並べました」+ 最初に作った本の段に M-32。一部失敗は成功行だけ消し、失敗行を残して再送できる |
| 無効条件 | 行 0 / 銘柄名が空・範囲外の行 / アップロード中・失敗の行 / 送信中。**読み取り中は無効にしない** |
- 失敗: フォーム上部に「保存できませんでした。もう一度試してください」。入力は保持
- 戻る（未保存）: 入力を触っていれば確認「入力を破棄しますか」。破棄時、未紐付け写真は `DELETE /api/photos/:id`
- 戻り先: 履歴。無ければ `/cellar`
- キャラクターは出さない（撮影タイルにも置かない）

#### ラベル読み取り（B2）

| 状態 | 帯 |
|---|---|
| 読み取り中 | スピナー +「ラベルを読み取り中…」（目安 3〜8 秒。サーバー上限 20 秒） |
| 成功（`fields` が 1 つ以上） | 「ラベルから読み取りました。内容を確認して保存してください」。空欄にだけ候補。入った欄に AI 印 |
| 失敗 / 上限 / `fields` 空 | 「読み取れませんでした。手で入力してください」。フォームはそのまま |
| 設定 OFF | 帯なし。リクエストなし |

クライアントの反映規則:

1. 確度 0.5 未満は捨てる
2. 空欄にだけ入れる（ユーザーが触った欄は上書きしない）
3. `abvPercent` は **捨てる**（ボトルに度数列が無い。9 章）
4. 読み取りが保存より後に返ったら無視する
5. 撮り直ししたら帯をリセットし、新しい JPEG で再リクエストする（回数は加算される）

編集画面（3.5）では読み取らない。

### 3.4 `bottle-detail` ボトル詳細（`/cellar/:bottleId`）

| # | 項目 | 内容 | データ |
|---|---|---|---|
| T1 | 写真 | `cutout` は高さ ≦240 + ガラス棚板。`photo` は 2:3・高さ ≦300。無ければボトル型 SVG。タップで全画面（ピンチ可）。**写真自体は動かさない** | `photos[0]` |
| T2 | 状態ピル + 要約 | 棚: 「未開栓」（inset-sm、muted）。貯蔵庫: 「開栓（9/5）」（`consumedOn`。outset-sm、primary 600）。要約は 種類 ・ 年 ・ 産地（あるものだけ）。ピルはこの画面では切り替わらない | `status`, `consumedOn` |
| T3 | 開栓する | 棚のときだけ Button 主。確認なし。即時 `POST consume`。送信中「開栓中」+ 水位線（M-04）。2xx で **即** `/cellar`（M-05）+ トースト「開栓しました  取り消す」5 秒（`cheer` + M-25）。`haptic("success")`。取り消す = `restore` | `POST /api/bottles/:id/consume` |
| T4 | セラーに戻す | 貯蔵庫のとき T5 の上。Button 副。即時 `restore` → **棚の詳細**へ。トースト「セラーに戻しました」（`cheer` + M-25）。記録は消さない | `POST /api/bottles/:id/restore` |
| T5 | プロパティ | 順: 銘柄名 / 種類 / 年（無ければ「NV」）/ 産地 / 生産者 / 購入日 / 価格 / 購入場所 / 保管場所 / メモ。銘柄名・種類・年以外は空行を出さない。**品種列は持たない**。価格は `¥3,800`（整数・桁区切り） | data-model 6.3 |
| T6 | ノート節 | 最新 3 件 +「すべて（N）›」→ `/notes?bottleId=`。「書く ›」→ `/notes/new?bottleId=&camera=1`。0 件でも見出し +「書く ›」は出す | `GET /api/tasting-notes?bottleId=&limit=3` |
| T7 | 記録節 | このボトルの記録 最新 3 件。行 → `log-edit`。0 件なら節ごと出さない | `GET /api/drink-logs?bottleId=&limit=3` |
| T8 | 編集 | ヘッダー右 → `/cellar/:bottleId/edit` | — |

貯蔵庫（`consumed`）のとき:

- T3 は **「ノートを書く」**（Button 主）に置き換える。`/notes/new?bottleId=&camera=1`（**4-03 で出す**。ノート本体は Phase 5）
- T4 を出す
- 写真は減彩しない（詳細では原色。減彩は貯蔵庫一覧だけ）

開栓の到着演出（[motion-design.md](../motion-design.md) 9 章。「少し凝った」）:

- `/cellar` で M-10: 本数 N → N−1、抜けた段の棚板ハイライト、トースト。隣は再描画で詰まる（FLIP しない）
- undo 成功: タイルが上 6px から置かれる（M-11）+ 棚板ハイライト（M-32）+ 本数が戻る
- 段は `history.state.left = { bottleId, createdAt }` から `createdAt` 降順の順位（3 列。480px 以上は 4 列）
- reduced motion: 本数の即時差し替えとトーストの不透明度だけ
- 4-03 より前（4-02）は T3 を **出さない**（disabled にしない）

| 状態 | 表示 |
|---|---|
| ローディング | 写真枠 + 見出し枠（到着で M-29） |
| 404 | `not-found`（他人・不在・不正 id 同じ） |
| 開栓中 | T3「開栓中」無効 + 水位線 |
| 開栓失敗 | 詳細に汎用文（オフラインなら X4）。画面は閉じない。水位線は M-06 |
| 開栓成功 | 本画面での成功演出は無し（即遷移） |

### 3.5 `bottle-edit` ボトルを編集（`/cellar/:bottleId/edit`）

`bottle-new` と同じレイアウト。差分:

| 項目 | 規則 |
|---|---|
| 初期値 | `GET /api/bottles/:id`。写真があればサムネ |
| 本数 | **置かない**（1 行 = 1 本） |
| 状態 / 開栓日 | 編集できない。開栓・復元は詳細 |
| ラベル読み取り | **走らせない**（帯なし） |
| 種類変更 | 量の上書きは無い（ボトルに量・度数は無い） |
| 写真の付け替え | 「削除」→ `DELETE /api/photos/:id` → 撮り直し（未紐付け）→ `PATCH { photoIds: [新 id] }`。差し替え |
| 保存 | `PATCH` に **変えたフィールドのみ**。空オブジェクトは 400。成功 → 詳細。トースト「保存しました」（`cheer`） |
| 削除 | 保存バー下「このボトルを削除」→ 確認（danger。「ノートは残ります。記録のボトル名は残ります」。キャラなし）→ `DELETE` → `/cellar`。トースト「削除しました」（undo なし）。**貯蔵庫の本も削除できる** |
| 404 | 他人・不在は `not-found` |

### 3.6 設定「ラベルを自動で読み取る」（S5）

[06-settings.md](../screen-designs/06-settings.md) S5。実装は 4-07（スイッチ自体は 3-07 の設定画面にある）。

| 項目 | 規則 |
|---|---|
| キー | `localStorage` `cellar.recognize`。既定 `true`。サーバーには持たない |
| OFF | `bottle-new` で帯を出さず、`recognize` を呼ばない |
| 副文 | 「写真を Cloudflare の AI に送ります」 |
| サーバー | クライアント OFF を信用した認可緩和はしない。呼ばれたら認証・日次上限・画像検証を行う |

### 3.7 記録・ノートとの連携

| 場面 | 規則 |
|---|---|
| `log-new` の「ボトル」行 | **4-02 で表示する**（Phase 3 中は非表示。[drink-log.md](drink-log.md) 3.8）。ピッカーは `GET /api/bottles?view=all&q=`（貯蔵庫も含む） |
| 選択時 | ボトルの種類・名前を記録へ反映。種類が変わるときは記録側のデフォルト量・度数を投入 |
| `?bottleId=` | 事前選択。上と同じ |
| サーバー | 自分のボトルでなければ 404。`drinkName` / `drinkType` をボトルからコピー（量・度数はリクエストが正） |
| 解除 | 「なし」。`PATCH { bottleId: null }` でも `drinkName` は残す |
| ノート | [tasting-note.md](tasting-note.md)。貯蔵庫の本も選べる。スナップショットは data-model 6.4。ノート節 T6 は 5-04 |
| 開栓 | 記録もノートも作らない・消さない |

### 3.8 日付の扱い

| 項目 | 規則 |
|---|---|
| `purchasedOn` | Asia/Tokyo の `YYYY-MM-DD`。未来は不可（今日は可）。端末 TZ に依存しない |
| `consumedOn` | サーバーが `consumedAt` から算出。クライアントは送らない |
| `consumedAt` / `createdAt` | UTC ISO。表示の開栓日ピルは `consumedOn` |
| 貯蔵庫の月 | `consumedOn` の年月（JST） |

---

## 4. バリデーションとエラー文

Zod は `src/shared` に置き、クライアントとサーバー（`@hono/zod-validator`）で同じスキーマを使う。400 は `{ "error": "validation_error", "fields": { "<field>": ["<文>"] } }`。

### 4.1 作成（`POST /api/bottles`）

| フィールド | 規則 | エラー文 |
|---|---|---|
| `name` | 1〜100 文字（trim 後）。必須 | 「1文字以上100文字以内で入力してください」 |
| `drinkType` | 7 種 enum。必須 | 「種類を選んでください」 |
| `producer` / `origin` / `shop` / `storage` | 0〜100。trim 後に空なら `null` | 「100文字以内で入力してください」 |
| `vintage` | 整数 1800〜2100、または省略 / null（NV） | 「1800以上2100以下の年を入力してください」 |
| `purchasedOn` | `YYYY-MM-DD` かつ暦上存在する日。サーバー現在の JST 日より後は 400 | 「日付の形式が正しくありません」/「未来の日付は指定できません」 |
| `priceJpy` | 0 以上の整数、または省略 / null。小数不可 | 「0以上の整数で入力してください」 |
| `memo` | 0〜2000。trim 後に空なら `null` | 「2000文字以内で入力してください」 |
| `count` | 整数 1〜12。省略時 1 | 「1以上12以下で入力してください」 |
| `photoIds` | 配列、最大 1。自分の未紐付け写真のみ。他人・紐付け済み・不明は 404 | 2 枚以上は「写真は1枚まで添付できます」。404 は「写真をもう一度撮ってください」 |
| `status` / `consumedAt` / `consumedOn` / `userId` / `id` / `alcoholG` | **受け取らない**。未知キーは 400（`fields[""]`） | — |

成功: 201 `{ "items": Bottle[] }`。`createdAt` は同一、`id` は個別。`status` は常に `sealed`。

`count` ≥ 2 かつ `photoIds` があるとき: サーバーが **photo 行と R2 オブジェクトを N 個に複製**する（同じ R2 キーを共有しない。1 本削除しても他が残る）。元の未紐付け 1 枚 + 複製 N−1。すべて同じ `user_id`、各行の `bottle_id` に紐付ける。同一トランザクション（D1 batch）。R2 コピー失敗は 500（作った途中行を残さない）。

### 4.2 更新（`PATCH /api/bottles/:id`）

4.1 と同じフィールドを任意で送る（送ったものだけ更新）。`count` は受け取らない。`status` / `consumedAt` / `consumedOn` も受け取らない。空オブジェクトは 400。`photoIds` は差し替え（外れた写真は R2 も削除）。

### 4.3 開栓 / 復元

| API | 規則 |
|---|---|
| `POST /api/bottles/:id/consume` | ボディなし（空オブジェクト可）。`log` 等は未知キーで 400。自分の `sealed` 以外（他人・不在・すでに `consumed`）は **404**（同じ本文）。記録は作らない |
| `POST /api/bottles/:id/restore` | ボディなし。自分の `consumed` 以外は 404。記録は消さない |

成功: 200 `Bottle`。

### 4.4 一覧クエリ（`GET /api/bottles`）

| クエリ | 規則 | エラー文 |
|---|---|---|
| `view` | `cellar` \| `archive` \| `all`。省略時 `cellar` | 「一覧の種類が正しくありません」 |
| `q` | 最大 100 文字。空は未指定。銘柄名・生産者の部分一致（OR） | 「100文字以内で入力してください」 |
| `drinkType` | 7 種 | 「種類を選んでください」 |
| `limit` | 整数 1〜100（既定 50） | 「件数は1以上100以下で指定してください」 |
| `cursor` | サーバー発行値のみ。改ざんは 400 | 「ページ情報が正しくありません」 |

検索の SQL:

- Drizzle のプレースホルダのみ。文字列結合禁止
- `%` と `_` はエスケープ（リテラルとして探す）
- 大文字小文字は SQLite 既定（ASCII のみ不区別）。日本語の正規化はしない

`totalCount` / `countsByType` は **`view` 内の総数**（`q` / `drinkType` を掛けない）。`countsByType` は 7 種すべてのキーを返し、0 を含む。クライアントが 0 の種類を隠す。

並び:

| `view` | 対象 | 順 |
|---|---|---|
| `cellar`（既定） | `sealed` | `createdAt` 降順、同値は `id` 降順 |
| `archive` | `consumed` | `consumedAt` 降順、同値は `id` 降順 |
| `all` | 両方（ピッカー） | `createdAt` 降順、同値は `id` 降順 |

一覧の行は `thumbPhotoId` / `thumbPhotoKind`（`photo` / `cutout` / null）。詳細・作成応答は `photos` メタ配列（最大 1）。`r2Key` / `userId` は出さない。

### 4.5 ラベル読み取り（`POST /api/bottles/recognize`）

`multipart/form-data`。パート `file`。認証必須。公開エンドポイントではない。

| 規則 | 内容 | エラー |
|---|---|---|
| MIME | magic bytes で jpeg のみ（切り抜く前の 2:3 JPEG）。png / webp / SVG / GIF / HEIC は 415 | 415 |
| サイズ | ≦1MB。長辺 ≦1600 | 413 / 400（[photos.md](photos.md) と同じ） |
| 日次上限 | ユーザーごと **30 回 / JST 日**。`ai_usage` を **先に加算**。超過は 429。Workers AI 失敗（502）は加算しない | 429 `rate_limited`「本日の読み取り回数の上限に達しました」 |
| タイムアウト | 20 秒 | 502 `upstream_error`。画面は失敗帯 |
| 出力 | モデル出力は信頼しない入力として Zod 検証。落ちたフィールドは省く。`fields` 空でも 200 | — |

応答フィールド（検証後）:

| キー | 型 | 範囲 |
|---|---|---|
| `name` / `producer` / `origin` | 文字列 | ≦100。制御文字除去 |
| `vintage` | 整数 | 1800〜2100 |
| `drinkType` | enum | 7 種 |
| `abvPercent` | 数 | 0〜100、小数第 1 位。**クライアントは捨てる** |
| `confidence` | 数 | 0〜1 |

プロンプトはサーバー固定。ユーザー入力（銘柄名など）をプロンプトに含めない。画像も結果も保存しない。ログは件数・所要時間・成否のみ。

モデル名は 4-07 で定数化する。実装は `LabelRecognizer`。

### 4.6 クライアント側の表示

- 範囲外はフィールド直下 + B7 を無効（サーバーを叩かない）
- サーバー 400 は `fields` のキーへ。`""` はフォーム上部
- 404（ボトル / 写真）: 詳細・編集は `not-found`。参照 ID は該当欄の文言 + 選択解除
- 429 / 502（recognize）: 失敗帯。保存は止めない
- 401 は `RequireAuth`

---

## 5. ステータス遷移

```
          POST /api/bottles
                 │
                 ▼
              sealed ────────開栓 consume────────► consumed
              （棚）                                  （貯蔵庫）
                 ▲                                       │
                 └────────復元 restore（undo も同じ）─────┘
```

| 操作 | 条件 | 結果 |
|---|---|---|
| 作成 | — | 常に `sealed`。`consumedAt` / `consumedOn` は null |
| 開栓 | 自分の `sealed` | `consumed` + 現在時刻 / JST 日。記録なし |
| 復元 | 自分の `consumed` | `sealed` + 日時 null。記録は残る |
| PATCH | — | 状態を変えない |
| 削除 | 自分のボトル（どちらの状態でも） | 行削除。写真 CASCADE + R2。ノート・記録は SET NULL |

DB は 2 値のみ（[data-model.md](../data-model.md) 5.4）。`opened` / `finished` / `quantity` は無い。

---

## 6. 写真

正本は [photos.md](photos.md) と [07-photo-capture.md](../screen-designs/07-photo-capture.md)。**解像度・MIME・GC の数値を本ファイルで変えない**。セラー固有だけ書く。

| 項目 | 値 |
|---|---|
| 枚数 | ボトルあたり **1**（任意） |
| 比率 | 2:3 |
| プリセット | `cellar`（既定 ON。設定 S4） |
| キャラ合成 | **なし**（トグルも出さない） |
| 切り抜き | セラーのみ。既定 ON（`photo.cutout`）。端末内 WASM（`onnxruntime-web` + U2-Net-P。`.mjs` / `.wasm` は `/models/ort/`）。失敗・未対応は JPEG 長方形。読み込み失敗と切り抜けなかったで文言を分ける。処理失敗時の自動 OFF は今回の編集画面だけで、`photo.cutout` はユーザーがトグルを手動操作したときだけ変更する |
| 出力 | cutout: 透過 WebP・長辺 1280・品質 0.9。photo: JPEG・長辺 1280・品質 0.82 |
| サーバー | magic bytes、1MB、長辺 1600、キーはサーバー生成、配信は認可付き GET |
| `kind` | サーバー判定（WebP VP8X alpha → `cutout`）。クライアント申告は受け取らない |
| 未紐付け | 「使う」直後。24h GC |
| N 行展開 | R2 を N 個にコピー（4.1） |

陳列のサムネサイズ・棚板・落ち影・列数は画面設計「陳列の写真」（4-04 / 4-06）。本仕様は「棚は `kind` で描き分ける」ことだけを契約する。

---

## 7. API 対応表

契約の正本は [api-design.md](../api-design.md) 4.5。`POST /api/bottles/recognize` は `/:id` より **先に登録**する。

| 画面・操作 | API | 実装タスク |
|---|---|---|
| 棚一覧 | `GET /api/bottles?view=cellar&q=&drinkType=&limit=&cursor=` | 4-02（API）/ 4-04（棚 UI） |
| 貯蔵庫 | `GET /api/bottles?view=archive&…` | 4-03 |
| ボトルピッカー | `GET /api/bottles?view=all&q=` | 4-02（`log-new` 行の有効化） |
| 追加 | `POST /api/bottles`（`count`, `photoIds`） | 4-02 |
| まとめて追加 | `POST /api/bottles` を行ごとに（1 行 = 1 リクエスト） | 5.5 #56 |
| 詳細 / 編集 / 削除 | `GET` / `PATCH` / `DELETE /api/bottles/:id` | 4-02 |
| 開栓 / 復元 | `POST /api/bottles/:id/consume` / `restore` | 4-03 |
| ラベル | `POST /api/bottles/recognize` | 4-07 |
| 写真 | `POST` / `DELETE` / `GET /api/photos/:id/content`（2-08 済み） | 4-02（呼び出し）/ 4-06（切り抜き） |
| 記録節 | `GET /api/drink-logs?bottleId=&limit=3`（3-02 済み） | 4-02 |
| ノート節 | `GET /api/tasting-notes?bottleId=&limit=3` | 5-04 |

サーバー側の規則:

- 全エンドポイント認証必須。`c.get("user").id` のみでスコープ。Zod に `userId` を置かない
- 更新・削除・開栓・復元は `id AND user_id`。他人・不在・状態不一致は同じ 404。403 は使わない
- `photoIds` は自分の未紐付けのみ。紐付けは同一トランザクション
- 検索 `LIKE` はプレースホルダ + `%` `_` エスケープ
- consume / restore は PATCH で代替できない
- recognize は DB に回数以外を書かない。画像を R2 に残さない

---

## 8. エッジケース

| # | ケース | 振る舞い |
|---|---|---|
| E1 | 本数 3 で保存 | 3 行。同じ `createdAt`・属性。写真は R2 3 個。最初の id の詳細へ |
| E2 | N 本のうち 1 本を編集 / 削除 | 他の行は不変。写真は独立 |
| E3 | N 本のうち 1 本を開栓 | その 1 行だけ貯蔵庫へ。棚の残は `sealed` のまま |
| E4 | 同名のボトル | 許可（ユーザー内ユニークにしない） |
| E5 | 写真なしで保存 | 可。棚は種類別シルエット |
| E6 | `?camera=1` で撮影キャンセル | フォームは残る。読み取りは起きない |
| E7 | 読み取り中に保存 | 可。後から返った候補は捨てる |
| E8 | 読み取り 31 回目 | 429。帯は失敗文。手入力で保存できる |
| E9 | 読み取り 502 / タイムアウト | 加算しない。失敗帯。保存できる |
| E10 | 設定 OFF | リクエストしない。帯なし |
| E11 | AI が度数だけ返した | フォームに入れない。詳細は自動で開かない |
| E12 | AI 印の欄を編集 | 印が消える。以降その欄は上書きしない |
| E13 | 確度 0.49 | 入れない |
| E14 | 二重タップ（保存 / 開栓） | ボタンを応答まで無効。Idempotency-Key は持たない |
| E15 | 開栓の誤タップ | 5 秒の undo = `restore`。過ぎたら詳細の「セラーに戻す」 |
| E16 | undo の restore 失敗 | トースト汎用文。ボトルは貯蔵庫のまま。画面を再取得 |
| E17 | すでに開栓した本に consume | 404。記録は作らない |
| E18 | 棚の本に restore | 404 |
| E19 | 開栓しても記録が増えない | 仕様どおり。1 杯は `log-new` |
| E20 | 復元しても記録は残る | `bottleId` はそのまま。`consumedOn` だけ消える |
| E21 | ボトル削除後の記録 / ノート | `bottleId` SET NULL。名前スナップショットは残る |
| E22 | ボトル削除後の写真 | CASCADE + R2 削除。失敗分は日次 GC |
| E23 | 未保存で戻る（写真あり） | 確認 → 破棄で `DELETE /api/photos/:id`。失敗しても 24h GC |
| E24 | 写真アップロード中に保存 | B7 無効 |
| E25 | 写真アップロード失敗 | サムネ「!」+ 再試行。削除すれば写真なしで進める |
| E26 | 他人の `:bottleId` / `photoId` | 404（不在と同じ本文）。一覧に混ざらない |
| E27 | 検索 `%` `_` | ワイルドカードにせずリテラル一致 |
| E28 | 種類ごとで在庫 0 の種類 | 段を出さない |
| E29 | 種類ごと + 検索で全種類 0 件 | フィルタ 0 の空状態 |
| E30 | `?view=foo` | `one`（または localStorage）にフォールバック |
| E31 | 不正な `:bottleId` | `not-found` |
| E32 | 購入日が未来 | B7 無効 + 400 |
| E33 | 年が空 | `vintage = null`。表示「NV」 |
| E34 | 価格 0 | 可（贈り物）。表示「¥0」 |
| E35 | メモに HTML | テキスト描画。`dangerouslySetInnerHTML` 禁止。URL 化しない |
| E36 | セッション切れ | `RequireAuth`。入力は失われる（MVP） |
| E37 | 切り抜き失敗 / WASM 非対応 | `kind = photo` で保存。棚は角 8px。登録は止まらない。一時失敗では `photo.cutout` を変更しない。UI は読み込み／初期化失敗と切り抜けなかったを区別する |
| E38 | 4-02 時点の `/cellar` | 仮一覧でよい。T3 は出さない。棚の見た目は 4-04 |
| E39 | ピッカーに貯蔵庫の本 | 出る（`view=all`）。記録・ノートから選べる |
| E40 | 表示切替を変えても在庫は同じ | API `view=cellar` のまま。変わるのはレイアウト |

---

## 9. セキュリティ

正本は [`.cursor/rules/security.mdc`](../../.cursor/rules/security.mdc) と [api-design.md](../api-design.md) 2 章。

| 観点 | 規則 |
|---|---|
| 認可 | 全 API はセッションの `user.id`。`userId` をクエリ・ボディに置かない。他人・不在・状態不一致は 404 同一本文 |
| 参照 ID | `photoIds` / ピッカーの id は自分のもののみ。他人なら 404 で作成しない |
| 状態改ざん | `status` / `consumedAt` / `consumedOn` は PATCH で受け取らない。開栓・復元専用 API |
| 検索 | `LIKE` はプレースホルダ。`%` `_` をエスケープ。他ユーザー行が混ざらない |
| XSS | 銘柄・生産者・産地・店・保管場所・メモはテキスト。`dangerouslySetInnerHTML` 禁止 |
| 価格・メモ | すべてプライベート。サーバーログに本文・価格を出さない（メソッドとパスだけ） |
| 写真 | magic bytes・1MB・キー生成・配信認可は 2-08 のまま。N 複製も同じ検証後のバイトをコピー |
| ラベル AI | 認証必須。プロンプトにユーザー文を入れない。出力は Zod。画像・結果を保存・ログしない。Cloudflare 外に送らない。日次 30 回。設定 OFF はクライアント抑制のみ（サーバー上限は残す） |
| エラー | 400 の `fields` に内部パスを出さない。429 / 502 にモデル名や生出力を出さない |
| レート制限 | recognize のみ 30 回/日。アプリ全体の制限は Phase 8 |

---

## 10. 決定事項（本仕様で確定した「要確認」）

ロードマップ 4-01〜4-07 に残っていた判断を以下のとおり確定する。異議があれば本 PR のレビューで指摘する。

| 出典 | 項目 | 決定 | 根拠 |
|---|---|---|---|
| 4-01 | 種類 enum | 飲酒記録と同じ 7 種 | [data-model.md](../data-model.md) 5.3 |
| 4-01 | 検索 | 銘柄名・生産者の部分一致。`LIKE` + `%` `_` エスケープ。ASCII のみ大小無視 | 4.4 / data-model 7 章 |
| 4-01 | 開栓の undo | `restore` のみ。記録の作成・削除はしない | [04-cellar.md](../screen-designs/04-cellar.md) T3、api-design 4.5.1 / 4.5.2 |
| 4-01 | 写真の解像度 | 本ファイルは変えない。正本は photos / 07-photo-capture（長辺 1280、サーバ 1MB / 1600） | 4-04 と重複させない |
| 4-02 | ヴィンテージ | `integer \| null`。NV = null。文字列 "NV" は送らない | data-model 6.3 |
| 4-02 | 本数上限 | **12** | 2026-09-05 オーナー決定 |
| 4-02 | 詳細の開栓ボタン | 4-03 まで **出さない**（disabled にしない） | 4-02 手順書 |
| 4-02 | ノート節（T6） | **5-04 で出す**。0 件でも見出し +「書く ›」は出す。記録節は 4-02 で出す（0 件なら非表示） | 5-04 / T7 |
| 4-03 | 貯蔵庫の「ノートを書く」 | **出す**（着地は `/notes/new?bottleId=`。本体は Phase 5） | 4-03 手順書 / 画面設計 |
| 4-02 | `log-new` のボトル行 | **4-02 で有効化** | drink-log 3.8 |
| 4-02 | `view=all` の並び | `createdAt` 降順 | api-design 2.7。ピッカー用 |
| 4-03 | 確認ダイアログ | 開栓・復元に **出さない**。削除と未保存戻るだけ | 誤タップは 5 秒 undo |
| 4-03 | 状態不一致 | consume / restore とも 404（403 にしない） | 存在を漏らさない |
| 4-04 | 表示切替の記憶 | URL `?view=one\|type` + `localStorage` `cellar.listView`。既定 1 本ずつ | 04-cellar C4 |
| 4-04 | ヘッダー本数 | フィルタ前の `totalCount` | C2 |
| 4-04 | 貯蔵庫の減彩 | `saturate(0.5) brightness(0.9)`（要素表） | モック数値は使わない |
| 4-06 | 切り抜き失敗 | 長方形 JPEG で登録継続。今回の編集画面だけ自動 OFF とし、`photo.cutout` は変更しない | 07-photo-capture / Issue #48 |
| 4-07 | 自動保存 | **しない**。空欄に候補のみ | 要件 1.3 |
| 4-07 | 日次上限 | **30 回 / ユーザー / JST 日**。先加算。502 は加算しない | api-design 4.5.3 |
| 4-07 | 確度 | クライアント 0.5 未満は捨てる | 04-cellar バリデーション |
| 本仕様 | recognize の `abvPercent` | API は返す。**フォームに入れない**。詳細の自動オープンは生産者 / 産地 / 年のみ | ボトルに度数列が無い（要件 1.3 / data-model 6.3）。画面設計 B6 を同じ PR で修正 |
| 本仕様 | 編集での読み取り | **しない** | api-design 画面対応表（bottle-new のみ） |
| 本仕様 | 二重 POST | 持たない。ボタン disable + undo | api-design 7 章 |
| 本仕様 | 不正な一覧 `?view=` | 404 にせず `one` へフォールバック | 表示切替はクライアント状態 |
| 4-07 | モデル名 | `@cf/meta/llama-4-scout-17b-16e-instruct`（`WORKERS_AI_VISION_MODEL`） | 公式一覧の Vision 対応・指示追従。guided_json あり |

未決事項は **残さない**。上表以外に判断が必要になったら、本ファイルを更新して承認を得てから実装する。

---

## 11. 実装タスクとの対応

| タスク | 本ファイルの節 | 画面設計 |
|---|---|---|
| 4-01 本仕様 | 全体 | — |
| 4-02 追加・詳細・編集・削除・一覧 API・ボトル行 | 3.3 / 3.4（T3 以外）/ 3.5 / 3.7 / 4.1 / 4.2 / 4.4 | `bottle-new` / `bottle-detail` / `bottle-edit` |
| 4-03 開栓・貯蔵庫・復元 | 3.2 / 3.4 T3 T4 / 4.3 / 5 | `bottle-detail` 開栓、`bottle-archive` |
| 4-04 ガラス棚 | 3.1 / 6（描画契約） | `bottle-list`、陳列の写真 |
| 4-05 テスト総仕上げ | 4 / 8 / 9 | 各受け入れ。一覧は [05-api-component-tests.md](../../roadmap/phase-04-cellar/05-api-component-tests.md) |
| 4-06 切り抜き | 6 | 07-photo-capture P5b |
| 4-07 ラベル読み取り | 3.3 B2 / 3.6 / 4.5 | B2、設定 S5 |

推奨順は 01（承認）→ 02（棚は仮一覧）→ 04（まず `kind = photo`）→ 03 → 06 → 07 → 05（[00-phase.md](../../roadmap/phase-04-cellar/00-phase.md)）。06 と 07 は並行可。各実装 PR は [04-cellar.md](../screen-designs/04-cellar.md) の **受け入れチェックを本文に貼る**。

モーションの正本は [motion-design.md](../motion-design.md)。開栓は M-10 / M-11 / M-32、棚板ハイライトは M-12 / M-28。

---

## 12. 受け入れ（4-01）

- [x] ファイルが存在し、画面項目・バリデーション・API 対応・エッジケースがある
- [x] [01-requirements.md](../01-requirements.md) 1.3 と矛盾しない（v1.x を混ぜていない。開栓時の記録自動作成は 1.2 の旧文を同じ PR で直した）
- [x] 未決を残さず、決定事項を 10 章に列挙した
- [x] 写真の認可方針が [security.mdc](../../.cursor/rules/security.mdc) / [photos.md](photos.md) と矛盾しない
- [x] 実装ファイル（`src/`）を含まない
- [x] オーナー承認（本 PR のマージをもって承認とする）

---

## 13. 関連

- [01-requirements.md](../01-requirements.md) 1.3
- [api-design.md](../api-design.md) 4.5 / 4.7
- [data-model.md](../data-model.md) 5.3 / 5.4 / 6.3 / 6.5 / 6.6
- [screens.md](../screens.md)、[screen-designs/04-cellar.md](../screen-designs/04-cellar.md)、[06-settings.md](../screen-designs/06-settings.md) S5、[07-photo-capture.md](../screen-designs/07-photo-capture.md)
- [motion-design.md](../motion-design.md) 9 章（開栓）
- [photos.md](photos.md)、[drink-log.md](drink-log.md) 3.8、[character.md](../character.md)（セラー写真には合成しない）
- [roadmap/phase-04-cellar/01-spec-cellar.md](../../roadmap/phase-04-cellar/01-spec-cellar.md)
