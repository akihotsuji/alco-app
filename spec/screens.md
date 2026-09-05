# 画面一覧とナビゲーション構造

Phase 1-01 の成果物（2026-09-05 に 1-07 で改訂）。アプリに存在する画面、下部タブ、認証境界、入場経路を定義する。

**Phase 2-05（共通レイアウト / React Router）はこのファイルを正本にする。** ルート実装・タブ構成・ガードは本仕様に従う。各画面の要素・状態・遷移・モックは [screen-designs/](screen-designs/README.md)（詳細画面設計。**実装はこのとおりに作る**）。見た目の数値は [design-system.md](design-system.md)。リソース ID の採番は [1-04](../roadmap/phase-01-design/04-er-drizzle-schema.md)。

実装コードは本タスクの対象外。

## 確定事項

| 項目 | 決定 | 日付 |
|---|---|---|
| 下部タブ数 | **5 タブ** | 2026-09-04 オーナー |
| 下部タブ順 | **ホーム / セラー / 記録（中央） / ノート / 設定**。記録は円形 primary で浮かせる | 2026-09-05 オーナー指示（1-07。承認待ち） |
| 招待制 | 採用しない。サインアップに招待コード入力は置かない | 2026-08-13 |
| UIテーマ切替 | アプリ内切替画面・設定項目は置かない（OS 外観設定に追従） | 2026-08-13 |
| 日付境界 | 日別ビューの日付は Asia/Tokyo のカレンダー日 | 2026-08-13 |
| セラーの見せ方 | 棚（陳列）。消費で貯蔵庫（`/cellar/archive`）へ | 2026-09-05 オーナー指示（1-07） |
| 成果物ファイル | 本ファイル（`spec/screens.md`） | 2026-09-04 |

## 設計判断（2026-09-04 承認 → 1-07 で更新）

| 項目 | 判断 | 理由 |
|---|---|---|
| タブ順 | ホーム → セラー → **記録** → ノート → 設定 | 記録が最頻（オーナー指示）。中央に置き、親指の届く位置で目立たせる。2026-09-04 の「中央案不採用」を覆す |
| 中央タブの着地 | `/logs`（今日の日別）。日別の最上部に「記録する」「カメラ」「マイドリンク 1 タップ」 | どこからでも 2 タップで保存。直接 `log-new` を開く案は [screen-designs/README.md](screen-designs/README.md) の要確認 |
| 記録入力のルート | 独立パス `/logs/new`。**フルスクリーン**（シートにしない）。`?camera=1` で撮影から始める | 1-02 確定。ディープリンクと戻りが明確 |
| 写真編集 | ルートを持たない全画面オーバーレイ（`photo-edit`）。`pushState` 1 段 | フォーム状態を保つ |
| マイドリンク | 記録タブ配下 | 記録のプリセットであり、設定に置くと遠い |
| 週 / 月サマリー | ホーム配下 | ホームの 7 マスから週サマリーへ（1-02） |
| 貯蔵庫（アーカイブ） | セラー配下の独立画面 `/cellar/archive`。ヘッダー左のボタンから | 棚と分けて在庫感を守る |
| 消費 | ルートを持たないダイアログ。成功で `/logs/:date?highlight=` へ | その日の記録へ移る（オーナー指示） |
| 表示名 | 設定画面の任意項目。独立画面は作らない | Better Auth の name を出す想定。未設定でも使える |
| 作成・編集中のタブバー | 隠す | 入力領域と保存ボタンを優先。キーボード時も保存バーは残す（1-02） |
| ボトルのノート一覧 | 独立画面は作らない | ボトル詳細内のセクション。必要なら `/notes?bottleId=` へ |
| FAB | 置かない。**中央タブが主導線** | 1-02。主アクションは画面内ボタン |
| 1 タップ記録・消費の undo | トースト 5 秒 | 1-02 / 1-07 |

タブアイコン（絵文字禁止、SVG）は design-system。配置の正本は [screen-designs/](screen-designs/README.md)。

---

## 認証境界

クライアントのルートガードは UX 用。認可の正はサーバー API（[security.mdc](../.cursor/rules/security.mdc)、[api-design.md](api-design.md)）。ナビや非表示はアクセス制御に使わない。

