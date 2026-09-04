# 0-09 `.cursor/rules/` の整備

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 0 プロジェクト基盤 |
| ステータス | **完了**（記載分はリポジトリにコミット済み。ロードマップのチェックは未更新） |
| 要件 | AI エージェント主導（[spec/00-overview.md](../../spec/00-overview.md)） |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0 rules / skills |

## 1. 概要

エージェントが毎回守るルールと、機能開発・セキュリティ監査のスキルをリポジトリに置く。コードより先に「どう作るか」を固定する。

## 2. 前提条件

- 0-01 のリポジトリ
- Cursor で `.cursor/rules` と `.cursor/skills` が読み込まれること

## 3. スコープ

**対象（ロードマップ Phase 0 記載）**

| 種別 | 名前 | 実在パス |
|---|---|---|
| rule | project-context | `.cursor/rules/project-context.mdc` |
| rule | development-workflow | `.cursor/rules/development-workflow.mdc` |
| rule | security | `.cursor/rules/security.mdc` |
| rule | coding-standards | `.cursor/rules/coding-standards.mdc` |
| skill | feature-dev | `.cursor/skills/feature-dev/SKILL.md` |
| skill | security-audit | `.cursor/skills/security-audit/SKILL.md` |

**対象外（後続フェーズで追加）**

- `database`（Phase 1-04）
- `ui-design`（Phase 1-03 で追加済み: `.cursor/rules/ui-design.mdc`）
- `db-migration` / `api-conventions`（Phase 2）
- `e2e-testing`（Phase 6）
- `release`（Phase 7）

## 4. 成果物

上記 6 ファイル（存在確認済み）。追加・改訂はこのタスクの「保守」として扱う。

## 5. 細分化タスク

1. 6 ファイルが `alwaysApply` / `globs` 付きで意図どおりか確認する
2. spec のスタック・ディレクトリと `project-context` の食い違いを直す（現状一致）
3. 後続フェーズ用ルールを **今は増やしすぎない**（空ファイルを量産しない）
4. ロードマップのチェックボックスを更新する

## 6. 手順

**検証（完了確認）:**

```powershell
Get-ChildItem -Recurse .cursor\rules, .cursor\skills | Select-Object FullName
```

期待されるファイルは「3. スコープ」の表と一致する。

内容レビュー観点:

- `project-context`: 3 コア機能、Hono/Vite/D1/R2、`src/client|server|db|shared`
- `development-workflow`: 仕様駆動、ブランチ、日本語コミット、DoD 5 項
- `security`: セッションの userId、Zod、R2 非公開、シークレット管理
- `coding-standards`: `*.ts, *.tsx` に globs、テストは隣の `*.test.ts`
- `feature-dev`: shared → db → server → client
- `security-audit`: Critical でマージ不可、報告フォーマット

不足があれば同じ PR で直す。新規ルールを足すときは Phase 1 以降のタスクに回す。

## 7. 仕様詳細

rules はエージェントへの強制力、spec はプロダクトの正本。矛盾したら **spec を先に直し、同じ変更で rule を同期** する。

`security.mdc` の公開エンドポイント例外は、health（0-04）と Better Auth の `/api/auth/*`（Phase 2）が該当する。追加時は仕様に明記する。

## 8. 受け入れ条件

- [x] Phase 0 記載の 4 rules + 2 skills がコミットされている（Phase 0 DoD）
- [ ] `spec/03-roadmap.md` のチェック更新
- [x] `coding-standards` に globs がある
- [x] security-audit が PR 前必須と DoD に書かれている

## 9. セキュリティ観点

- security rule 自体にトークン例（本物）を書かない。BAD/GOOD はダミーの userId
- スキルが「攻撃手順のPoC を書け」と誘導しない（本リポジトリの security-audit は防御チェックリスト）

## 10. 関連ファイル / 関連spec

- [.cursor/rules/](../../.cursor/rules/)
- [.cursor/skills/feature-dev/SKILL.md](../../.cursor/skills/feature-dev/SKILL.md)
- [.cursor/skills/security-audit/SKILL.md](../../.cursor/skills/security-audit/SKILL.md)
- [spec/00-overview.md](../../spec/00-overview.md)

## 11. リスク・注意点

- ルールが長すぎるとエージェントが一部を落とす。追加はフェーズごとに最小限
- `alwaysApply: true` を増やしすぎない。`database` は `src/db/**` に globs する
- 完了済みでも、後続フェーズで rules と spec が矛盾したら同じ変更で直す
