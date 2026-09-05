# Phase 2: 土台実装

| 項目 | 内容 |
|---|---|
| 目安 | 1〜1.5週間 |
| 状態 | 進行中（01〜05 完了） |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 2 |

## 目的

全機能が乗る共通基盤（DB・認証・レイアウト・型共有・**写真パイプライン**）を作る。個別ドメイン機能（飲酒記録など）はまだ実装しない。画面は [spec/screen-designs/](../../spec/screen-designs/README.md) のとおりに作る。

## 依存

- Phase 0 完了（`wrangler dev`、CI、Biome、Vitest）
- Phase 1 完了（data-model / api-design / design-system / **screen-designs / character** が承認済み）
- Better Auth 用のシークレットは Phase 0-03 以降に `wrangler secret` / `.dev.vars` で投入（値はドキュメントに書かない）

## ゴール（フェーズ DoD）

- サインアップ → ログイン → 空のホーム画面（キャラクター `rest`）がスマートフォン実機ブラウザで動く
- 未ログイン時に API が 401
- 他ユーザーのデータにアクセスできないことがテストで担保されている
- 実機で撮影 → `photo-edit` → 未紐付けアップロードができ、他ユーザーから取得できない（2-08）

## タスク一覧

| # | ファイル | 要点 |
|---|---|---|
| 01 | [Drizzle / マイグレーション](01-drizzle-migration.md) | ローカル D1 適用まで |
| 02 | [Better Auth](02-better-auth.md) | サインアップ/ログイン/ログアウト（招待制は採用しない） |
| 03 | [Hono API 構造](03-hono-api-structure.md) | 認証 MW、Zod、エラー、secure-headers |
| 04 | [Hono RPC + TanStack Query](04-hono-rpc-tanstack-query.md) | クライアントデータ取得基盤 |
| 05 | [共通レイアウト](05-common-layout.md) | 下部タブ（記録が中央の円形）、ヘッダー、トースト、ダイアログ、空 / loading / error |
| 06 | [トークン / shadcn](06-design-tokens-shadcn.md) | Tailwind + 基本コンポーネント + `<Mascot />` |
| 07 | [認証テスト](07-auth-tests.md) | 単体・API 認可 |
| 08 | [写真パイプライン](08-photo-pipeline.md) | `photo-edit`（端末内加工・キャラ合成）、`/api/photos`、未紐付け GC Cron |

推奨順: 01 → 02 → 03 → 04。05 と 06 は UI なので 03/04 と並行しうるが、トークン（06）を先にすると 05 が楽。07 は 02/03 の直後から書き始める。08 は 01 / 03 / 06 の後（Phase 3-02 の前に必須）。

## このフェーズで整備する rules / skills

- skill: `db-migration` — 作成・適用・ロールバック手順
- rule: `api-conventions`（`src/server/**`）— ルート構成、レスポンス形式、認可必須

## 終了後にできること

Phase 3 の飲酒記録（MVP コア）に入れる。

## 確定（2026-08-13）

- **招待制は採用しない**。メール＋パスワードのオープンサインアップ（個人利用では URL 非公開）
- UI は **OS の外観設定に追従**（2-06 でライト／ダーク両方のトークンを入れる）
