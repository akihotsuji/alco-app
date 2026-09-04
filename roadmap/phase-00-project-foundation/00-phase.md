# Phase 0: プロジェクト基盤

| 項目 | 内容 |
|---|---|
| 目安 | 2〜3日 |
| 状態 | 部分完了（01〜07・09 済。08 は JSON 済み。残りは GitHub への ruleset 適用と private 化） |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0 |

## 目的

コードを本格的に書く前に、「壊れたら CI が止める」体制を作る。AI エージェント主導開発では、リポジトリ規約・型・lint・テスト・ブランチ保護が品質の生命線になる。

## 依存

なし（最初のフェーズ）。ただしオーナー側で Cloudflare アカウントと GitHub アカウントが使えること。

## ゴール（フェーズ DoD）

- `wrangler dev --env dev` で Hello World がローカル起動する
- PR を作ると CI が走り、lint / typecheck / test / `pnpm audit` がパスする
- Phase 0 記載の rules/skills がリポジトリにコミットされている（**これは達成済み**）

## タスク一覧

| # | ファイル | 状態 |
|---|---|---|
| 01 | [Git / GitHub](01-git-github-init.md) | 完了 |
| 02 | [ローカル環境](02-local-env-setup.md) | 完了 |
| 03 | [Cloudflare D1/R2（dev）](03-cloudflare-dev-resources.md) | 完了 |
| 04 | [空プロジェクト（Hello World）](04-hello-world-scaffold.md) | 完了 |
| 05 | [TypeScript strict / Biome](05-typescript-biome.md) | 完了 |
| 06 | [Vitest](06-vitest.md) | 完了 |
| 07 | [GitHub Actions CI](07-github-actions-ci.md) | 完了 |
| 08 | [main ブランチ保護](08-branch-protection.md) | 部分完了 |
| 09 | [Cursor rules / skills](09-cursor-rules-skills.md) | 完了 |

推奨順: 01〜07・09 済。0-07 は `main` 済み。オーナーが 08 の ruleset を適用する。

## このフェーズで整備する rules / skills

ロードマップ記載どおり、以下はリポジトリに存在しコミット済み。

- rule: `project-context` / `development-workflow` / `security` / `coding-standards`
- skill: `feature-dev` / `security-audit`

## 終了後にできること

Phase 1 の設計ドキュメント作成に入れる。実装（Phase 2）は Phase 1 の承認後。

## 現状メモ

- ローカルツールチェーン（Node 22 / pnpm 10 / ローカル wrangler）は 0-02 で完了。`package.json`・`src/`・`wrangler.jsonc` は 0-04、TypeScript / Biome は 0-05、Vitest は 0-06。CI は `.github/workflows/ci.yml`（0-07）。`.gitignore` は作成済み
- Cloudflare dev: D1 `alco-app-dev`、R2 `alco-app-photos-dev`（非公開）。binding `DB` / `PHOTOS`。`env.dev` で分ける（**FIX**）
- GitHub リポジトリは 0-01 では private。2026-09-03 時点で public。2026-09-04 に **private へ戻す**と決定（Cloud Agent は private で使える）。変更はオーナー作業
- `main` は未保護。08 は ruleset `protect-main`（必須チェックなし、全マージ方式）。適用はオーナー。エージェントは 403
