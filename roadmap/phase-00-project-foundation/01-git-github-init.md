# 0-01 Gitリポジトリ初期化、GitHubプライベートリポジトリ作成

| 項目       | 内容                                                   |
| ---------- | ------------------------------------------------------ |
| フェーズ   | Phase 0 プロジェクト基盤                               |
| ステータス | **完了**（2026-08-13 確認。2026-09-03 時点の可視性は public。0-08 参照） |
| 要件       | 保守性（CI・ブランチ運用の前提）                       |
| ソース     | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0 |

## 1. 概要

alco-app の履歴とリモートを確立する。以降の全作業は GitHub 上のプライベートリポジトリを正とする。`main` 直 push 禁止は 0-08 で機械化するが、運用ルールは [development-workflow](../../.cursor/rules/development-workflow.mdc) に既にある。

## 2. 前提条件

- GitHub アカウント
- ローカルに Git
- リモートをプライベートにする判断（[spec/00-overview.md](../../spec/00-overview.md): まず個人用）

先行タスク: なし。

## 3. スコープ

**対象**

- `git init`（または既存クローン）
- GitHub プライベートリポジトリ作成と `origin` 接続
- 初期コミット方針（spec / rules を先に載せる）

**対象外**

- ブランチ保護（[08-branch-protection.md](08-branch-protection.md)）
- CI（[07-github-actions-ci.md](07-github-actions-ci.md)）
- スキャフォールド本体（[04-hello-world-scaffold.md](04-hello-world-scaffold.md)）。`.gitignore` は先行作成済み

## 4. 成果物

- ローカル Git リポジトリ
- `https://github.com/akihotsuji/alco-app`（private）
- デフォルトブランチ `main`
- `.gitignore`（シークレット・ビルド成果物・他パッケージマネージャの lockfile を除外）

## 5. 細分化タスク

1. ローカルで Git が使えることを確認する
2. GitHub にプライベートリポジトリを作る
3. `origin` を設定し、`main` を push する
4. ブラウザまたは `gh repo view` で private を確認する
5. ロードマップのチェックを更新する（未実施ならドキュメント同期で行う）

## 6. 手順

**現状は完了済み。** 再実行や検証は次で足りる。

```powershell
git status -sb
git remote -v
gh repo view akihotsuji/alco-app --json name,isPrivate,url,defaultBranchRef
```

期待: `isPrivate: true`、`defaultBranchRef.name: main`、`origin` が当該 URL。

新規でやり直す場合（参考。既存を消さないこと）:

1. GitHub で Private リポジトリを作成（README を GitHub 側で作ると履歴が割れるので、空リポジトリが安全）
2. `git init` → 初回コミット → `git branch -M main`
3. `git remote add origin https://github.com/<owner>/alco-app.git`
4. `git push -u origin main`

コミットメッセージは日本語、`chore: プロジェクトセットアップ` 形式。

## 7. 仕様詳細

- 公開範囲は個人用でも **リポジトリは private**（ソース・spec・将来の運用メモを守る）
- デフォルトブランチは `main`
- 作業ブランチ命名: `feature/<内容>` / `fix/<内容>`
- シークレットをコミットしない。`.dev.vars` / `.env*` / 鍵ファイルはルートの `.gitignore` で除外する（テンプレの `.dev.vars.example` / `.env.example` は追跡する）

確認済みの初期履歴（参考）:

- `Initial commit`
- `プロジェクトセットアップ`
- `Merge branch 'main' of https://github.com/akihotsuji/alco-app`

## 8. 受け入れ条件

- [x] リモートが存在し private である
- [x] デフォルトブランチが `main`
- [x] `spec/03-roadmap.md` の当該チェックが `[x]`
- [x] `.gitignore` がある（0-04 でも上書きせず内容確認する）

DoD 共通: 本タスクはインフラ作業のためアプリテストは不要。

## 9. セキュリティ観点

- リポジトリを public にしない（個人利用フェーズ、将来のシークレット運用ミスの影響面を狭める）
- Collaborator は最小限
- このタスクでトークンや Cloudflare アカウント ID を README に書かない

## 10. 関連ファイル / 関連spec

- [spec/03-roadmap.md](../../spec/03-roadmap.md)
- [spec/00-overview.md](../../spec/00-overview.md)
- [.gitignore](../../.gitignore)
- [.cursor/rules/development-workflow.mdc](../../.cursor/rules/development-workflow.mdc)
- 次: [02-local-env-setup.md](02-local-env-setup.md)

## 11. リスク・注意点

- GitHub 側とローカルで初期 README を両方作ると初回 pull が必要になる（既に merge コミットあり）
- `image/image.png` は TSUZUKIT ポートフォリオ画面のスクリーンショットで、alco-app 仕様とは無関係。誤ってデザイン正本にしない
- 未コミットの仕様差分は本タスクとは無関係。コミットするなら別 PR
