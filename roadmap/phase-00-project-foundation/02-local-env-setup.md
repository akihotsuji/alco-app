# 0-02 Node.js / pnpm / wrangler のローカル環境セットアップ

| 項目       | 内容                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| フェーズ   | Phase 0 プロジェクト基盤                                                              |
| ステータス | **完了**（2026-09-03。Node 22 / pnpm 10 / ローカル wrangler。README と `.node-version` あり） |
| 要件       | 保守性、Cloudflare 上での開発（[spec/02-tech-stack.md](../../spec/02-tech-stack.md)） |
| ソース     | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0                                |

## 1. 概要

エージェントとオーナーが同じコマンドで開発できるように、ランタイムとパッケージマネージャ、Cloudflare CLI を揃える。アプリのスキャフォールド自体は 0-04。本タスクは **ツールチェーンの確立とドキュメント化**。

## 2. 前提条件

- 0-01 完了（リポジトリがある）
- オーナーマシン: Windows 10（本リポジトリ確認環境は win32 10.0 / PowerShell）
- Node 公式またはバージョンマネージャ（**要確認**: Volta / fnm / nvm-windows のどれを標準にするか）

## 3. スコープ

**対象**

- Node.js バージョンの固定方法
- pnpm の導入
- wrangler の使い方（プロジェクトローカル推奨）
- 動作確認コマンドを README に書く

**対象外**

- Cloudflare リソース作成（0-03）
- Vite/Hono プロジェクト生成（0-04）
- CI 上の Node セットアップ（0-07。本タスクのバージョンに合わせる）

## 4. 成果物

- ルート `README.md` の「開発環境」節（現在はタイトルのみ）
- **要確認**: `package.json` の `packageManager` フィールド、または `pnpm-workspace.yaml` は置かない（単一パッケージ）
- （任意）`.nvmrc` / `.node-version` で Node バージョン固定

## 5. 細分化タスク

1. 採用する Node メジャーバージョンを決める（推奨案: Node 22 LTS。**要確認**）
2. pnpm の導入方法を決める（Corepack 推奨）
3. ローカルで `node -v` / `pnpm -v` が通ることを確認する
4. wrangler はグローバルインストールせず、0-04 以降 `pnpm exec wrangler` で呼ぶ方針を README に書く
5. PowerShell 実行ポリシーや `pnpm` が PATH に乗らない場合の注意を README に書く

## 6. 手順

1. Node を入れる（例。バージョンはオーナー承認後）:

```powershell
node -v
```

2. Corepack で pnpm を有効化:

```powershell
corepack enable
corepack prepare pnpm@10 --activate
pnpm -v
```

pnpm のマイナーバージョンは 0-04 で `package.json` にロックした値を正とする。

3. まだ `package.json` が無い間の wrangler 確認（任意）:

```powershell
pnpm dlx wrangler --version
```

4. Cloudflare ログインは 0-03 で行う（本タスクではアカウント作成まで求めない）。
5. ルート README に以下を追記する（値の例はプレースホルダ）:

- 必要ツール: Node xx、pnpm、Git
- インストール: `pnpm install`（0-04 後）
- 開発: `pnpm dev` または `pnpm exec wrangler dev --env dev`（0-04 で scripts 名を確定。env は 0-03 FIX）

## 7. 仕様詳細

[spec/02-tech-stack.md](../../spec/02-tech-stack.md) より:

- パッケージマネージャ: **pnpm**（npm/yarn で lockfile を増やさない）
- ローカル開発: **wrangler dev**（D1/R2 をエミュレート）
- 単一パッケージ。pnpm workspaces は使わない

**FIX（0-04 で確定）**

- Node **22**（`.node-version` / `engines`）。pnpm は `packageManager`: `pnpm@10.11.0`
- エディタは Cursor。VS Code 用 workspace `alco-app.code-workspace` は既にある

Windows 固有:

- リポジトリ確認時、PowerShell profile が `mise activate` を呼んで失敗している。標準ツールに mise を含めないか、含めるなら手順に書く。**要確認**（未導入なら profile から外すのはオーナー作業）

## 8. 受け入れ条件

- [x] README に必要ツールと確認コマンドがある
- [x] オーナーマシンで `node -v` と `pnpm -v` が通る
- [x] wrangler をグローバル必須にしない方針が書いてある
- [x] Node バージョンがドキュメントまたは `.node-version` で固定されている
- [x] シークレットを書いていない

lint/test はプロジェクト未生成なら N/A。0-04 以降に CI と揃える。

## 9. セキュリティ観点

- `wrangler login` のトークンをチャットや spec に貼らない
- グローバルに古い wrangler を入れ、プロジェクトとバージョンがズレないよう **ローカル依存を正** にする

## 10. 関連ファイル / 関連spec

- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)
- [README.md](../../README.md)（更新対象）
- 次: [03-cloudflare-dev-resources.md](03-cloudflare-dev-resources.md)、[04-hello-world-scaffold.md](04-hello-world-scaffold.md)

## 11. リスク・注意点

- Node バージョンを決めずに 0-04 へ進むと、CI とローカルが割れる
- チーム（将来）で npm と pnpm が混在すると `package-lock.json` が生える。`.gitignore` で npm / yarn / bun の lock を無視する（正本は `pnpm-lock.yaml`）
- 起動は 0-04 以降。日常は `pnpm dev`、確認は `wrangler dev --env dev`
