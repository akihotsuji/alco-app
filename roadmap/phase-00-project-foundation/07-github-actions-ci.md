# 0-07 GitHub Actions CI（lint / typecheck / test / pnpm audit）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 0 プロジェクト基盤 |
| ステータス | **完了**（2026-09-03。`.github/workflows/ci.yml`） |
| 要件 | 保守性、依存脆弱性（security.mdc の `pnpm audit`） |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0 |

## 1. 概要

PR ごとに lint / typecheck / test / 依存監査（OSV-Scanner）を走らせ、壊れたコードを `main` に入れない。デプロイは Phase 7-02。本タスクは **検証のみ**。

## 2. 前提条件

- 0-04〜0-05 完了。`pnpm lint` / `pnpm typecheck` / `pnpm test` が存在する（0-06 の Vitest 移行前でも `pnpm test` があれば可）
- 0-01 の GitHub リポジトリ
- pnpm lockfile がある（`pnpm install --frozen-lockfile` のため）

## 3. スコープ

**対象**

- `.github/workflows/ci.yml`（名前は任意だが 1 ファイルで十分）
- PR と `main` への push で起動
- Node バージョンは 0-02 と一致

**対象外**

- デプロイジョブ
- Playwright（Phase 6。ジョブ追加時は別ファイルか matrix）
- ブランチ保護の GitHub 設定（0-08）

## 4. 成果物

- `.github/workflows/ci.yml`
- README に「CI が見ているコマンド」を列挙
- （任意）PR テンプレート。必須ではない → 作らない

## 5. 細分化タスク

1. pnpm の公式 Action 手順で cache 付き install を書く
2. `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm audit` を順に実行する
3. audit の終了コード方針を決める（High 以上で失敗。`--audit-level=high`）
4. feature ブランチでダミー PR を作り、グリーンを確認する
5. ロードマップチェックを更新する

## 6. 手順

1. `.github/workflows/ci.yml` を追加する。要点:

- `on: pull_request` および `push.branches: [main]`
- `concurrency` で同一 PR の古い run をキャンセルしてよい
- `pnpm/action-setup` + `actions/setup-node`（`cache: pnpm`）
- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit --audit-level=high`（フラグは pnpm 版で確認）

2. ブランチを切って PR:

```powershell
git checkout -b feature/ci
# ファイル追加
git add .github/workflows/ci.yml
git commit -m "chore: PR向けCIを追加"
git push -u origin HEAD
gh pr create --title "chore: PR向けCIを追加" --body "lint / typecheck / test / audit をPRで実行する。"
```

3. Actions タブでパスを確認する。失敗したら修正コミットを同じ PR に足す。

4. Cloudflare のトークンは **このワークフローに不要**。誤って `wrangler deploy` を足さない。

## 7. 仕様詳細

[security.mdc](../../.cursor/rules/security.mdc): High 以上の脆弱性がある依存はマージしない。

audit が推移依存で落ち続ける場合:

- まずアップグレードを試す
- どうしても無理ならオーナー承認のうえ例外を文書化する（黙って `--no-audit` しない）

**公開ワークフロー**に次を書かない:

- `CLOUDFLARE_API_TOKEN`
- Better Auth secret

permissions: デフォルトの `contents: read` で足りる。`pull-requests: write` はコメント bot を足すまで不要。

## 8. 受け入れ条件

- [x] PR で CI が走る（Phase 0 DoD）
- [x] lint / typecheck / test がパスする
- [x] `pnpm audit` がワークフローに含まれる
- [x] lockfile なし install（`--frozen-lockfile` 違反）が CI で失敗する
- [x] デプロイやシークレット参照がない

## 9. セキュリティ観点

- `permissions` を最小にする
- `pull_request_target` を使わない（フォークからの秘密漏洩を避ける。個人リポジトリでも習慣化する）
- audit 結果を無視しない

## 10. 関連ファイル / 関連spec

- [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)（CI 0-07 FIX）
- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc)
- [.cursor/rules/development-workflow.mdc](../../.cursor/rules/development-workflow.mdc)
- 次: [08-branch-protection.md](08-branch-protection.md)

## 11. リスク・注意点

- Windows ローカルと `ubuntu-latest` の差。パス区切りに依存しない
- 無料 Actions 分を Playwright まで同時に走らせると後で逼迫する。本タスクでは軽量ジョブに留める
- `main` 直 push がまだ可能な間は CI の意味が半減する → すぐ 0-08

## 12. FIX（0-07）

正本は [spec/02-tech-stack.md](../../spec/02-tech-stack.md) の「CI」。

| 項目 | 決定 |
|---|---|
| ファイル | `.github/workflows/ci.yml` のみ。PR テンプレートは作らない |
| 起動 | `pull_request` と `push` to `main`。`concurrency` で同一 ref の古い run をキャンセル |
| Actions | `actions/checkout@v7` / `pnpm/action-setup@v6` / `actions/setup-node@v7` |
| pnpm 10 | `pnpm/action-setup` を使う（`pnpm/setup` は pnpm 11+）。version 入力は省略し `packageManager` を正とする |
| Node | `.node-version`（22）。`cache: pnpm` は setup-node 側 |
| install | `pnpm install --frozen-lockfile` |
| 実行順 | `lint` → `typecheck` → `test` → OSV-Scanner（lockfile） |
| audit | CI は **OSV-Scanner v2.5.1**（SHA256 固定）で `pnpm-lock.yaml` を検査。既知脆弱性があれば非ゼロ終了。npm の `/-/npm/v1/security/audits` は使わない（ソケットタイムアウトが多発）。黙って監査を外さない。ローカルは `pnpm audit --audit-level=high` でも可 |
| 権限 | `contents: read`。`pull_request_target` 不使用。シークレット・デプロイなし |
| ジョブ名 | `lint / typecheck / test / audit`（0-08 の必須チェック名） |
| 前提の緩和 | 0-06（Vitest）未マージでも、既存の `pnpm test` を CI が呼ぶ。ランナー差し替え後も script 名は変えない |
