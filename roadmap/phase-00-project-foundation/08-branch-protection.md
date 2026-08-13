# 0-08 mainブランチ保護

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 0 プロジェクト基盤 |
| ステータス | **未着手** |
| 要件 | development-workflow: `main` へ直接 push 禁止、CI グリーン必須 |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0 |

## 1. 概要

`main` への直接 push と、CI 未パスのマージを GitHub 側で防ぐ。ルールファイルだけではなく、プラットフォーム制約にする。

## 2. 前提条件

- 0-01 完了、リポジトリ private
- 0-07 の CI ワークフロー名が確定している（必須チェックに指定するため）
- オーナーが GitHub リポジトリ管理者である

## 3. スコープ

**対象**

- `main` を保護する設定（Rulesets または Branch protection）
- 必須ステータスチェック（CI）
- 直接 push の禁止（管理者含むかが **要確認**）

**対象外**

- CODEOWNERS による強制レビュー人数（個人開発では 0 人レビューでもよい）
- GitHub Pro 契約そのもの

## 4. 成果物

- GitHub 上の保護設定（コードではない）
- `spec/` またはルート README の「ブランチ運用」に、設定した手段を 1 段落で記録（画面の秘密は不要）

## 5. 細分化タスク

1. GitHub Free × private で使える保護手段を確認する
2. 必須チェックに 0-07 のジョブ名を登録する
3. 自分のアカウントで `main` に直接 push して拒否されることを確認する
4. PR 経由のみマージできることを確認する
5. 制約（Pro が必要等）があれば代替を文書化する

## 6. 手順

**調査結果（2026-08-13）**

```text
gh api repos/akihotsuji/alco-app/branches/main/protection
→ 403 Upgrade to GitHub Pro or make this repository public
```

classic Branch protection は、現状の Free + private では使えない。次のいずれかを選ぶ（**要確認**）:

A. **Repository rulesets**（Free で一部利用可。UI: Settings → Rules → Rulesets）
   - Target: `main`
   - Restrict updates
   - Require status checks to pass（CI のチェック名）
   - 管理者にも適用するか

B. **GitHub Pro** を契約し classic protection を使う

C. リポジトリを public にする（個人用ソースとしては非推奨）

D. 機械的保護を諦め、ルールと CI のみ（DoD 弱。最終手段）

設定手順（A の場合の目安）:

1. GitHub → Settings → Rules → New ruleset
2. Bypass をオーナーだけにしない（エージェントの PAT が main を更新できてしまうため。**要確認**）
3. Status check に CI ジョブの **正確な名前** を入れる（Actions のチェック名と一致させる）
4. 確認:

```powershell
git checkout main
# 空コミットを試みない。テスト用ブランチで保護の有無を見る
```

直接 push テストはダミーファイルを `main` に push して **拒否されること** を見る。成功してしまったら戻す（revert / 削除コミット。force push はユーザー依頼がない限りしない）。

## 7. 仕様詳細

[development-workflow](../../.cursor/rules/development-workflow.mdc):

- `main` 直接 push 禁止
- CI がグリーンでない PR はマージしない
- 1PR = 1 関心事

個人リポジトリでも「エージェントが誤って main に push する」事故を防ぐ価値がある。

Squash merge を標準にするかは **要確認**。履歴を単純にするなら squash 推奨。

## 8. 受け入れ条件

- [ ] `main` への直接 push が（少なくとも一般的な権限で）拒否される、または ruleset で同等
- [ ] PR の必須チェックに CI が入っている（A/B 選択時）
- [ ] 使った手段が README か spec に書いてある
- [ ] Pro が必要なら、未契約のまま「保護したつもり」になっていない

Free で必須チェックが付けられない場合: 受け入れを「文書化 + 運用」に落とす判断をオーナーが明示する。

## 9. セキュリティ観点

- 保護を Bypass できるトークンを GitHub Actions に広く渡さない
- public 化して protection を得る選択は、ソース漏洩とトレードオフ

## 10. 関連ファイル / 関連spec

- [.cursor/rules/development-workflow.mdc](../../.cursor/rules/development-workflow.mdc)
- [07-github-actions-ci.md](07-github-actions-ci.md)

## 11. リスク・注意点

- チェック名のタイポで「必須チェックが永遠に pending」になりマージ不能になる
- 管理者が bypass できる設定だと、ローカルから `git push origin main` が通ってしまう
- 本タスクはコンソール作業が多く、エージェントだけでは完了できない項目がある（オーナー操作）
