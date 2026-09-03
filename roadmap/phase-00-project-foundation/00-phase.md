# Phase 0: プロジェクト基盤

| 項目 | 内容 |
|---|---|
| 目安 | 2〜3日 |
| 状態 | 部分完了（GitHub、rules/skills、Cloudflare dev リソース） |
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
| 02 | [ローカル環境](02-local-env-setup.md) | 未着手 |
| 03 | [Cloudflare D1/R2（dev）](03-cloudflare-dev-resources.md) | 完了 |
| 04 | [空プロジェクト（Hello World）](04-hello-world-scaffold.md) | 完了 |
| 05 | [TypeScript strict / Biome](05-typescript-biome.md) | 未着手 |
| 06 | [Vitest](06-vitest.md) | 未着手 |
| 07 | [GitHub Actions CI](07-github-actions-ci.md) | 未着手 |
| 08 | [main ブランチ保護](08-branch-protection.md) | 未着手 |
| 09 | [Cursor rules / skills](09-cursor-rules-skills.md) | 完了 |

推奨順: 01（済）→ 02 → 03（済）→ 04（済）→ 05 → 06 → 07 → 08。09 は済。

## このフェーズで整備する rules / skills

ロードマップ記載どおり、以下はリポジトリに存在しコミット済み。

- rule: `project-context` / `development-workflow` / `security` / `coding-standards`
- skill: `feature-dev` / `security-audit`

## 終了後にできること

Phase 1 の設計ドキュメント作成に入れる。実装（Phase 2）は Phase 1 の承認後。

## 現状メモ

- `package.json`・`src/`・`wrangler.jsonc` は 0-04 で作成済み。`.github/` は未着手。`.gitignore` は作成済み
- Cloudflare dev: D1 `alco-app-dev`、R2 `alco-app-photos-dev`（非公開）。binding `DB` / `PHOTOS`。`env.dev` で分ける（**FIX**）
- GitHub リポジトリはプライベート
- classic branch protection API は GitHub Free プライベートで 403。08 で代替手段を決める
