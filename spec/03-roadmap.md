# 開発ロードマップ

デザイン・プログラミング・インフラを中心とした、本番リリースまでのロードマップ。
AIエージェント主導の開発を前提に、各フェーズに「完了条件（DoD）」と「そのフェーズで整備するrules/skills」を定義する。
各タスクの仕様書・手順書は [roadmap/README.md](../roadmap/README.md) を参照。オーナー決定の FIX 事項も同ファイルにまとめてある。

## 全体像

```
Phase 0  プロジェクト基盤        リポジトリ・CI・Cloudflare環境・ルール整備
Phase 1  設計                    画面設計・デザインシステム・データモデル・API設計
Phase 2  土台実装                スキャフォールド・DB・認証・共通レイアウト
Phase 3  飲酒記録（MVPコア）     記録・マイドリンク・サマリー
Phase 4  セラー管理              在庫CRUD・写真アップロード
Phase 5  テイスティングノート    ノートCRUD・セラー連携
Phase 5.5 実機検証・機能安定化    Phase 3〜5の実機探索、Issue化、1件ずつ修正
Phase 6  PWA・品質仕上げ         PWA対応・E2E・パフォーマンス・a11y
Phase 7  本番リリース            環境分離・バックアップ・監視・リリース
Phase 8  （将来）一般公開準備    法対応・レート制限・OAuth
```

- 期間の目安は「AIエージェントが実装し、オーナーが毎日30分〜1時間レビューする」想定。
- 各フェーズの開始時に、対象機能の詳細仕様を `spec/features/` に作成してから実装に入る（仕様→実装→テスト→ドキュメント同期のサイクルを守る）。

---

## Phase 0: プロジェクト基盤（目安: 2〜3日）

**目的**: コードを1行書く前に、品質を機械的に担保する仕組みを整える。AIエージェント開発では「壊れたらCIが止める」体制が生命線。

### タスク

- [x] Gitリポジトリ初期化、GitHubプライベートリポジトリ作成
- [x] Node.js / pnpm / wrangler のローカル環境セットアップ
- [x] Cloudflareアカウント作成、D1データベース・R2バケット作成（dev用）
- [x] Vite + React + Hono + Cloudflare Workers の空プロジェクト作成（Hello Worldが `wrangler dev` で動く）
- [x] TypeScript strict設定、Biome導入（lint / format）
- [x] Vitest導入（サンプルテスト1件がパスする）
- [x] GitHub Actions: PR時に lint / typecheck / test / `pnpm audit`（依存脆弱性チェック）を実行するCI
- [x] mainブランチ保護（直接pushの禁止。必須チェックなし。ruleset `protect-main` 適用済み）
- [x] `.cursor/rules/` の整備（下記）

### rules / skills

- rule: `project-context`（常時適用）— プロダクト概要・技術スタック・ディレクトリ構成
- rule: `development-workflow`（常時適用）— 仕様駆動・ブランチ運用・コミット規約・DoD
- rule: `security`（常時適用）— 認可・入力検証・XSS・シークレット等のセキュリティ規約
- rule: `coding-standards`（*.ts / *.tsx）— TypeScript・エラーハンドリング・テスト規約
- skill: `feature-dev` — 機能開発の標準ワークフロー（仕様確認→実装→テスト→監査→ドキュメント同期）
- skill: `security-audit` — 変更差分に対するセキュリティ監査チェックリスト（PR前に必須実施）

### 完了条件（DoD）

- `wrangler dev --env dev` でHello Worldアプリがローカル起動する
- PRを作るとCIが走り、lint/typecheck/testが全てパスする
- rules/skillsがリポジトリにコミットされている

---

## Phase 1: 設計（目安: 3〜5日）

**目的**: 実装前に「何をどう作るか」を文書化し、後続フェーズの手戻りをなくす。

### タスク

