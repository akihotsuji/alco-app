# 画面一覧とナビゲーション構造

Phase 1-01 の成果物（2026-09-05 に 1-07 で改訂。2026-09-06 に中央タブの挙動を (c) 撮影開始で確定）。アプリに存在する画面、下部タブ、認証境界、入場経路を定義する。

**Phase 2-05（共通レイアウト / React Router）はこのファイルを正本にする。** ルート実装・タブ構成・ガードは本仕様に従う。各画面の要素・状態・遷移・モックは [screen-designs/](screen-designs/README.md)（詳細画面設計。**実装はこのとおりに作る**）。見た目の数値は [design-system.md](design-system.md)。リソース ID の採番は [1-04](../roadmap/phase-01-design/04-er-drizzle-schema.md)。

実装コードは本タスクの対象外。

## 確定事項

| 項目 | 決定 | 日付 |
|---|---|---|
| 下部タブ数 | **5 タブ** | 2026-09-04 オーナー |
| 下部タブ順 | **ホーム / セラー / 記録（中央） / ノート / 設定**。記録は円形 primary で浮かせる | 2026-09-05 オーナー指示（1-07。2026-09-06 承認） |
| 中央タブの挙動 | **記録（作成ボタン）**。円内は Plus。下ラベルは「記録」のみ。タップで空の `log-new`（`/logs/new`）を開く。カメラ・写真選択は開かない。着地画面・現在地ハイライトなし | 2026-09-08 オーナー指示。下ラベルから「＋」を外す（2026-09-08） |
| 招待制 | 採用しない。サインアップに招待コード入力は置かない | 2026-08-13 |
| UIテーマ切替 | 専用画面は置かない。設定「表示 › 外観」の 3 択（端末に従う / ライト / ダーク）で切り替える（[06-settings S10](screen-designs/06-settings.md)） | 2026-08-13 → 2026-09-07 #62 で設定項目を追加 |
| 日付境界 | 日別ビューの日付は Asia/Tokyo のカレンダー日 | 2026-08-13 |
| セラーの見せ方 | 棚（陳列）。開栓で貯蔵庫（`/cellar/archive`）へ | 2026-09-05 オーナー指示（1-07）。2026-09-06 に開栓＝貯蔵庫へ |
| 成果物ファイル | 本ファイル（`spec/screens.md`） | 2026-09-04 |

## 設計判断（2026-09-04 承認 → 1-07 で更新）

