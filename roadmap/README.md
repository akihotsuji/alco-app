# ロードマップ作業手順書

`spec/03-roadmap.md` の **全フェーズ・全タスク** を、実装可能な仕様書＋手順書に細分化したもの。
アプリケーションコードはここには含めない。着手時は各タスクファイルの手順に従い、`.cursor/skills/feature-dev/SKILL.md` のサイクル（仕様→ブランチ→実装→テスト→ドキュメント同期→セキュリティ監査→PR）を守る。

## 置き場所

リポジトリ直下の `roadmap/`（既存の空フォルダを使用）。`spec/roadmap/` は存在しない。

## 現状サマリー（2026-09-03）

| 判定 | 内容 |
|---|---|
| **完了** | 0-01〜0-05、0-07、0-09。GitHub プライベート、`.gitignore`、Hello World、TypeScript strict / Biome、Cloudflare dev D1/R2、CI（lint / typecheck / test / audit）、rules/skills |
| **未着手** | 0-06 Vitest、0-08 ブランチ保護、Phase 1 以降の設計3点セット |
| **FIX（2026-08-13）** | 招待制は採用しない。UIはOS外観設定に追従（ライト／ダーク）。グラスプリセットは種類ごとの一般量をデフォルト、記録ごとに修正可。日付境界は Asia/Tokyo |
| **FIX（2026-08-15）** | Cloudflare: D1 `alco-app-dev` / R2 `alco-app-photos-dev`（非公開）。binding は `DB` / `PHOTOS`。wrangler は最初から `env.dev`（`--env dev`）。本番は Phase 7 で `env.production` |
| **要確認（残）** | ブランチ保護（GitHub Free のプライベートでは classic protection が 403） |

## オーナー決定（2026-08-13 FIX）

以降の設計・実装はこの表を正とする。詳細は [spec/00-overview.md](../spec/00-overview.md) と [spec/01-requirements.md](../spec/01-requirements.md)。

| 項目 | 決定 |
|---|---|
| 招待制 | **採用しない**。メール＋パスワードでサインアップ。個人利用では URL を公開しない |
| UIテーマ | **端末・OSの外観設定に追従**（ライト／ダーク両方。アプリ内切替は持たない） |
| グラスプリセット | 種類ごとの一般的な量・度数をデフォルト投入し、**記録ごとに修正できる**。数値は要件 1.2 の表 |
| 日付境界 | **Asia/Tokyo**。保存は UTC、表示・日次集計・休肝日は JST カレンダー日 |

## オーナー決定（2026-08-15 FIX）

Cloudflare 開発リソース。詳細は [spec/02-tech-stack.md](../spec/02-tech-stack.md) の「環境」。

| 項目 | 決定 |
|---|---|
| D1 / R2（dev） | `alco-app-dev` / `alco-app-photos-dev`（R2 は非公開） |
| binding | D1 = `DB`、R2 = `PHOTOS` |
| wrangler env | **`env.dev` で分ける**。トップレベルを dev 扱いにしない。コマンドは `--env dev`。Phase 7 で `env.production` を追加 |

## 凡例

| ステータス | 意味 |
|---|---|
| 完了 | リポジトリまたは GitHub 上で成果を確認済み |
| 部分完了 | 一部のみ存在 |
| 未着手 | 成果物なし |

## フェーズ一覧

| フェーズ | フォルダ | 目的 | 状態 |
|---|---|---|---|
| Phase 0 プロジェクト基盤 | [phase-00-project-foundation](phase-00-project-foundation/00-phase.md) | リポジトリ・CI・Cloudflare・ルール | 部分完了 |
| Phase 1 設計 | [phase-01-design](phase-01-design/00-phase.md) | 画面・デザイン・データ・API | 未着手 |
| Phase 2 土台実装 | [phase-02-platform](phase-02-platform/00-phase.md) | DB・認証・レイアウト・型共有 | 未着手 |
| Phase 3 飲酒記録 | [phase-03-drink-log](phase-03-drink-log/00-phase.md) | MVPコア（記録・マイドリンク・サマリー） | 未着手 |
| Phase 4 セラー管理 | [phase-04-cellar](phase-04-cellar/00-phase.md) | 在庫CRUD・写真（R2） | 未着手 |
| Phase 5 テイスティングノート | [phase-05-tasting-note](phase-05-tasting-note/00-phase.md) | ノートCRUD・セラー連携 | 未着手 |
| Phase 6 PWA・品質 | [phase-06-pwa-quality](phase-06-pwa-quality/00-phase.md) | PWA・E2E・性能・a11y | 未着手 |
| Phase 7 本番リリース | [phase-07-production-release](phase-07-production-release/00-phase.md) | 環境分離・バックアップ・監視 | 未着手 |
| Phase 8 一般公開準備 | [phase-08-public-launch](phase-08-public-launch/00-phase.md) | 法対応・OAuth・レート制限（将来） | 未着手 |

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
| 0-06 | Vitest導入 | [06-vitest.md](phase-00-project-foundation/06-vitest.md) | 未着手 |
| 0-07 | GitHub Actions CI（lint / typecheck / test / audit） | [07-github-actions-ci.md](phase-00-project-foundation/07-github-actions-ci.md) | 完了 |
| 0-08 | mainブランチ保護 | [08-branch-protection.md](phase-00-project-foundation/08-branch-protection.md) | 未着手 |
| 0-09 | `.cursor/rules/` の整備 | [09-cursor-rules-skills.md](phase-00-project-foundation/09-cursor-rules-skills.md) | 完了 |