**デザイン**
- [x] 画面一覧とナビゲーション構造の決定（下部タブ: ホーム/セラー/**記録（中央）**/ノート/設定。正本は [screens.md](screens.md)。2026-09-05 に記録を中央へ）
- [x] 主要画面のワイヤーフレーム（1-02 の骨格 → [wireframes.md](wireframes.md)。配置の正本は 1-07 へ移行）
- [x] デザインシステム定義: **ニューモーフィズム**、**ライト／ダークはOS設定に追従**、タイポグラフィ・余白・コンポーネント方針 → [design-system.md](design-system.md)
- [x] **1-07 詳細画面設計**: 全画面の要素表・状態・遷移・モックを画面単位で確定し、「設計どおりに実装する」ルールを敷く → [screen-designs/](screen-designs/README.md)（2026-09-05 追加。2026-09-06 承認。中央タブの挙動は同日 **(c) 撮影開始** で確定）
  - 記録タブ中央（タップで撮影開始。着地画面なし）、セラーは棚（陳列）＋貯蔵庫、追加と開栓、開栓 → 貯蔵庫（記録は作らない。2026-09-06）、写真を撮って記録・ノート
- [x] **1-08 キャラクター**: 赤ワイングラスに目のマスコット（4 ポーズ SVG）、配置・写真合成ルール → [character.md](character.md)（2026-09-05 追加。2026-09-06 承認。名前は付けない）
- [x] **1-09 モーション・マイクロインタラクション**: 状態変化の瞬間だけ動く演出 `M-01`〜`M-32`、トークン、reduced motion、haptic（既定 OFF）、体験改善 X1〜X8 → [motion-design.md](motion-design.md)（2026-09-06 追加・同日承認。実装は Phase 3 / 4 の各タスクに同梱。ダーク `--primary` を `#CC8484` に改訂）

**データ・API設計**
- [x] ER図とDrizzleスキーマ設計（Auth の `user` / drink_logs / my_drinks / bottles / tasting_notes / photos）→ `spec/data-model.md`
- [x] API設計: リソース単位のエンドポイント一覧、認可ルール（全データ user_id スコープ）→ [api-design.md](api-design.md)
- [x] 純アルコール量計算・標準グラス量プリセットの仕様確定 → [features/alcohol-calculation.md](features/alcohol-calculation.md)
- [x] 1-07 に伴う改訂の承認（2026-09-06）: `bottles.status` に `consumed`、`consumed_at/on`、`quantity` 廃止（1 行 = 1 本）、`drink_logs.bottle_id`、`photos.drink_log_id`、`photos.kind`、`ai_usage`、`POST /api/bottles/:id/consume|restore`、`POST /api/bottles/recognize`、`view`、`count`、`photoIds`、未紐付け写真 GC（data-model / api-design 内「1-07 改訂」）
- [x] 2026-09-05（2 回目）オーナー決定: 棚は **地色の上にガラス風の棚板 + 切り抜きボトル**（切り抜きを MVP へ）、**種類ごと / 1 本ずつ**の表示切替、ラベル読み取りは **Workers AI（Vision）** でセラーのみ（Gemini 等は将来の差し替え候補）、デザイン崩れ（週マスの薄赤・チップの被り）は影トークンの 2 段階化で修正

### rules / skills