| 項目 | 判断 | 理由 |
|---|---|---|
| タブ順 | ホーム → セラー → **記録** → ノート → 設定 | 記録が最頻（オーナー指示）。中央に置き、親指の届く位置で目立たせる。2026-09-04 の「中央案不採用」を覆す |
| 中央タブの挙動 | **動作（着地なし）**。通常タブと区別した「記録」作成ボタン。タップで `/logs/new` を写真なしで開く。カメラ・ファイル選択・権限要求は開始しない。現在地ハイライトなし。再タップもフォームへ（撮影は開始しない） | 2026-09-08。記録＝量を残す、写真＝フォーム内の任意操作。(c) 撮影開始は撤回 |
| 写真なし記録 | 中央タブ「記録」→ `/logs/new`（写真はフォーム内で任意。保存 1 タップは維持）。ホームに記録ボタンは置かない | 記録の主導線は中央タブだけ。ホームはサマリー |
| 記録入力のルート | 独立パス `/logs/new`。**フルスクリーン**（シートにしない）。アプリ内導線は `?camera=1` を付けない。ディープリンクの `?camera=1` も **自動起動しない** | マウント・再表示・戻り・権限許可後も撮影を始めない |
| 写真編集 | ルートを持たない全画面オーバーレイ（`photo-edit`）。`pushState` 1 段 | フォーム状態を保つ |
| 日別ビュー | ルートは `/logs`（今日）/ `/logs/:date` のまま。**親タブはホーム**。入口はホームの今日カード（今日）/ 週マス（その日。未来は無効 X6）/ 入力・編集の保存後（`?highlight=`）/ 週サマリーの日別行。役割は一覧・合計・編集・削除。最上部の「記録する / カメラ / マイドリンク」は置かない | 2026-09-06 (c)。中央タブの着地ではなくなった。ホームの記録 CTA も 2026-09-08 に廃止 |
| マイドリンク | ルートは `/logs/my-drinks` のまま。親タブはホーム。入口はホームの「管理」 | 記録のプリセットであり、設定に置くと遠い。1 タップチップはホームのみ |
| 週 / 月サマリー | ホーム配下。週 = ホーム今週セクションの「詳しく見る ›」と月サマリーの週行、月 = 週サマリーの「今月 ›」。週の日別行 → その日の日別 | 今日カード本体は日別へ行くため、週への入口をリンクにした（2026-09-06） |
| 貯蔵庫（アーカイブ） | セラー配下の独立画面 `/cellar/archive`。ヘッダー左のボタンから | 棚と分けて在庫感を守る |
| 開栓 | 詳細の主ボタン。確認なし。成功後は詳細に留まり、記録・ノートは任意のボトムシートで案内する。開栓だけでは記録もノートも作らない | 2026-09-08。2026-09-06 の「棚へ戻りトースト undo」は、シートと重ねないため詳細に変更 |
| 表示名 | 設定画面の任意項目。独立画面は作らない | Better Auth の name を出す想定。未設定でも使える |
| 作成・編集中のタブバー | 隠す | 入力領域と保存ボタンを優先。キーボード時も保存バーは残す（1-02） |
| ボトルのノート一覧 | 独立画面は作らない | ボトル詳細内のセクション。必要なら `/notes?bottleId=` へ |
| FAB | **セラー一覧・ノート一覧だけ**右下に「追加 / 作成」（円 52px）。記録の主導線は中央タブのまま。ホーム・設定・マイドリンクは置かない | 2026-09-07。右利きの親指が届く位置へ。ヘッダー右の `plus` は廃止（マイドリンク一覧だけヘッダー右に残す） |
| 1 タップ記録・開栓の undo | トースト 5 秒 | 1-02 / 1-07。開栓 undo は復元のみ |

タブアイコン（絵文字禁止、SVG）は design-system。配置の正本は [screen-designs/](screen-designs/README.md)。

---

## 認証境界

クライアントのルートガードは UX 用。認可の正はサーバー API（[security.mdc](../.cursor/rules/security.mdc)、[api-design.md](api-design.md)）。ナビや非表示はアクセス制御に使わない。

| 区分 | 対象 | 未ログイン時 | ログイン済みで当該 URL に来たとき |
|---|---|---|---|
| 公開 | `auth-login` `/login`、`auth-signup` `/signup` | 表示 | `/` へリダイレクト（未確認なら続けて `/age`） |
| 公開（リセット） | `auth-forgot-password` `/forgot-password`、`auth-reset-password` `/reset-password` | 表示 | **そのまま表示**（メールのリンクをログイン中でも使える。8-03） |
| 公開（法務） | `legal-terms` `/terms`、`legal-privacy` `/privacy` | 表示 | **そのまま表示**（`/` へ送らない） |
| 公開（削除受付） | `account-deleted` `/account-deleted` | 表示 | **そのまま表示**（新しい公開 API は無い） |
| 公開（招待参加） | `cellar-join` `/join` | 表示 | **そのまま表示**（未ログインは一般説明。トークンは `#t=`。GET では参加しない） |
| 認証後（年齢未確認） | `auth-age` `/age`（タブバーなし）、`settings-account-delete` `/settings/account/delete`（タブバーなし） | `/login?redirect=` | `/age` は確認済みなら `redirect` または `/`。削除画面は年齢確認不要 |
| 認証後（年齢確認済み） | 下部タブ配下の全画面、サマリー、作成・編集、404（認証後シェル） | `/login?redirect=<元パス>` へ | 未確認なら `/age?redirect=`（削除画面は除く）。確認済みなら表示 |