| 区分 | 対象 | 未ログイン時 | ログイン済みで当該 URL に来たとき |
|---|---|---|---|
| 公開 | `auth-login` `/login`、`auth-signup` `/signup` | 表示 | `/` へリダイレクト |
| 認証後 | 下部タブ配下の全画面、サマリー、作成・編集、404（認証後シェル） | `/login?redirect=<元パス>` へ | 表示 |
| MVP 対象外 | `auth-age` ほか将来画面 | ルートを作らない | — |

`redirect` はアプリ内の相対パスのみ許可する（`/` で始まり `//` やスキームを含まない）。オープンリダイレクト禁止。許可リストに無い・不正な値は `/` へ。

未ログインで認証後 URL（例: `/cellar/abc`）に来たら、上記のとおりログインへ送り、成功後に元パスへ戻す。

---

## 下部タブ（認証後シェル）

常時表示する。ただし作成・編集画面（後述の「タブを隠す」）では非表示。

| 位置 | タブ ID | ラベル | ルート | 主画面 ID | タブを選んだときの着地 |
|---|---|---|---|---|---|
| 1 | home | ホーム | `/` | `home` | 当日サマリー＋ショートカット |
| 2 | cellar | セラー | `/cellar` | `bottle-list` | 棚（陳列） |
| 3（中央） | log | 記録 | `/logs` | `log-day` | 今日（JST）の日別ビュー。最上部に記録・カメラ・マイドリンク |
| 4 | notes | ノート | `/notes` | `note-list` | 写真グリッド |
| 5 | settings | 設定 | `/settings` | `settings` | ログアウト・アカウント・写真の既定 |

中央タブは直径 60px の円形 primary ボタン（[screen-designs/00-common.md](screen-designs/00-common.md)）。タブの現在地ハイライトは「親タブ」列に従う（例: `/summary/week` はホーム、`/cellar/archive` はセラー）。

ラベルは日本語のまま。5 タブは iPhone SE（320px）で折り返すリスクがある。2-05 で 320px / 390px を確認し、切れ・折り返しがあれば design-system の字サイズで調整する。MVP ではアイコンのみタブにはしない。

---

## 画面一覧

画面 ID は後続の API・テスト・ワイヤーから参照する短い slug。変更するときは本ファイルと参照元を同時に直す。

### 認証前（MVP）

| ID | 画面 | パス | 備考 |
|---|---|---|---|
| auth-login | ログイン | `/login` | メール＋パスワード |
| auth-signup | サインアップ | `/signup` | メール＋パスワード。招待制は置かない |

### 認証後 — ホーム

| ID | 画面 | パス | 親タブ | 備考 |
|---|---|---|---|---|
| home | ホーム | `/` | home | 当日の杯数・純アルコール量、休肝日、記録ショートカット、直近マイドリンク |
| summary-week | 週サマリー | `/summary/week` | home | 推移・休肝日数 |
| summary-month | 月サマリー | `/summary/month` | home | 推移・休肝日数 |

### 認証後 — 記録

| ID | 画面 | パス | 親タブ | タブバー | 備考 |
|---|---|---|---|---|---|
| log-day | 日別記録 | `/logs`（今日）、`/logs/:date` | log | 表示 | `:date` は JST の `YYYY-MM-DD` のみ。`?highlight=<logId>` で行を 2 秒強調 |
| log-new | 記録入力 | `/logs/new` | log | 隠す | 任意クエリ `?date=YYYY-MM-DD`（過去日）、`?camera=1`（撮影から）、`?bottleId=`（ボトル事前選択） |
| log-edit | 記録編集 | `/logs/entries/:logId/edit` | log | 隠す | 削除もこの画面（確認ダイアログ） |
| mydrink-list | マイドリンク一覧 | `/logs/my-drinks` | log | 表示 | |
| mydrink-new | マイドリンク登録 | `/logs/my-drinks/new` | log | 隠す | |
| mydrink-edit | マイドリンク編集 | `/logs/my-drinks/:myDrinkId/edit` | log | 隠す | 削除もここ |