### Phase 1（6タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 1-01 | 画面一覧とナビゲーション構造 | [01-screens-navigation.md](phase-01-design/01-screens-navigation.md) | 未着手 |
| 1-02 | 主要画面のワイヤーフレーム | [02-wireframes.md](phase-01-design/02-wireframes.md) | 未着手 |
| 1-03 | デザインシステム → `spec/design-system.md` | [03-design-system.md](phase-01-design/03-design-system.md) | 未着手 |
| 1-04 | ER図とDrizzleスキーマ → `spec/data-model.md` | [04-er-drizzle-schema.md](phase-01-design/04-er-drizzle-schema.md) | 未着手 |
| 1-05 | API設計 → `spec/api-design.md` | [05-api-design.md](phase-01-design/05-api-design.md) | 未着手 |
| 1-06 | 純アルコール量計算・標準グラス量プリセット | [06-alcohol-calc-presets.md](phase-01-design/06-alcohol-calc-presets.md) | 未着手 |

### Phase 2（7タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 2-01 | Drizzleスキーマ実装とマイグレーション運用 | [01-drizzle-migration.md](phase-02-platform/01-drizzle-migration.md) | 未着手 |
| 2-02 | Better Auth導入（招待制は採用しない） | [02-better-auth.md](phase-02-platform/02-better-auth.md) | 未着手 |
| 2-03 | Hono API基本構造 | [03-hono-api-structure.md](phase-02-platform/03-hono-api-structure.md) | 未着手 |
| 2-04 | Hono RPC + TanStack Query | [04-hono-rpc-tanstack-query.md](phase-02-platform/04-hono-rpc-tanstack-query.md) | 未着手 |
| 2-05 | 共通レイアウト | [05-common-layout.md](phase-02-platform/05-common-layout.md) | 未着手 |
| 2-06 | デザイントークンとshadcn/ui | [06-design-tokens-shadcn.md](phase-02-platform/06-design-tokens-shadcn.md) | 未着手 |
| 2-07 | 認証周りの単体テスト・APIテスト | [07-auth-tests.md](phase-02-platform/07-auth-tests.md) | 未着手 |

### Phase 3（7タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 3-01 | `spec/features/drink-log.md` 作成 | [01-spec-drink-log.md](phase-03-drink-log/01-spec-drink-log.md) | 未着手 |
| 3-02 | 記録入力画面 | [02-log-input-screen.md](phase-03-drink-log/02-log-input-screen.md) | 未着手 |
| 3-03 | マイドリンク | [03-my-drinks.md](phase-03-drink-log/03-my-drinks.md) | 未着手 |
| 3-04 | 純アルコール量計算ロジック | [04-alcohol-calc-logic.md](phase-03-drink-log/04-alcohol-calc-logic.md) | 未着手 |
| 3-05 | 日別ビュー | [05-daily-view.md](phase-03-drink-log/05-daily-view.md) | 未着手 |
| 3-06 | 週/月サマリー | [06-weekly-monthly-summary.md](phase-03-drink-log/06-weekly-monthly-summary.md) | 未着手 |
| 3-07 | dev環境デプロイと日常利用開始 | [07-dev-deploy-dogfood.md](phase-03-drink-log/07-dev-deploy-dogfood.md) | 未着手 |

### Phase 4（5タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 4-01 | `spec/features/cellar.md` 作成 | [01-spec-cellar.md](phase-04-cellar/01-spec-cellar.md) | 未着手 |
| 4-02 | ボトルCRUD | [02-bottle-crud.md](phase-04-cellar/02-bottle-crud.md) | 未着手 |
| 4-03 | ステータス管理 | [03-status-management.md](phase-04-cellar/03-status-management.md) | 未着手 |
| 4-04 | 写真アップロード（R2） | [04-photo-upload-r2.md](phase-04-cellar/04-photo-upload-r2.md) | 未着手 |
| 4-05 | APIテスト・コンポーネントテスト | [05-api-component-tests.md](phase-04-cellar/05-api-component-tests.md) | 未着手 |