`redirect` はアプリ内の相対パスのみ許可する（`/` で始まり `//` やスキームを含まない）。オープンリダイレクト禁止。許可リストに無い・不正な値は `/` へ。

未ログインで認証後 URL（例: `/cellar/abc`）に来たら、上記のとおりログインへ送り、成功後に元パスへ戻す。

---

## 下部タブ（認証後シェル）

常時表示する。ただし作成・編集画面（後述の「タブを隠す」）では非表示。

| 位置 | タブ ID | ラベル | ルート | 主画面 ID | タブを選んだときの着地 |
|---|---|---|---|---|---|
| 1 | home | ホーム | `/` | `home` | 当日・今週のサマリー。記録は中央タブ |
| 2 | cellar | セラー | `/cellar` | `bottle-list` | 棚（陳列） |
| 3（中央） | log | 記録 | —（着地なし） | — | **着地しない**。`/logs/new`（写真なし）を開く。撮影は開始しない。再タップも同じ |
| 4 | notes | ノート | `/notes` | `note-list` | 写真グリッド |
| 5 | settings | 設定 | `/settings` | `settings` | ログアウト・アカウント・写真の既定 |

中央タブは直径 60px の円形 primary ボタン（[screen-designs/00-common.md](screen-designs/00-common.md)）。中央タブは「動作」なので現在地ハイライトを持たない。他のタブの現在地ハイライトは「親タブ」列に従う（例: `/summary/week` と `/logs` 配下はホーム、`/cellar/archive` はセラー）。

ラベルは日本語のまま。5 タブは iPhone SE（320px）で折り返すリスクがある。2-05 で 320px / 390px を確認し、切れ・折り返しがあれば design-system の字サイズで調整する。MVP ではアイコンのみタブにはしない。

---

## 画面一覧

画面 ID は後続の API・テスト・ワイヤーから参照する短い slug。変更するときは本ファイルと参照元を同時に直す。

### 認証前（MVP）

| ID | 画面 | パス | 備考 |
|---|---|---|---|
| auth-login | ログイン | `/login` | メール＋パスワード。8-03 で「パスワードを忘れた」 |
| auth-signup | サインアップ | `/signup` | メール＋パスワード。招待制は置かない。8-01 で規約・PP への同意 |
| auth-forgot-password | パスワード再設定（メール） | `/forgot-password` | 8-03。ログイン中でも表示 |
| auth-reset-password | 新しいパスワード | `/reset-password` | 8-03。トークンは query。ログイン中でも表示 |
| legal-terms | 利用規約 | `/terms` | 認証なし。ログイン済みでも表示。8-01 |
| legal-privacy | プライバシーポリシー | `/privacy` | 同上 |

### 認証後 — ホーム

| ID | 画面 | パス | 親タブ | 備考 |
|---|---|---|---|---|
| home | ホーム | `/` | home | 当日の杯数・純アルコール量、未記録状態、今週、直近マイドリンク。記録の入口は中央タブ |
| summary-week | 週サマリー | `/summary/week` | home | 推移・休肝日数 |
| summary-month | 月サマリー | `/summary/month` | home | 推移・休肝日数 |

### 認証後 — 記録

ルートは `/logs` 配下のまま。中央タブは着地を持たないため、**親タブはすべて home**（タブバー表示時はホームが現在地）。

