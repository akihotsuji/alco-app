# 0-08 mainブランチ保護

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 0 プロジェクト基盤 |
| ステータス | **部分完了**（2026-09-04。方針を再 FIX。JSON は必須チェックなし・全マージ方式。GitHub 上の ruleset は未適用。エージェントは 403） |
| 要件 | development-workflow: `main` へ直接 push 禁止、CI グリーン必須 |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0 |

## 1. 概要

`main` への直接 push と、CI 未パスのマージを GitHub 側で防ぐ。ルールファイルだけではなく、プラットフォーム制約にする。

## 2. 前提条件

- 0-01 完了
- 0-07 の CI は `main` 済み。ruleset の必須ステータスチェックには**使わない**（2026-09-04）
- オーナーが GitHub リポジトリ管理者である（ruleset 作成と可視性変更に Administration 権限が必要）

## 3. スコープ

**対象**

- `main` を保護する設定（**Repository rulesets**）
- 直接 push の禁止（bypass なし。管理者の git push も拒否する）
- 必須ステータスチェックは**置かない**

**対象外**

- CODEOWNERS による強制レビュー人数（個人開発では承認 0 人）
- GitHub Pro 契約そのもの
- このエージェントからの ruleset 作成（トークンは `metadata:read` のみで 403）

## 4. 成果物

- [`.github/rulesets/protect-main.json`](../../.github/rulesets/protect-main.json)（オーナーが POST するペイロード）
- ルート README の「ブランチ運用」
- 本ファイルの FIX

GitHub 上の有効な ruleset は **オーナー適用後** に成果物になる。

## 5. 細分化タスク

1. GitHub Free で使える保護手段を確認する
2. 必須チェックは付けない（2026-09-04）
3. 自分のアカウントで `main` に直接 push して拒否されることを確認する（オーナー）
4. PR 経由のみマージできることを確認する（オーナー）
5. エージェントが API で作れないことを文書化する

## 6. 手順

### 6.1 調査結果（2026-09-03）

| 項目 | 結果 |
|---|---|
| 可視性 | **public**（0-01 時点の private から変更されている） |
| classic branch protection GET | `403 Resource not accessible by integration` |
| `main.protected` | `false`（保護なし） |
| rulesets | `[]` |
| ruleset POST（エージェント） | `403 Resource not accessible by integration` |
| トークン権限 | `metadata:read` のみ。Administration なし |

public の GitHub Free では Repository rulesets をフルに使える。classic protection も public なら Free で使えるが、**A（rulesets）を採用**する。private に戻すと classic は Pro 必須になるため、rulesets の方が後から private に戻しても継続しやすい。

### 6.2 オーナーが適用する（必須）

0-07 の CI を `main` にマージしてから実行する。

**UI**

1. GitHub → Settings → Rules → Rulesets → New ruleset → New branch ruleset
2. Name: `protect-main`、Enforcement: Active
3. Target: Default branch（`main`）
4. Bypass: 誰も追加しない
5. Rules:
   - Block force pushes
   - Restrict deletions
   - Require a pull request before merging（承認人数 **0**。CODEOWNERS 不要）
   - Allowed merge methods: **merge / squash / rebase**
   - Require status checks: **付けない**
6. Create

**API**（オーナーの PAT または `gh`。Administration が必要）:

```powershell
gh repo edit akihotsuji/alco-app --visibility private --accept-visibility-change-consequences
gh api --method POST repos/akihotsuji/alco-app/rulesets --input .github/rulesets/protect-main.json
gh api repos/akihotsuji/alco-app/rulesets
```

### 6.3 適用後の確認（オーナー）

直接 push はダミーファイルを `main` に push して **拒否されること** を見る。成功してしまったら戻す（revert。force push はユーザー依頼がない限りしない）。

```powershell
git checkout -b tmp/protect-main-probe
# 空コミットを main に直接 push しない。適用後に別クローンで
# git push origin HEAD:main が rejected になることを確認する
```

## 7. 仕様詳細

[development-workflow](../../.cursor/rules/development-workflow.mdc):

- `main` 直接 push 禁止
- CI がグリーンでない PR はマージしない
- 1PR = 1 関心事

個人リポジトリでも「エージェントが誤って main に push する」事故を防ぐ価値がある。bypass を空にすることで、エージェントの PAT / GitHub App も `main` 直 push できない。

## 8. 受け入れ条件

- [ ] `main` への直接 push が拒否される（**オーナー適用後**）
- [x] 必須ステータスチェックは ruleset に含めない（2026-09-04）
- [x] 使った手段が README か spec に書いてある
- [x] Pro が必要なら、未契約のまま「保護したつもり」になっていない（rulesets は public / private とも Free で使える）

## 9. セキュリティ観点

- 保護を Bypass できるトークンを GitHub Actions に広く渡さない（本 ruleset は bypass なし）
- 可視性は **private に戻す**（2026-09-04）。ruleset 方針は public / private で変えない
- エージェントのトークンで ruleset を作れないことは、誤って保護を外す事故も防げる

## 10. 関連ファイル / 関連spec

- [.github/rulesets/protect-main.json](../../.github/rulesets/protect-main.json)
- [README.md](../../README.md)（ブランチ運用）
- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)（ブランチ運用 0-08 FIX）
- [.cursor/rules/development-workflow.mdc](../../.cursor/rules/development-workflow.mdc)
- [07-github-actions-ci.md](07-github-actions-ci.md)

## 11. リスク・注意点

- 管理者が bypass できる設定だと、ローカルから `git push origin main` が通ってしまう
- 本タスクの GitHub コンソール適用はオーナー作業。エージェントは 403 で作成・可視性変更できない
- CI を必須チェックにすると、チェック名のタイポでマージ不能になる。2026-09-04 以降は付けない

## 12. FIX（0-08）

| 項目 | 決定 |
|---|---|
| 手段 | **A. Repository rulesets**（classic protection は使わない） |
| 対象 | デフォルトブランチ（`~DEFAULT_BRANCH` = `main`） |
| 強制 | `active`。bypass なし |
| 禁止 | force push（`non_fast_forward`）、ブランチ削除（`deletion`）、`main` 直 push |
| 作業ブランチ | 切る直前に `git fetch origin main`。`git checkout -b feature/<内容> origin/main`（または `fix/`）。ローカル main / 未フェッチの origin から切らない |
| PR | 必須。承認人数 0。CODEOWNERS なし |
| マージ | **merge / squash / rebase** いずれも可 |
| 必須チェック | **なし** |
| 適用者 | オーナー（Administration）。適用コマンドは 6.2 |
| 可視性 | **private に戻す**（2026-09-04）。Cloud Agent は private でも動作する（[GitHub 連携](https://cursor.com/docs/integrations/github)） |