### Phase 5（5タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 5-01 | `spec/features/tasting-note.md` 作成 | [01-spec-tasting-note.md](phase-05-tasting-note/01-spec-tasting-note.md) | 未着手 |
| 5-02 | ノートCRUD | [02-note-crud.md](phase-05-tasting-note/02-note-crud.md) | 未着手 |
| 5-03 | 写真複数枚添付 | [03-multi-photo-attach.md](phase-05-tasting-note/03-multi-photo-attach.md) | 未着手 |
| 5-04 | セラー連携 | [04-cellar-integration.md](phase-05-tasting-note/04-cellar-integration.md) | 未着手 |
| 5-05 | APIテスト・コンポーネントテスト | [05-api-component-tests.md](phase-05-tasting-note/05-api-component-tests.md) | 未着手 |

### Phase 6（5タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 6-01 | vite-plugin-pwa導入 | [01-vite-plugin-pwa.md](phase-06-pwa-quality/01-vite-plugin-pwa.md) | 未着手 |
| 6-02 | Playwright E2E | [02-playwright-e2e.md](phase-06-pwa-quality/02-playwright-e2e.md) | 未着手 |
| 6-03 | パフォーマンス改善 | [03-performance.md](phase-06-pwa-quality/03-performance.md) | 未着手 |
| 6-04 | アクセシビリティ最低限対応 | [04-accessibility.md](phase-06-pwa-quality/04-accessibility.md) | 未着手 |
| 6-05 | iOS Safari / Android Chrome 実機確認 | [05-device-qa.md](phase-06-pwa-quality/05-device-qa.md) | 未着手 |

### Phase 7（9タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 7-01 | 本番用リソース作成 | [01-prod-resources.md](phase-07-production-release/01-prod-resources.md) | 未着手 |
| 7-02 | GitHub Actions デプロイパイプライン | [02-deploy-pipeline.md](phase-07-production-release/02-deploy-pipeline.md) | 未着手 |
| 7-03 | シークレット管理の整理 | [03-secret-management.md](phase-07-production-release/03-secret-management.md) | 未着手 |
| 7-04 | D1日次バックアップ | [04-d1-backup.md](phase-07-production-release/04-d1-backup.md) | 未着手 |
| 7-05 | 監視 | [05-monitoring.md](phase-07-production-release/05-monitoring.md) | 未着手 |
| 7-06 | 独自ドメイン設定（任意） | [06-custom-domain.md](phase-07-production-release/06-custom-domain.md) | 未着手 |
| 7-07 | リリース前の全体セキュリティ監査 | [07-security-audit.md](phase-07-production-release/07-security-audit.md) | 未着手 |
| 7-08 | リリースチェックリスト → `spec/release-checklist.md` | [08-release-checklist.md](phase-07-production-release/08-release-checklist.md) | 未着手 |
| 7-09 | 運用ドキュメント → `spec/operations.md` | [09-operations-docs.md](phase-07-production-release/09-operations-docs.md) | 未着手 |

### Phase 8（6タスク）

| # | ロードマップ原文 | ファイル | 状態 |
|---|---|---|---|
| 8-01 | 利用規約・プライバシーポリシー | [01-terms-privacy.md](phase-08-public-launch/01-terms-privacy.md) | 未着手 |
| 8-02 | 年齢確認（20歳以上） | [02-age-verification.md](phase-08-public-launch/02-age-verification.md) | 未着手 |
| 8-03 | 公開登録確認・パスワードリセット | [03-open-signup-password-reset.md](phase-08-public-launch/03-open-signup-password-reset.md) | 未着手 |
| 8-04 | OAuthログイン | [04-oauth-login.md](phase-08-public-launch/04-oauth-login.md) | 未着手 |
| 8-05 | レート制限・不正利用対策 | [05-rate-limit-abuse.md](phase-08-public-launch/05-rate-limit-abuse.md) | 未着手 |
| 8-06 | 無料枠の使用量監視 | [06-usage-monitoring.md](phase-08-public-launch/06-usage-monitoring.md) | 未着手 |

**合計: フェーズフォルダ 9、タスクファイル 59、フェーズ概要 9、本インデックス 1。**

## 共通ルール（全タスク）

1. 機能実装の前に `spec/features/` を書き、オーナー承認を得る（Phase 3〜5）。
2. 作業ブランチは `feature/<内容>` または `fix/<内容>`。`main` へ直接 push しない。
3. コミット・PR は日本語、`種別: 要約`。
4. シークレットをコード・`wrangler.jsonc`・spec・本フォルダに書かない。
5. 公開エンドポイントを新設する場合は仕様書に明記し、オーナー承認を得る。
6. 完了時に `spec/03-roadmap.md` のチェックボックスを更新する。

## 関連spec

- [spec/00-overview.md](../spec/00-overview.md)
- [spec/01-requirements.md](../spec/01-requirements.md)
- [spec/02-tech-stack.md](../spec/02-tech-stack.md)
- [spec/03-roadmap.md](../spec/03-roadmap.md)
- [spec/README.md](../spec/README.md)