| ID | 画面 | パス | 親タブ | タブバー | 備考 |
|---|---|---|---|---|---|
| log-day | 日別記録 | `/logs`（今日）、`/logs/:date` | home | 表示 | `:date` は JST の `YYYY-MM-DD` のみ。入口はホームの今日カード（今日）/ 週マス（その日。X6）/ 保存後 / 週サマリーの日別行。`?highlight=<logId>` で行を挿入 + 2 秒強調（[motion-design.md](motion-design.md) M-14〜M-16）。一覧・合計・編集・削除のみ（記録ボタン・カメラ・チップは置かない） |
| log-new | 記録入力 | `/logs/new` | home | 隠す | 中央タブ「記録」は写真なしで開く。写真はフォーム内の任意操作。任意クエリ `?date=YYYY-MM-DD`（過去日）、`?camera=1`（無視。撮影しない）、`?bottleId=`（ボトル事前選択）、`?from=opened|detail`（詳細起点。戻る先はボトル詳細） |
| log-edit | 記録編集 | `/logs/entries/:logId/edit` | home | 隠す | 削除もこの画面（確認ダイアログ） |
| mydrink-list | マイドリンク一覧 | `/logs/my-drinks` | home | 表示 | 入口はホームの「管理」 |
| mydrink-new | マイドリンク登録 | `/logs/my-drinks/new` | home | 隠す | |
| mydrink-edit | マイドリンク編集 | `/logs/my-drinks/:myDrinkId/edit` | home | 隠す | 削除もここ |

`/logs` 配下の予約セグメントは `new` / `my-drinks` / `entries`。`:date` は正規表現 `^\d{4}-\d{2}-\d{2}$` に一致するものだけ日別とみなす。

### 認証後 — セラー

| ID | 画面 | パス | 親タブ | タブバー | 備考 |
|---|---|---|---|---|---|
| bottle-list | セラー（棚） | `/cellar` | cellar | 表示 | 在庫（`sealed`）を 3 列の棚に陳列。種類・検索はクエリ。種類ごとは見出しから `bottle-type-grid` |
| bottle-archive | 貯蔵庫 | `/cellar/archive` | cellar | 表示 | 開栓済み（`consumed`）。月ごと。`/cellar/:bottleId` より静的ルートを優先 |
| bottle-new | ボトルを追加 | `/cellar/new` | cellar | 隠す | 撮影と選択を同じ大きさで並べる。アプリ内導線は `?camera=1` を付けない。ディープリンクの `?camera=1` だけ撮影から。本数 N で N 行 |
| bottle-batch | まとめて追加 | `/cellar/batch` | cellar | 隠す | 撮影とライブラリ（複数枚）を同じ行で並べる。アプリ内導線は `?camera=1` を付けない。1 本ずつ撮って行に積み、最後に 1 回で棚に並べる（≦20 行）。Phase 5.5 #56 |
| bottle-detail | ボトル詳細 | `/cellar/:bottleId` | cellar | 表示 | 主「開栓する」。開栓後は任意の案内シート。詳細に「飲んだ量を記録」「テイスティングノートを書く」。貯蔵庫は「開栓の記録を取り消す」。ノート節は一覧のみ（作成と混同しない） |
| bottle-edit | ボトル編集 | `/cellar/:bottleId/edit` | cellar | 隠す | 削除もここ。共有時は保存先読み取り専用・競合比較 |
| cellar-share-new | セラーを共有する | `/cellar/share` | cellar | 隠す | 空の共有セラーを作る。詳細は [11-shared-cellar.md](screen-designs/11-shared-cellar.md) |
| cellar-share-created | 共有セラー | `/cellar/share/created` | cellar | 隠す | 招待（主）と移動（副） |
| cellar-share-settings | 共有設定 | `/cellar/share/settings` | cellar | 隠す | 名称・参加者・招待・移動・危険操作 |
| cellar-share-invite | 招待 | `/cellar/share/invite` | cellar | 隠す | リンク共有 / コピー |
| cellar-share-move | 自分のボトルを移す | `/cellar/share/move` | cellar | 隠す | 個人→共有。コピーではない |
| cellar-share-activity | 最近の変更 | `/cellar/share/activity` | cellar | 隠す | 共有履歴 |

