# ロードマップ作業手順書

`spec/03-roadmap.md` の **全フェーズ・全タスク** を、実装可能な仕様書＋手順書に細分化したもの。
アプリケーションコードはここには含めない。着手時は各タスクファイルの手順に従い、`.cursor/skills/feature-dev/SKILL.md` のサイクル（仕様→ブランチ→実装→テスト→ドキュメント同期→セキュリティ監査→PR）を守る。

## 置き場所

リポジトリ直下の `roadmap/`（既存の空フォルダを使用）。`spec/roadmap/` は存在しない。

## 現状サマリー（2026-09-05）

| 判定 | 内容 |
|---|---|
| **完了** | 0-01〜0-09、1-01〜1-09、2-01〜2-08、3-01〜3-07、4-01〜4-07（セラー CRUD・棚・開栓・切り抜き・ラベル読み取り・テスト総仕上げ）、5-01〜5-05（ノート CRUD・複数写真・セラー連携・テスト総仕上げ）。`protect-main` は 2026-09-05 適用（id `22315799`） |
| **レビュー待ち** | なし |
| **進行中** | なし |
| **未着手** | Phase 5.5〜 |
| **Phase 5.5（2026-09-07 追加）** | Phase 5完了直後に、Phase 3〜5を主利用実機で探索し、1問題1Issue・同時着手1件で安定化する。既知の [#48 セラー登録時の写真処理](https://github.com/akihotsuji/alco-app/issues/48) を先頭の追跡Issueとする |
| **FIX（2026-08-13）** | 招待制は採用しない。UIはOS外観設定に追従（ライト／ダーク）。グラスプリセットは種類ごとの一般量をデフォルト、記録ごとに修正可。日付境界は Asia/Tokyo |
| **FIX（2026-08-15）** | Cloudflare: D1 `alco-app-dev` / R2 `alco-app-photos-dev`（非公開）。binding は `DB` / `PHOTOS`。wrangler は最初から `env.dev`（`--env dev`）。本番は Phase 7 で `env.production` |
| **FIX（2026-09-09）** | 本番は dev と同じアカウントの別リソース。Worker / D1 `alco-app-prod`、R2 `alco-app-photos-prod`（非公開）。`wrangler.jsonc` の `env.production`。デプロイ・migrate・secret は 7-02 / 7-03 |
| **FIX（2026-09-04）** | 下部タブは一旦 5 つ。見た目は **ニューモーフィズム**。数値・API・可視性は下表の追記どおり |
| **FIX（2026-09-06）** | **モーション**は [spec/motion-design.md](../spec/motion-design.md) を全採用（状態変化の瞬間だけ動く `M-01`〜`M-32`、開栓は「少し凝った」段階、記録成功は A + B + C、haptic 既定 OFF + 設定スイッチ、X1〜X8）。ダークの `--primary` / `--score` / `--ring` を `#CC8484` に。共通基盤は 3-02 に同梱 |
| **FIX（2026-09-06。中央タブ）** | **中央タブの挙動は (c) 撮影開始**。タップで記録用 `photo-edit`、「使う」で写真付き `log-new`、キャンセルは元の画面。着地画面・現在地ハイライトなし。写真なし記録はホームの「記録する」。日別（`/logs`）はホーム配下（今日カード / 週マス / 保存後 / 週サマリーの行から入る。主ボタン群は置かない）。(a) 今日の日別 / (b) 直接 `log-new` は不採用。正本は [spec/screen-designs/README.md](../spec/screen-designs/README.md) と [spec/screens.md](../spec/screens.md)。実装: 中央タブとホームのカメラは完了（2026-09-06 `feature/center-tab-camera`）、今日カード / 「今週 ›」は 3-03、日別は 3-05 |
| **要確認（残）** | なし。可視性は public（Free + ruleset）。private にするなら Pro |

## オーナー決定（2026-08-13 FIX）

以降の設計・実装はこの表を正とする。詳細は [spec/00-overview.md](../spec/00-overview.md) と [spec/01-requirements.md](../spec/01-requirements.md)。

| 項目 | 決定 |
|---|---|
| 招待制 | **採用しない**。メール＋パスワードでサインアップ。個人利用では URL を公開しない |
| UIテーマ | 既定は**端末・OSの外観設定に追従**（ライト／ダーク両方）。Phase 5.5 #62 で設定「外観」（端末に従う / ライト / ダーク）を追加 |
| グラスプリセット | 種類ごとの一般的な量・度数をデフォルト投入し、**記録ごとに修正できる**。数値は要件 1.2 の表 |
| 日付境界 | **Asia/Tokyo**。保存は UTC、表示・日次集計・休肝日は JST カレンダー日 |

## オーナー決定（2026-09-04 FIX）

| 項目 | 決定 |
|---|---|
| 下部タブ | **一旦 5 つ**（ホーム / 記録 / セラー / ノート / 設定）。正本は [spec/screens.md](../spec/screens.md) |
| 画面ナビ | タブ順・ルート・FAB なし・undo 5 秒で当面進める。細部は実装時に直してよい |
| ワイヤー | 骨格は承認。各画面の細部は後からいじる |
| 見た目 | **ニューモーフィズム**。主アクションはワイン系の塗り。Win98 / ヴェイパーは不採用。ゲーミフィケーションはスコア・押下・短いトーストまで |
| セラー背景 | 撮影写真を加工してセラー風に並べる見せ方は **将来**（MVP では作らない） |
| データモデル | 当面このまま |
| 公開 API | アプリ独自は `GET /api/health` と `GET /api/config`（8-05。サイトキーだけ）。`/api/auth/*` は Better Auth |
| 表示丸め | 純アルコール量は小数第 1 位 |
| `volume_ml` | 整数 1〜5000 |
| `abv_percent` | **0〜100**、小数第 1 位。**0% 可**。0g の記録は休肝日にしない |
| 記録単位 | 原則グラス。ボトル丸ごとも量チップ（375 / 750 / 1500）と手入力で記録できる |
| `drunk_at` 未来 | 時計ズレ **+15 分**まで |
| API 方針 | 1-05 どおり（400 フィールドエラー、cursor、写真は Worker GET） |
| リポジトリ | **public**（Free で ruleset を使う。private にするなら Pro） |
| main 保護 | ruleset `protect-main`（id `22315799`）適用済み。必須チェックなし。merge / squash / rebase。承認 0 人 |

## オーナー指示（2026-09-05。1-07 / 1-08。2026-09-06 承認）

2026-09-04 の「セラー背景は将来」「中央タブ不採用」「データモデルは当面このまま」を **覆す**。詳細は [spec/screen-designs/README.md](../spec/screen-designs/README.md)。

| 項目 | 指示 |
|---|---|
| 詳細画面設計 | 全画面の機能・要素・状態・遷移をイメージ図付きで確定し、**実装はそのとおりに作る**（rules / skill に転記） |
| 下部タブ | **ホーム / セラー / 記録（中央・円形） / ノート / 設定**。記録が最頻 |
| セラー | 撮った写真を **切り抜いて**、**地色の上のガラス風棚板**に陳列（2 回目の指示で確定）。**種類ごと / 1 本ずつ**の表示切替。操作は **追加と開栓**。開栓で **貯蔵庫** へ移る。記録は作らない（2026-09-06）。1 行 = 1 本、`quantity` 廃止、`finished` → `consumed`、`opened` 廃止 |
| ラベル読み取り | **Cloudflare Workers AI の Vision モデル**で、ラベル写真から銘柄名・生産者・産地・年・種類・度数の候補を空欄に入れる。**セラーのみ**。自動保存しない。Gemini 等の外部 API は将来の差し替え候補として念頭に置く（`LabelRecognizer` 差し替え） |
| 記録・ノート | **写真を撮って記録・コメントを付ける**体験。写真は任意で最短タップは維持。記録は 1 枚、ノートは 6 枚 |
| キャラクター | **1 体**（赤ワインの入ったグラスに Nani!? 風の目。**名前は付けない**（2026-09-06））。ホーム・ログイン・空状態・保存トーストに。写真右下に「驚き」ポーズを合成できる |
| 画像処理 | すべて端末内（Canvas / WASM）。加工後 1 枚だけ R2。切り抜きも端末内（フォールバックあり） |
| デザイン崩れ | 週マスの薄赤（塗りに inset を重ねていた）とチップの被り（影が大きすぎ）はトークンで修正。影を部品サイズで 2 段階化。実機での微調整は 2-06 |
| 要確認 | 2026-09-06 決定: 本数上限 **12**、ノート写真枚数 **6**、キャラの名前は **付けない**、中央タブの挙動は **(c) 撮影開始**（同日。上の FIX 表）。残りなし |

## オーナー指示（2026-09-06。セラー詳細の操作）

1-07 承認後の追記。詳細は [spec/screen-designs/04-cellar.md](../spec/screen-designs/04-cellar.md)。

| 項目 | 指示 |
|---|---|
| セラーの操作 | **追加**と**開栓**。開栓で貯蔵庫へ移す。棚に残す「開栓済み」は持たない |
| 開栓時の記録 | **作らない**。1 杯は記録画面からボトルを選ぶ |
| ボトル詳細 | 主ボタンは「開栓する」のみ。プロパティに銘柄名・種類・年・産地なども出す。品種列は足さない |

## オーナー決定（2026-08-15 FIX）

Cloudflare 開発リソース。詳細は [spec/02-tech-stack.md](../spec/02-tech-stack.md) の「環境」。

| 項目 | 決定 |
|---|---|
| D1 / R2（dev） | `alco-app-dev` / `alco-app-photos-dev`（R2 は非公開） |
| binding | D1 = `DB`、R2 = `PHOTOS` |
| wrangler env | **`env.dev` と `env.production` で分ける**。トップレベルをどちらにもしない。コマンドは `--env` を必須にする |

## 凡例

| ステータス | 意味 |
|---|---|
| 完了 | リポジトリまたは GitHub 上で成果を確認済み |
| 部分完了 | 一部のみ存在 |
| 未着手 | 成果物なし |

## フェーズ一覧

| フェーズ | フォルダ | 目的 | 状態 |
|---|---|---|---|
| Phase 0 プロジェクト基盤 | [phase-00-project-foundation](phase-00-project-foundation/00-phase.md) | リポジトリ・CI・Cloudflare・ルール | 完了 |
| Phase 1 設計 | [phase-01-design](phase-01-design/00-phase.md) | 画面・デザイン・データ・API・**詳細画面設計・キャラクター** | 完了（1-01〜06 は 2026-09-04、1-07 / 08 は 2026-09-06 承認） |
| Phase 2 土台実装 | [phase-02-platform](phase-02-platform/00-phase.md) | DB・認証・レイアウト・型共有・**写真パイプライン** | 完了（2-01〜2-08） |
| Phase 3 飲酒記録 | [phase-03-drink-log](phase-03-drink-log/00-phase.md) | MVPコア（記録・写真・マイドリンク・サマリー） | 完了（3-07 の実デプロイ済み） |
| Phase 4 セラー管理 | [phase-04-cellar](phase-04-cellar/00-phase.md) | ガラス棚（陳列・切り抜き）・追加と開栓・貯蔵庫・ラベル AI 読み取り | 完了（4-01〜4-07。4-05 は 2026-09-07） |
| Phase 5 テイスティングノート | [phase-05-tasting-note](phase-05-tasting-note/00-phase.md) | 撮って評価と一言・写真グリッド・セラー連携 | 完了（5-01〜5-05。5-05 は 2026-09-07） |
| Phase 5.5 実機検証・機能安定化 | [phase-05-5-device-hardening](phase-05-5-device-hardening/00-phase.md) | Phase 3〜5の実機探索、Issue化、1件ずつ修正 | 未着手（Phase 5完了直後） |
| Phase 6 PWA・品質 | [phase-06-pwa-quality](phase-06-pwa-quality/00-phase.md) | PWA・E2E・性能・a11y | 未着手 |
| Phase 7 本番リリース | [phase-07-production-release](phase-07-production-release/00-phase.md) | 環境分離・バックアップ・監視 | 進行中（7-01〜7-05・7-07〜7-09。2026-09-09。7-06 の 308 と初回 Deploy prod はオーナー） |
| Phase 8 一般公開準備 | [phase-08-public-launch](phase-08-public-launch/00-phase.md) | 法対応・OAuth・レート制限（将来） | 8-01〜8-06 実装済み。Turnstile / Budget alert はオーナー |

## ロードマップ ↔ ファイル対応表

`spec/03-roadmap.md` のタスクと 1:1。rules/skills は各フェーズの `00-phase.md` と該当タスク内で扱う（独立タスクとして列挙されていないものはファイルを増やしていない）。

### Phase 0（9タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 0-01 | Gitリポジトリ初期化、GitHubプライベートリポジトリ作成 | [01-git-github-init.md](phase-00-project-foundation/01-git-github-init.md) | 完了 |
| 0-02 | Node.js / pnpm / wrangler のローカル環境セットアップ | [02-local-env-setup.md](phase-00-project-foundation/02-local-env-setup.md) | 完了 |
| 0-03 | Cloudflareアカウント作成、D1・R2作成（dev用） | [03-cloudflare-dev-resources.md](phase-00-project-foundation/03-cloudflare-dev-resources.md) | 完了 |
| 0-04 | Vite + React + Hono + Workers の空プロジェクト | [04-hello-world-scaffold.md](phase-00-project-foundation/04-hello-world-scaffold.md) | 完了 |
| 0-05 | TypeScript strict、Biome導入 | [05-typescript-biome.md](phase-00-project-foundation/05-typescript-biome.md) | 完了 |
| 0-06 | Vitest導入 | [06-vitest.md](phase-00-project-foundation/06-vitest.md) | 完了 |
| 0-07 | GitHub Actions CI（lint / typecheck / test / audit） | [07-github-actions-ci.md](phase-00-project-foundation/07-github-actions-ci.md) | 完了 |
| 0-08 | mainブランチ保護 | [08-branch-protection.md](phase-00-project-foundation/08-branch-protection.md) | 完了 |
| 0-09 | `.cursor/rules/` の整備 | [09-cursor-rules-skills.md](phase-00-project-foundation/09-cursor-rules-skills.md) | 完了 |

### Phase 1（9タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 1-01 | 画面一覧とナビゲーション構造 | [01-screens-navigation.md](phase-01-design/01-screens-navigation.md) | 完了（1-07 で改訂） |
| 1-02 | 主要画面のワイヤーフレーム | [02-wireframes.md](phase-01-design/02-wireframes.md) | 完了（配置の正本は 1-07 へ） |
| 1-03 | デザインシステム → `spec/design-system.md` | [03-design-system.md](phase-01-design/03-design-system.md) | 完了（1-07/08 で追補） |
| 1-04 | ER図とDrizzleスキーマ → `spec/data-model.md` | [04-er-drizzle-schema.md](phase-01-design/04-er-drizzle-schema.md) | 完了（1-07 改訂は 2026-09-06 承認） |
| 1-05 | API設計 → `spec/api-design.md` | [05-api-design.md](phase-01-design/05-api-design.md) | 完了（1-07 改訂は 2026-09-06 承認） |
| 1-06 | 純アルコール量計算・標準グラス量プリセット | [06-alcohol-calc-presets.md](phase-01-design/06-alcohol-calc-presets.md) | 完了 |
| 1-07 | 詳細画面設計 → `spec/screen-designs/` | [07-detailed-screen-design.md](phase-01-design/07-detailed-screen-design.md) | 完了（2026-09-06 承認。中央タブの挙動は同日 (c) で確定） |
| 1-08 | キャラクター → `spec/character.md` | [08-character-mascot.md](phase-01-design/08-character-mascot.md) | 完了（2026-09-06 承認） |
| 1-09 | モーション・マイクロインタラクション → `spec/motion-design.md` | 手順書なし（成果物は spec そのもの。実装は 3-02 / 3-03 / 3-05 / 3-06 / 3-07 / 4-03 / 4-04 に同梱） | 完了（2026-09-06 追加・同日承認） |

### Phase 2（8タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 2-01 | Drizzleスキーマ実装とマイグレーション運用 | [01-drizzle-migration.md](phase-02-platform/01-drizzle-migration.md) | 完了 |
| 2-02 | Better Auth導入（招待制は採用しない） | [02-better-auth.md](phase-02-platform/02-better-auth.md) | 完了 |
| 2-03 | Hono API基本構造 | [03-hono-api-structure.md](phase-02-platform/03-hono-api-structure.md) | 完了 |
| 2-04 | Hono RPC + TanStack Query | [04-hono-rpc-tanstack-query.md](phase-02-platform/04-hono-rpc-tanstack-query.md) | 完了 |
| 2-05 | 共通レイアウト | [05-common-layout.md](phase-02-platform/05-common-layout.md) | 完了 |
| 2-06 | デザイントークンとshadcn/ui | [06-design-tokens-shadcn.md](phase-02-platform/06-design-tokens-shadcn.md) | 完了 |
| 2-07 | 認証周りの単体テスト・APIテスト | [07-auth-tests.md](phase-02-platform/07-auth-tests.md) | 完了 |
| 2-08 | 写真パイプライン基盤（撮影→編集→合成→R2、未紐付け GC） | [08-photo-pipeline.md](phase-02-platform/08-photo-pipeline.md) | 完了 |

### Phase 3（7タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 3-01 | `spec/features/drink-log.md` 作成 | [01-spec-drink-log.md](phase-03-drink-log/01-spec-drink-log.md) | 完了（2026-09-06 作成・承認） |
| 3-02 | 記録入力画面 | [02-log-input-screen.md](phase-03-drink-log/02-log-input-screen.md) | 完了（2026-09-06） |
| 3-03 | マイドリンク | [03-my-drinks.md](phase-03-drink-log/03-my-drinks.md) | 完了（2026-09-06） |
| 3-04 | 純アルコール量計算ロジック | [04-alcohol-calc-logic.md](phase-03-drink-log/04-alcohol-calc-logic.md) | 完了 |
| 3-05 | 日別ビュー | [05-daily-view.md](phase-03-drink-log/05-daily-view.md) | 完了（2026-09-06） |
| 3-06 | 週/月サマリー | [06-weekly-monthly-summary.md](phase-03-drink-log/06-weekly-monthly-summary.md) | 完了（2026-09-06） |
| 3-07 | dev環境デプロイと日常利用開始 | [07-dev-deploy-dogfood.md](phase-03-drink-log/07-dev-deploy-dogfood.md) | 完了（2026-09-06） |

### Phase 4（7タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 4-01 | `spec/features/cellar.md` 作成 | [01-spec-cellar.md](phase-04-cellar/01-spec-cellar.md) | 完了（2026-09-06 作成・承認） |
| 4-02 | ボトルCRUD | [02-bottle-crud.md](phase-04-cellar/02-bottle-crud.md) | 完了 |
| 4-03 | 開栓・貯蔵庫・復元（ステータス管理） | [03-status-management.md](phase-04-cellar/03-status-management.md) | 完了 |
| 4-04 | 陳列（ガラス棚。種類ごと / 1 本ずつ。R2 基盤は 2-08 へ） | [04-photo-upload-r2.md](phase-04-cellar/04-photo-upload-r2.md) | 完了 |
| 4-05 | APIテスト・コンポーネントテスト | [05-api-component-tests.md](phase-04-cellar/05-api-component-tests.md) | 完了 |
| 4-06 | 切り抜き（端末内 背景除去 → 透過 WebP） | [06-background-removal.md](phase-04-cellar/06-background-removal.md) | 完了 |
| 4-07 | ラベル読み取り（Workers AI） | [07-label-recognition.md](phase-04-cellar/07-label-recognition.md) | 完了 |

### Phase 5（5タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 5-01 | `spec/features/tasting-note.md` 作成 | [01-spec-tasting-note.md](phase-05-tasting-note/01-spec-tasting-note.md) | 完了（2026-09-07 #46） |
| 5-02 | ノートCRUD | [02-note-crud.md](phase-05-tasting-note/02-note-crud.md) | 完了 |
| 5-03 | 写真複数枚添付 | [03-multi-photo-attach.md](phase-05-tasting-note/03-multi-photo-attach.md) | 完了 |
| 5-04 | セラー連携 | [04-cellar-integration.md](phase-05-tasting-note/04-cellar-integration.md) | 完了 |
| 5-05 | APIテスト・コンポーネントテスト | [05-api-component-tests.md](phase-05-tasting-note/05-api-component-tests.md) | 完了（2026-09-07） |

### Phase 5.5（5タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 5.5-01 | 実機検証の準備 | [01-qa-baseline.md](phase-05-5-device-hardening/01-qa-baseline.md) | 未着手 |
| 5.5-02 | セラー写真処理の安定化（Issue #48） | [02-cellar-photo-pipeline.md](phase-05-5-device-hardening/02-cellar-photo-pipeline.md) | 未着手（調査基準は作成済み） |
| 5.5-03 | Phase 3〜5の実機探索 | [03-device-exploration.md](phase-05-5-device-hardening/03-device-exploration.md) | 未着手 |
| 5.5-04 | Issue修正ループ | [04-issue-resolution-loop.md](phase-05-5-device-hardening/04-issue-resolution-loop.md) | 未着手 |
| 5.5-05 | 回帰確認と終了判定 | [05-regression-exit.md](phase-05-5-device-hardening/05-regression-exit.md) | 未着手 |

### Phase 6（5タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 6-01 | vite-plugin-pwa導入 | [01-vite-plugin-pwa.md](phase-06-pwa-quality/01-vite-plugin-pwa.md) | 完了（2026-09-08） |
| 6-02 | Playwright E2E | [02-playwright-e2e.md](phase-06-pwa-quality/02-playwright-e2e.md) | 完了（2026-09-08） |
| 6-03 | パフォーマンス改善 | [03-performance.md](phase-06-pwa-quality/03-performance.md) | 完了（2026-09-08） |
| 6-04 | アクセシビリティ最低限対応 | [04-accessibility.md](phase-06-pwa-quality/04-accessibility.md) | 完了（2026-09-09） |
| 6-05 | iOS Safari / Android Chrome 実機確認 | [05-device-qa.md](phase-06-pwa-quality/05-device-qa.md) | エージェント作業済み（2026-09-09。オーナー実機確認待ち） |

### Phase 7（9タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 7-01 | 本番用リソース作成 | [01-prod-resources.md](phase-07-production-release/01-prod-resources.md) | 完了（2026-09-09） |
| 7-02 | GitHub Actions デプロイパイプライン | [02-deploy-pipeline.md](phase-07-production-release/02-deploy-pipeline.md) | 完了（2026-09-09。Environment 設定と初回デプロイはオーナー） |
| 7-03 | シークレット管理の整理 | [03-secret-management.md](phase-07-production-release/03-secret-management.md) | 完了（2026-09-09。本番投入はオーナー） |
| 7-04 | D1日次バックアップ | [04-d1-backup.md](phase-07-production-release/04-d1-backup.md) | ワークフロー済み（2026-09-09。初回実行と rehearse はオーナー） |
| 7-05 | 監視 | [05-monitoring.md](phase-07-production-release/05-monitoring.md) | 完了（2026-09-09。ウェブフック投入はオーナー） |
| 7-06 | 独自ドメイン設定（任意） | [06-custom-domain.md](phase-07-production-release/06-custom-domain.md) | 未着手 |
| 7-07 | リリース前の全体セキュリティ監査 | [07-security-audit.md](phase-07-production-release/07-security-audit.md) | 完了（2026-09-09。R2 ダッシュボード目視はオーナー） |
| 7-08 | リリースチェックリスト → `spec/release-checklist.md` | [08-release-checklist.md](phase-07-production-release/08-release-checklist.md) | 完了（2026-09-09。初回本番実施はオーナー） |
| 7-09 | 運用ドキュメント → `spec/operations.md` | [09-operations-docs.md](phase-07-production-release/09-operations-docs.md) | 完了（2026-09-09） |

### Phase 8（6タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 8-01 | 利用規約・プライバシーポリシー | [01-terms-privacy.md](phase-08-public-launch/01-terms-privacy.md) | 実装済み（2026-09-13。文面は草案。共有セラー等を反映） |
| 8-02 | 年齢確認（20歳以上） | [02-age-verification.md](phase-08-public-launch/02-age-verification.md) | 完了（2026-09-10） |
| 8-03 | 公開登録確認・パスワードリセット | [03-open-signup-password-reset.md](phase-08-public-launch/03-open-signup-password-reset.md) | 完了（2026-09-10。Resend 投入はオーナー） |
| 8-04 | OAuthログイン | [04-oauth-login.md](phase-08-public-launch/04-oauth-login.md) | 完了（2026-09-10。Google 投入はオーナー） |
| 8-05 | レート制限・不正利用対策 | [05-rate-limit-abuse.md](phase-08-public-launch/05-rate-limit-abuse.md) | 完了（2026-09-10。キーと WAF 投入はオーナー） |
| 8-06 | 無料枠の使用量監視 | [06-usage-monitoring.md](phase-08-public-launch/06-usage-monitoring.md) | 完了（2026-09-10。Budget alert / Gateway spend limit はオーナー） |

**合計: フェーズフォルダ 10、タスクファイル 69、フェーズ概要 10、本インデックス 1。**

## 共通ルール（全タスク）

1. 機能実装の前に `spec/features/` を書き、オーナー承認を得る（Phase 3〜5）。
2. **画面は [spec/screen-designs/](../spec/screen-designs/README.md) のとおりに実装し、該当ファイルの受け入れチェックを PR に貼る。** 変えたいときは先に設計を直す（2026-09-05）。
3. 作業ブランチは切る直前に `git fetch origin main` し、`git checkout -b feature/<内容> origin/main`（または `fix/`）。`main` へ直接 push しない。
4. コミット・PR は日本語、`種別: 要約`。
5. シークレットをコード・`wrangler.jsonc`・spec・本フォルダに書かない。
6. 公開エンドポイントを新設する場合は仕様書に明記し、オーナー承認を得る。
7. 完了時に `spec/03-roadmap.md` のチェックボックスを更新する。
8. Phase 5.5の実機不良は [実機QAテンプレート](../.github/ISSUE_TEMPLATE/device-qa.yml) で1問題1Issueとし、同時に実装するIssueは1件だけにする。

## 関連spec

- [spec/00-overview.md](../spec/00-overview.md)
- [spec/01-requirements.md](../spec/01-requirements.md)
- [spec/02-tech-stack.md](../spec/02-tech-stack.md)
- [spec/03-roadmap.md](../spec/03-roadmap.md)
- [spec/README.md](../spec/README.md)