- rule: `database`（src/db/**）— スキーマ変更は必ずマイグレーション経由、命名規約
- rule: `ui-design`（src/client/**）— 追加済み。デザイントークン、モバイルファースト、ニューモーフィズム、コンポーネント分割

### 完了条件（DoD）

- `spec/design-system.md` / `spec/data-model.md` / `spec/api-design.md` / `spec/features/alcohol-calculation.md` がレビュー・承認済み
- ワイヤーフレームについてオーナーの合意が取れている
- `spec/screen-designs/` と `spec/character.md` がオーナー承認済み（1-07 / 1-08。2026-09-05 追加）

---

## Phase 2: 土台実装（目安: 1〜1.5週間）

**目的**: 全機能が乗る共通基盤（DB・認証・レイアウト・型共有・**写真パイプライン**）を作る。

### タスク

- [x] Drizzleスキーマ実装とマイグレーション運用の確立（ローカルD1に適用。1-07 改訂後のスキーマ。skill `db-migration` 同梱）
- [x] Better Auth導入: サインアップ/ログイン/ログアウト、セッション管理（招待制は採用しない）
- [x] Hono APIの基本構造: ルーティング分割、認証ミドルウェア、エラーハンドリング、Zodバリデーション（rule `api-conventions` 同梱。CSP は API / 静的アセットの 2 箇所）
- [x] Hono RPC + TanStack Query のクライアント側データ取得基盤（`src/client/lib/api.ts` / `hooks/`。決定は [02-tech-stack.md](02-tech-stack.md) 「クライアントのデータ取得」）
- [x] 共通レイアウト実装: 下部タブ（**記録が中央の円形ボタン**）、ヘッダー、トースト、ダイアログ、空・ローディング/エラー表示（[screen-designs/00-common.md](screen-designs/00-common.md) どおり）
- [x] デザイントークン（Tailwind設定）とshadcn/ui導入、基本コンポーネント、**`<Mascot />` コンポーネント**（4 ポーズ）
- [x] **写真パイプライン基盤（2-08）**: `photo-edit`（撮影 → 比率切り抜き → 色補正 → キャラ合成 → JPEG）、`POST /api/photos`（magic bytes・1MB・未紐付け）、`GET /api/photos/:id/content`、未紐付け GC の Cron（[screen-designs/07-photo-capture.md](screen-designs/07-photo-capture.md)）
- [x] 認証周りの単体テスト・APIテスト

### rules / skills

- skill: `db-migration` — マイグレーション作成・適用・ロールバックの手順書
- rule: `api-conventions`（src/server/**）— ルート構成、レスポンス形式、認可チェック必須の徹底

### 完了条件（DoD）

- サインアップ→ログイン→空のホーム画面（キャラクター付き）表示までがスマートフォン実機（ブラウザ）で動く
- 未ログイン時にAPIが401を返し、他ユーザーのデータにアクセスできないことがテストで担保されている
- 実機で写真を撮り、編集画面を通して未紐付けでアップロードでき、他ユーザーから取得できないことがテストで担保されている

---

## Phase 3: 飲酒記録機能（目安: 1〜1.5週間）

**目的**: 毎日使うコア機能を最初に完成させ、実際に使いながら改善する（ドッグフーディング開始）。

### タスク

- [x] `spec/features/drink-log.md` 作成（画面項目・バリデーション・計算仕様。[screen-designs/03-log.md](screen-designs/03-log.md) を写す）→ [features/drink-log.md](features/drink-log.md)（2026-09-06 作成・承認）
- [x] 記録入力画面: 種類選択→量・度数プリセット→保存 を最短タップ数で。最上部に**写真タイル**（任意）、ボトル紐付け行（API の `bottleId` のみ。行の UI は Phase 4-02）、`?camera=1`。**モーション共通基盤を同梱**（[motion-design.md](motion-design.md): トークン、`Button` / `Chip` の `data-state`、水位線 M-04〜M-06、`useReducedMotion()`、`haptic.ts`、ダーク `--primary` `#CC8484`）→ `POST /api/drink-logs`、`GET` / `DELETE /api/drink-logs/:id`、`src/client/components/logs/`（3-02。2026-09-06）
- [x] **中央タブ「記録」とホームのカメラ円ボタンを撮影開始に**（(c)）: タップで記録用 `photo-edit`、「使う」で写真付き `log-new`、× / OS キャンセルは元の画面。着地・現在地ハイライトなし、`/logs` 配下の親タブはホーム（[screen-designs/00-common.md](screen-designs/00-common.md) 1.2、[02-home.md](screen-designs/02-home.md) H9）→ `useCaptureLog`、`photo-edit-context` の `CaptureIntent`（2026-09-06）
- [x] マイドリンク（プリセット）の登録・1タップ記録（**ホームのみ**。チップの水位線 M-07 / M-08、数字カウント M-09、週マス M-17、休肝ピル M-18）。同じタスクで **ホームの残りの導線**を (c) に合わせる: 今日カード → 今日の `/logs`、カード内「今週 ›」→ 週サマリー（[02-home.md](screen-designs/02-home.md) H2 / H13）（3-03。2026-09-06）
- [x] 純アルコール量計算ロジック（単体テスト必須）→ `src/shared/alcohol.ts`（3-04）
- [x] 日別ビュー（**ホームの今日カード / 週マス / 保存後 / 週サマリーの行から入る。中央タブの着地ではない**）: 当日の記録一覧（写真サムネ）・合計、編集・削除、`?highlight=`（行の挿入 + リング + スクロールを `useHighlightRow` に。M-14〜M-16、X1、X2、X7）。最上部の記録・カメラ・マイドリンクは置かない（3-05。2026-09-06）
- [x] 週/月サマリー: 推移グラフ（自前 SVG。初回 1 回だけ伸びる M-19）、休肝日表示。入口はホームの「今週 ›」→ 週、週の「今月 ›」→ 月、月の行 → 週、週の行 → 日別。**3-06**（2026-09-06）
- [ ] ホームのキャラクター（`default` / `rest` / 1 タップ後 `cheer` + 4px 移動。週マスのタップ先はその日の日別 X6）
- [x] 設定「操作」節: 表示名インライン編集、触感フィードバック（既定 OFF）・動きを減らす（[screen-designs/06-settings.md](screen-designs/06-settings.md) S1 / S8 / S9。3-07。2026-09-06）
- [x] この時点でdev環境にデプロイし、オーナーの日常利用を開始（手順は [dev-deploy.md](dev-deploy.md)。2026-09-06 オーナーがリモート migrate / `BETTER_AUTH_SECRET` / `wrangler deploy --env dev` を実行。公開 URL はドキュメントに書かない）

### 完了条件（DoD）

- オーナーが実機で毎日の記録を運用できる
- 計算ロジック・API・主要コンポーネントにテストがあり、CIがグリーン

---

## Phase 4: セラー管理（目安: 1.5〜2週間）

**目的**: 撮って（切り抜いて）ガラス棚に並べ、開栓で貯蔵庫へ移す在庫管理を構築する。ラベルの AI 読み取りで登録を楽にする。写真基盤は Phase 2-08 のものを使う。

### タスク

- [x] `spec/features/cellar.md` 作成（[screen-designs/04-cellar.md](screen-designs/04-cellar.md) を写す）→ [features/cellar.md](features/cellar.md)（4-01。2026-09-06 作成・承認）
- [x] ボトルの追加・詳細・編集・削除: 「+」は撮影から（2:3、`cellar` プリセット、キャラ合成なし）、本数 N で N 行、詳細のプロパティ・記録節（ノート節と開栓は後続。`/cellar` は仮一覧）→ 4-02
- [x] **棚（陳列）**: 地色の上に **ガラス風の棚板**、**種類ごと / 1 本ずつ**の表示切替、`kind`（切り抜き / 長方形）の描き分け、写真なしは種類別シルエット、種類・検索フィルタ、空状態（棚板ハイライト M-28、直前に操作した本の M-32、戻った本の出現 M-11）→ 4-04
- [x] **開栓・貯蔵庫・復元**: 「開栓する」（記録は作らない → 棚へ戻りトースト undo。到着時に本数カウントダウン + 抜けた段の棚板ハイライト M-10）、`/cellar/archive`（月見出し・減彩）、「セラーに戻す」→ 4-03
- [x] **切り抜き（4-06）**: 端末内 WASM で背景除去 → 透過 WebP（`kind = cutout`）。失敗時は長方形にフォールバック
- [x] **ラベル読み取り（4-07）**: `POST /api/bottles/recognize`（Cloudflare Workers AI の Vision モデル）で銘柄名・生産者・産地・年・種類・度数の候補を空欄に。自動保存しない。日次上限。設定で OFF。将来 Gemini 等へ差し替え可能な `LabelRecognizer`（2026-09-07）
- [x] APIテスト・コンポーネントテスト（consume / restore / recognize の認可・上限含む）→ 4-05（2026-09-07）

### 完了条件（DoD）

- 手持ちのボトルを撮って（切り抜かれて）ガラス棚に並べ、種類ごと / 1 本ずつを切り替え、検索・絞り込みでき、開栓すると貯蔵庫へ移る（記録は増えない）
- ラベル写真から候補が空欄に入り、確認して保存できる（読めなくても登録は止まらない）
- 写真がR2に保存され、他ユーザーからアクセスできないことがテストで担保されている
- 開栓の undo でボトルが棚に戻る

---

## Phase 5: テイスティングノート（目安: 1週間）

**目的**: 3つ目のコア機能を完成させ、機能間連携の土台を作る。

### タスク

- [x] `spec/features/tasting-note.md` 作成（[screen-designs/05-notes.md](screen-designs/05-notes.md) を写す）→ [features/tasting-note.md](features/tasting-note.md)（5-01。2026-09-07 #46 で承認）
- [x] ノートCRUD: **撮って評価と一言**を付ける作成フォーム（4 欄は折りたたみ）、写真グリッド一覧・検索、カルーセル詳細（5-02。複数写真 UI は 5-03、ボトル詳細のノート節は 5-04）
- [x] 写真複数枚添付（最大 6。2-08 の基盤を再利用。キャラ合成トグルあり）→ 5-03
- [x] セラー連携: ボトル詳細からノート一覧参照、ノート作成時のボトル選択（貯蔵庫含む）→ 5-04（2026-09-07）
- [x] APIテスト・コンポーネントテスト（認可・5.1/1.2・写真 7 枚・評価ステッパー・一覧フィルタ。5-05。2026-09-07）

### 完了条件（DoD）

- ボトルに紐づくテイスティングノートを写真付きで記録・参照できる
- MVPの3機能すべてが実機で動作する

---

## Phase 5.5: 実機検証・機能安定化（終了条件ベース）

**目的**: Phase 3〜5で実装した3つのコア機能をオーナーの実機とdev環境で探索的に操作し、仕様・自動テストだけでは見つからない機能不良、データ不整合、待ち時間、端末依存問題をIssue化して1件ずつ解決する。PWA固有の検証へ進む前に、実機能を安定させる。

### タスク

- [ ] **5.5-01 検証準備**: Phase 5完了版をdevへデプロイし、実機・ブラウザ・ネットワーク・テストデータ・証跡の記録方法を確定する
- [ ] **5.5-02 セラー写真処理の安定化**: 起票済み [Issue #48](https://github.com/akihotsuji/alco-app/issues/48) を追跡Issueとして、現行コードで成立する仮説を再確認し、P0/P1を1関心事の子Issueへ分割して順に解決する。WebGPU・WASMマルチスレッド・モデル交換は実測後に別Issueで判断する
- [ ] **5.5-03 Phase 3〜5の実機探索**: 飲酒記録、セラー、ノート、機能間連携、失敗・復帰を実際に操作し、再現手順付きで1問題1Issueとして起票する
- [ ] **5.5-04 Issue修正ループ**: 優先度順に同時着手1件で、仕様確認 → 再現 → 回帰テスト追加 → 修正 → dev再デプロイ → 同じ実機で再確認を繰り返す
- [ ] **5.5-05 回帰確認・終了判定**: 主要導線を通し直し、未トリアージIssue、Blocker、Highの機能不良がないことを確認してPhase 6へ進む

詳細な順序・Issue分割・実機チェック項目は [roadmap/phase-05-5-device-hardening/](../roadmap/phase-05-5-device-hardening/00-phase.md) を参照する。

### 完了条件（DoD）

- Phase 3〜5の主要導線と失敗・復帰ケースを、少なくともオーナーの主利用実機1台で実施し、端末・OS・ブラウザ・結果を記録している
- 発見事項がすべて「Issue化」「重複」「仕様どおり」のいずれかに分類され、未トリアージがない
- Issue #48のP0/P1が分割・解決・実機再確認済みで、P2/P3は計測根拠付きで実施・延期・不採用のいずれかが決まっている
- Blocker / Highの未解決機能不良がゼロ。Medium / Lowを残す場合は理由・回避策・後続PhaseをIssueに記録し、オーナーが承認している
- 各修正に回帰テストがあり、lint / typecheck / test / buildがパスし、Critical / Highのセキュリティ指摘がゼロ

---

## Phase 6: PWA・品質仕上げ（目安: 3〜5日）

**目的**: Phase 5.5で安定化した実機能に、PWA・E2E・性能・アクセシビリティ品質を加えて本番レベルに引き上げる。

### タスク

- [ ] vite-plugin-pwa導入: manifest、アイコン一式（キャラクター `default` を primary 角丸に載せてビルド時生成）、スタンドアロン表示、テーマカラー
- [ ] Playwright E2E: 主要導線のスモークテスト（ログイン→記録→サマリー確認、ボトル登録→ノート作成）をCIに組み込み
- [ ] パフォーマンス改善: バンドルサイズ確認、コード分割、画像遅延読み込み（Lighthouseモバイルで計測）
- [ ] アクセシビリティ最低限対応: タップ領域サイズ、コントラスト、フォームラベル、**reduced motion の検証**（OS 設定と「動きを減らす」の両方で移動・水位線が止まり、情報が欠けない。[motion-design.md](motion-design.md) 6.8 / 10.6）
- [ ] iOS Safari / Android Chrome での実機動作確認と表示崩れ修正

### rules / skills

- skill: `e2e-testing` — E2Eテストの書き方・実行・デバッグ手順

### 完了条件（DoD）

- ホーム画面に追加するとアプリとして起動する（iOS/Android両方）
- E2EがCIで安定してパスする
- Lighthouse（モバイル）Performance / Best Practices / a11y が目安80点以上

---

## Phase 7: 本番リリース（目安: 3〜5日）

**目的**: dev環境と分離した本番環境を構築し、安全に運用開始する。

### タスク

- [ ] 本番用リソース作成: Workers環境分離（wranglerのenv機能）、本番D1・本番R2
- [ ] GitHub Actions デプロイパイプライン: mainマージ→dev自動デプロイ、タグ/手動承認→本番デプロイ
- [ ] シークレット管理の整理（wrangler secret / GitHub Secrets、`.dev.vars`はコミット禁止）
- [ ] D1日次バックアップ（D1のTime Travel確認＋定期エクスポートをGitHub Actionsで実行）
- [ ] 監視: Workers Logsの確認手順、エラー通知（Sentry無料枠 or Cloudflare通知）
- [ ] 独自ドメイン設定（任意。当面 `*.workers.dev` でも可）
- [ ] リリース前の全体セキュリティ監査（`security-audit` スキルをコードベース全体に対して実施。認可・セキュリティヘッダー・シークレット管理・R2公開設定の総点検）
- [ ] リリースチェックリスト作成と実施 → `spec/release-checklist.md`
- [ ] 運用ドキュメント作成: 障害時の確認手順、バックアップからの復元手順 → `spec/operations.md`

### rules / skills

- skill: `release` — リリース手順（チェックリスト実行→本番デプロイ→動作確認→ロールバック手順）

### 完了条件（DoD）

- 本番URLでアプリが稼働し、dev環境と完全に分離されている
- バックアップが自動で取得され、復元手順が一度リハーサル済み
- ロールバック手順が文書化されている

---

## Phase 8: 一般公開準備（将来・任意）

個人利用で安定運用できてから着手する。

- [ ] 利用規約・プライバシーポリシー作成
- [ ] 年齢確認（20歳以上）フローの実装
- [ ] 公開時の新規登録フロー確認、パスワードリセットメール（メール送信基盤の導入）。招待制は採用していないため「解除」作業は不要
- [ ] OAuthログイン（Google等）
- [ ] レート制限・不正利用対策（Cloudflare WAF / Turnstile）
- [ ] 無料枠の使用量監視と、超過時の課金プラン検討

---

## 開発の進め方（全フェーズ共通）

1. **仕様が先**: 機能実装の前に `spec/features/` に仕様を書き、オーナーが承認してから実装する
2. **画面は設計どおりに**: 画面は `spec/screen-designs/` の要素表・状態・遷移・モックのとおりに実装し、受け入れチェックを PR に貼る。変えたいときは先に設計を直す（2026-09-05）
3. **小さく出す**: 1PR = 1つの関心事。巨大PRを作らない
4. **テストと一緒に**: ロジックには単体テスト、APIには認可を含むテストを同じPRで書く
5. **ドキュメント同期**: 仕様変更があったら同じPRでspecを更新する
6. **セキュリティ監査を必ず通す**: PR作成前に `security-audit` スキルで変更差分を監査し、Critical/Highの指摘ゼロを確認する
7. **CIがグリーンでないものはマージしない**