`/cellar` 配下の予約セグメントは `new` / `batch` / `archive` / `share`。`share` は `:bottleId` より先。

公開の参加画面 `cellar-join` は `/join`（タブ・ヘッダーなし）。トークンは URL フラグメント。

### 認証後 — ノート

| ID | 画面 | パス | 親タブ | タブバー | 備考 |
|---|---|---|---|---|---|
| note-list | ノート一覧 | `/notes` | notes | 表示 | カード一覧。銘柄が主。検索・種類・評価の絞り込みはクエリ。`?bottleId=` でボトル起点。右下 FAB「＋」 |
| note-new | ノート作成 | `/notes/new` | notes | 隠す | 任意クエリ `?bottleId=`、`?from=opened|detail`、`?fromLog=`（UUID。飲酒記録から引き継ぎ）。`?camera=1` は無視（自動起動しない）。写真 ≦6 |
| note-detail | ノート詳細 | `/notes/:noteId` | notes | 表示 | |
| note-edit | ノート編集 | `/notes/:noteId/edit` | notes | 隠す | 削除もここ |

### 認証後 — 設定（MVP）

| ID | 画面 | パス | 親タブ | 備考 |
|---|---|---|---|---|
| settings | 設定 | `/settings` | settings | ログアウト必須。表示名は任意（インライン編集）。メールは表示のみ。アカウント削除は `/settings/account/delete`。写真の既定 2 スイッチ、記録（現在地を記録する）、操作（触感・動きを減らす・使い方を見る→扇で記録/セラー/ノート）は端末保存。「このアプリ」から利用規約・PP。テーマ切替・招待コードは置かない |
| settings-account-delete | アカウントを削除 | `/settings/account/delete` | settings（確認済み） / なし | タブバーなし。年齢確認不要。本人確認のうえ削除を受け付ける |

### 共通

| ID | 画面 | パス | 備考 |
|---|---|---|---|
| not-found | 404 | 一致しないパス（`*`） | ログイン済みは認証後シェル＋キャラ `surprised`＋「ページが見つかりませんでした」。未ログインは `/login` へ |
| photo-edit | 写真を編集 | ルートなし（全画面オーバーレイ） | 記録・セラー・ノートの作成・編集から。`pushState` 1 段で戻るに反応。タブバー非表示 |
| bottle-type-grid | 種類の棚 | ルートなし（全画面オーバーレイ） | 種類ごと表示の見出しから。`pushState` 1 段で戻るに反応。タブバー非表示。4 列。閉じるとき並びを保存 |
| account-deleted | 削除受付完了 | `/account-deleted` | 認証不要。受付後の案内。完了断定はしない |

API が 404 を返した詳細（他ユーザーのボトル、存在しない ID）も、クライアントは同じ `not-found` を出す。403 で存在を漏らさない（サーバー規約に合わせる）。

---

## 入場経路と戻り