`/logs` 配下の予約セグメントは `new` / `my-drinks` / `entries`。`:date` は正規表現 `^\d{4}-\d{2}-\d{2}$` に一致するものだけ日別とみなす。

### 認証後 — セラー

| ID | 画面 | パス | 親タブ | タブバー | 備考 |
|---|---|---|---|---|---|
| bottle-list | セラー（棚） | `/cellar` | cellar | 表示 | 在庫（`sealed` / `opened`）を 3 列の棚に陳列。種類・状態・検索はクエリ |
| bottle-archive | 貯蔵庫 | `/cellar/archive` | cellar | 表示 | 消費済み（`consumed`）。月ごと。`/cellar/:bottleId` より静的ルートを優先 |
| bottle-new | ボトルを追加 | `/cellar/new` | cellar | 隠す | `?camera=1`（既定で撮影から）。本数 N で N 行 |
| bottle-detail | ボトル詳細 | `/cellar/:bottleId` | cellar | 表示 | 主「消費する」、副「開栓する」「1 杯を記録」。貯蔵庫の本は「セラーに戻す」。ノート・記録セクション |
| bottle-edit | ボトル編集 | `/cellar/:bottleId/edit` | cellar | 隠す | 削除もここ |
| bottle-consume | 消費（ダイアログ） | ルートなし | cellar | — | 詳細から。成功で `/logs/:date?highlight=` へ |

`/cellar` 配下の予約セグメントは `new` / `archive`。

### 認証後 — ノート

| ID | 画面 | パス | 親タブ | タブバー | 備考 |
|---|---|---|---|---|---|
| note-list | ノート一覧 | `/notes` | notes | 表示 | 写真グリッド 2 列。銘柄・種類・評価の絞り込みはクエリ。`?bottleId=` でボトル起点 |
| note-new | ノート作成 | `/notes/new` | notes | 隠す | 任意クエリ `?bottleId=`、`?camera=1`（撮影から）。写真 ≦6 |
| note-detail | ノート詳細 | `/notes/:noteId` | notes | 表示 | |
| note-edit | ノート編集 | `/notes/:noteId/edit` | notes | 隠す | 削除もここ |

### 認証後 — 設定（MVP）

| ID | 画面 | パス | 親タブ | 備考 |
|---|---|---|---|---|
| settings | 設定 | `/settings` | settings | ログアウト必須。表示名は任意。メールは表示のみ（変更 UI は持たない）。写真の既定 2 スイッチ（端末保存）。テーマ切替・招待コードは置かない |

### 共通

| ID | 画面 | パス | 備考 |
|---|---|---|---|
| not-found | 404 | 一致しないパス（`*`） | ログイン済みは認証後シェル＋キャラ `surprised`＋「ページが見つかりませんでした」。未ログインは `/login` へ |
| photo-edit | 写真を編集 | ルートなし（全画面オーバーレイ） | 記録・セラー・ノートの作成・編集から。`pushState` 1 段で戻るに反応。タブバー非表示 |

API が 404 を返した詳細（他ユーザーのボトル、存在しない ID）も、クライアントは同じ `not-found` を出す。403 で存在を漏らさない（サーバー規約に合わせる）。

---

## 入場経路と戻り