| ID | 主な入場 | 戻り | 保存成功後 |
|---|---|---|---|
| auth-login | 直接、ガード、サインアップからのリンク | — | `/` または安全な `redirect` |
| auth-signup | ログインからのリンク | ログイン | 登録成功後はログイン済みなら `/` |
| legal-terms | サインアップ / 設定 / 直接 | 履歴。無ければ `from`（signup / login / settings）。不正は `/signup` | — |
| legal-privacy | 同上 | 同上 | — |
| home | タブ、ログイン後のデフォルト | — | — |
| summary-week | ホームの「詳しく見る ›」、月サマリーの週行（今週の日付は各日の `log-day` へ。X6） | ホーム | — |
| summary-month | 週サマリーの「今月 ›」 | 週サマリー（履歴） | — |
| log-day | ホームの今日カード（今日）、ホームの週マス（その日）、入力・編集の保存後（`?highlight=`）、週サマリーの日別行、日送り | 履歴戻り（無ければ `/`）。ヘッダー左右は日送りに使うため戻るボタンは置かず、ホームタブ（現在地）でも戻れる | — |
| log-new | 中央タブ「記録」（写真なし）。ボトル詳細・開栓後案内。写真はフォーム内の「写真を撮る / 選ぶ」 | 履歴戻り（`from=opened|detail` ならボトル詳細。無ければその日の `log-day`） | 保存後ダイアログ。「つける」は `note-new?fromLog=`。「あとで」は対象日の `log-day?highlight=` |
| log-edit | 日別の行タップ、ボトル詳細の記録行 | 対象日の `log-day` | 対象日の `log-day` |
| mydrink-list | ホームの「管理」 | ホーム | — |
| mydrink-new / mydrink-edit | 一覧の追加・行 | 一覧 | 一覧 |
| bottle-list | セラータブ、開栓後、復元後 | — | — |
| bottle-archive | 棚ヘッダー左の「貯蔵庫」 | 棚 | — |
| bottle-new | 棚の「+」（撮影から） | 棚 | 作成した最初の `bottle-detail` |
| bottle-batch | 棚の「まとめて追加」（撮影から） | 棚 | 棚（`/cellar`） |
| bottle-detail | 棚 / 貯蔵庫のボトル、ノート詳細のボトル行、記録の「セラーから」、開栓後の案内からの戻り | 棚（貯蔵庫の本は貯蔵庫） | 開栓成功後は詳細に留まる。記録・ノートは作らない |
| bottle-edit | 詳細の編集 | 詳細 | 詳細 |
| note-list | ノートタブ、詳細の「一覧」、ボトル詳細「すべて」 | — | — |
| note-new | 一覧の右下「＋」、空状態の「ノートを作成」、ボトル詳細「書く」、`log-new` 保存後の「つける」（`?fromLog=`。いずれもフォームへ。撮影しない） | 履歴（無ければ一覧。`fromLog` は履歴戻り） | 作成した `note-detail` |
| note-detail | 一覧カード、ボトル詳細のノート行 | 一覧（`bottleId` 付きなら維持） | — |
| note-edit | 詳細の編集 | 詳細 | 詳細 |
| photo-edit | 作成・編集画面の写真タイル、`?camera=1` | 呼び出し元（フォーム状態を保持） | 呼び出し元にサムネ + `photoId` |
| bottle-type-grid | 種類ごと表示の見出し | 棚（dirty なら保存してから） | — |
| settings | 設定タブ | — | 表示名保存後は設定に留まる |
| settings-account-delete | 設定 S16、年齢確認 A9 | 設定または `/age` | 受付成功は `/account-deleted` |
| account-deleted | 削除受付後 | — | 「ログインへ」で `/login` |
| not-found | 不明 URL、API 404 | ホーム（認証後）またはログイン | — |

ホームのマイドリンク 1 タップ記録は **画面遷移しない**。undo はトースト 5 秒。中央タブは画面ではなく **記録作成**（`/logs/new`。撮影は開始しない）。ホームに記録・撮影のボタンは置かない。撮影は `log-new` 内の明示タップだけ。

機能間連携のうち **開栓だけで記録やノートを自動作成しない**（2026-09-06 / 2026-09-08）。開栓後の案内とボトル詳細から、任意で `log-new` / `note-new` をボトル付きで開ける。`log-new` 保存後だけ「テイスティングノートをつける？」を出し、つけると `note-new?fromLog=` へ識別と写真（未紐付け複製）を引き継ぐ。開栓 / ボトル詳細から記録・ノートへ進むときもボトル写真を複製して入れる。ノートから記録は作らない。ノート作成時の飲酒記録同時作成は v1.x のまま。

初回ガイドはルートを持たないオーバーレイ（[screen-designs/08-first-run-guide.md](screen-designs/08-first-run-guide.md)）。練習は保存しない。記録は保存までスポットライト。設定「使い方を見る」から扇でセラー／ノートも同じ形式で案内する。

---

## ヘッダータイトル（2-05 用）

ユーザー入力をタイトルに出す場合はテキストとしてレンダリングする（HTML 埋め込み禁止）。

| 画面 ID | タイトル案 |
|---|---|
| home | ホーム |
| summary-week | 今週 |
| summary-month | 今月 |
| log-day | 日付（JST、例: 9月4日） |
| log-new | お酒を記録 |
| log-edit | 記録を編集 |
| mydrink-list | マイドリンク |
| mydrink-new | マイドリンクを追加 |
| mydrink-edit | マイドリンクを編集 |
| bottle-list | セラー（右に muted で「N 本」） |
| bottle-archive | 貯蔵庫（右に「N 本」） |
| bottle-new | ボトルを追加 |
| bottle-detail | 品名（データ。未取得時は「ボトル」） |
| bottle-edit | ボトルを編集 |
| note-list | ノート |
| note-new | ノートを作成 |
| note-detail | 品名または「ノート」 |
| note-edit | ノートを編集 |
| settings | 設定 |
| not-found | 見つかりません |
| auth-login | ログイン |
| auth-signup | アカウント作成 |
| auth-age | 年齢確認 |
| legal-terms | 利用規約 |
| legal-privacy | プライバシーポリシー |

---

## 将来画面（MVP ではルートを作らない）

存在だけ残し、パスは Phase 実装時に決める。画面 ID は予約する。

| ID | 画面 | 時期 | 備考 |
|---|---|---|---|
| auth-reset | パスワードリセット | Phase 8 | メール送信基盤が前提 |
| settings-goals | 目標設定 | v1.x | 週あたり純アルコール上限、休肝日目標 |

OAuth（Google）は独立画面にせず、`auth-login` の「Googleアカウントでログインする」／`auth-signup` の「Googleアカウントで登録する」（8-04）。

---

## セキュリティ

- ルートガードは補助。未ログインでも推測した URL を叩けば API は 401。他ユーザーの `:bottleId` / `:noteId` / `:logId` は API が 404（存在と権限を区別しない）
- `/cellar/:bottleId` 等は IDOR テスト対象。ID は推測困難な値にする（1-04）
- `redirect` クエリはオープンリダイレクト対策（認証境界の節）
- 画面を隠しても認可にはならない
- 他ユーザーのボトルが並ぶ「発見」「公開プロフィール」は作らない

---

## 受け入れ（1-01 / 1-07）

- [x] 画面一覧がファイルになっている（本ファイル）
- [x] タブ構成がオーナー承認済み（2026-09-04: 5 タブ）
- [x] タブ順・ルート・FAB なし等の設計判断も当面これで承認（2026-09-04）
- [x] タブ順（記録中央）と新ルート（`bottle-archive` / `photo-edit`）のオーナー承認（1-07。2026-09-06）。`bottle-consume` は 2026-09-06 に廃止
- [x] 中央タブの挙動を (c) 撮影開始（着地なし）で確定。`/logs` 配下の親タブはホーム（2026-09-06）
- [x] MVP と v1.x が混線していない（将来画面は別表、MVP ルートに含めない）
- [x] 未ログイン時の遷移が書いてある
- [x] ナビは隠蔽に使わない（認可は API）

---

## 関連

- [01-requirements.md](01-requirements.md)
- [00-overview.md](00-overview.md)
- 詳細画面設計: [screen-designs/](screen-designs/README.md)（配置・要素・状態の正本）
- 手順: [roadmap/phase-01-design/01-screens-navigation.md](../roadmap/phase-01-design/01-screens-navigation.md)、[roadmap/phase-01-design/07-detailed-screen-design.md](../roadmap/phase-01-design/07-detailed-screen-design.md)
- 骨格（履歴）: [wireframes.md](wireframes.md)
- 実装: [roadmap/phase-02-platform/05-common-layout.md](../roadmap/phase-02-platform/05-common-layout.md)