| ID | 主な入場 | 戻り | 保存成功後 |
|---|---|---|---|
| auth-login | 直接、ガード、サインアップからのリンク | — | `/` または安全な `redirect` |
| auth-signup | ログインからのリンク | ログイン | 登録成功後はログイン済みなら `/` |
| home | タブ、ログイン後のデフォルト | — | — |
| summary-week | ホームの週次バー / リンク | ホーム | — |
| summary-month | ホームまたは週サマリーからのリンク | ホーム | — |
| log-day | 中央タブ、入力保存後、消費後、日送り | タブの根（今日）以外は履歴戻り | — |
| log-new | ホーム / 日別の「記録する」「カメラ」、ボトル詳細「1 杯を記録」、ディープリンク | 履歴戻り（無ければその日の `log-day`） | 対象日の `log-day?highlight=` |
| log-edit | 日別の行タップ、ボトル詳細の記録行 | 対象日の `log-day` | 対象日の `log-day` |
| mydrink-list | 日別またはホームからの「管理」 | 記録タブの日別 | — |
| mydrink-new / mydrink-edit | 一覧の追加・行 | 一覧 | 一覧 |
| bottle-list | セラータブ、消費（記録なし）後、復元後 | — | — |
| bottle-archive | 棚ヘッダー左の「貯蔵庫」 | 棚 | — |
| bottle-new | 棚の「+」（撮影から） | 棚 | 作成した最初の `bottle-detail` |
| bottle-detail | 棚 / 貯蔵庫のボトル、ノート詳細のボトル行、記録の「セラーから」 | 棚（貯蔵庫の本は貯蔵庫） | — |
| bottle-consume | 詳細「消費する」 | 詳細（キャンセル） | `/logs/:date?highlight=`（記録あり）/ 棚（記録なし） |
| bottle-edit | 詳細の編集 | 詳細 | 詳細 |
| note-list | ノートタブ、詳細の「一覧」、ボトル詳細「すべて」 | — | — |
| note-new | 一覧の「+」（撮影から）、ボトル詳細「書く」 | 履歴（無ければ一覧） | 作成した `note-detail` |
| note-detail | 一覧カード、ボトル詳細のノート行 | 一覧（`bottleId` 付きなら維持） | — |
| note-edit | 詳細の編集 | 詳細 | 詳細 |
| photo-edit | 作成・編集画面の写真タイル、`?camera=1` | 呼び出し元（フォーム状態を保持） | 呼び出し元にサムネ + `photoId` |
| settings | 設定タブ | — | 表示名保存後は設定に留まる |
| not-found | 不明 URL、API 404 | ホーム（認証後）またはログイン | — |

ホーム・日別上のマイドリンク 1 タップ記録は **画面遷移しない**。undo はトースト 5 秒。

機能間連携のうち **消費 → 記録** は MVP（1-07 で繰り上げ）。ノート作成時の飲酒記録同時作成は v1.x のまま。

---

## ヘッダータイトル（2-05 用）

ユーザー入力をタイトルに出す場合はテキストとしてレンダリングする（HTML 埋め込み禁止）。

| 画面 ID | タイトル案 |
|---|---|
| home | ホーム |
| summary-week | 今週 |
| summary-month | 今月 |
| log-day | 日付（JST、例: 9月4日） |
| log-new | 記録する |
| log-edit | 記録を編集 |
| mydrink-list | マイドリンク |
| mydrink-new | マイドリンクを追加 |
| mydrink-edit | マイドリンクを編集 |
| bottle-list | セラー（右に muted で「N 本」） |
| bottle-archive | 貯蔵庫（右に「N 本」） |
| bottle-new | ボトルを追加 |
| bottle-detail | 銘柄名（データ。未取得時は「ボトル」） |
| bottle-edit | ボトルを編集 |
| note-list | ノート |
| note-new | ノートを作成 |
| note-detail | 銘柄名または「ノート」 |
| note-edit | ノートを編集 |
| settings | 設定 |
| not-found | 見つかりません |
| auth-login | ログイン |
| auth-signup | アカウント作成 |

---

## 将来画面（MVP ではルートを作らない）

存在だけ残し、パスは Phase 実装時に決める。画面 ID は予約する。

| ID | 画面 | 時期 | 備考 |
|---|---|---|---|
| auth-age | 年齢確認（20 歳以上） | Phase 8 | 一般公開時。個人利用 MVP では出さない |
| auth-reset | パスワードリセット | Phase 8 | メール送信基盤が前提 |
| settings-goals | 目標設定 | v1.x | 週あたり純アルコール上限、休肝日目標 |
| legal-terms | 利用規約 | Phase 8 | |
| legal-privacy | プライバシーポリシー | Phase 8 | |

OAuth（Google 等）は独立画面にせず、`auth-login` / `auth-signup` 上の追加手段として Phase 8 で足す。

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
- [ ] タブ順（記録中央）と新ルート（`bottle-archive` / `bottle-consume` / `photo-edit`）のオーナー承認（1-07）
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
