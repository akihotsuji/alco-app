# 0-03 Cloudflareアカウント作成、D1・R2作成（dev用）

| 項目       | 内容                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| フェーズ   | Phase 0 プロジェクト基盤                                                    |
| ステータス | **完了**（2026-08-15。dev D1/R2 作成済み。`wrangler.jsonc` への転記は 0-04） |
| 要件       | コスト無料枠、D1/R2（[spec/02-tech-stack.md](../../spec/02-tech-stack.md)） |
| ソース     | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0                      |

## 1. 概要

dev 用の Cloudflare リソースを用意する。本番用は Phase 7。無料枠内で Workers + D1 + R2 を使う前提。

## 2. 前提条件

- 0-02 で Node / pnpm / wrangler が使える
- オーナーの Cloudflare アカウント（メール登録）。**アカウント ID や API トークンをドキュメントに書かない**
- 0-04 と前後してよいが、`wrangler.jsonc` に D1 database_id を書くのはリソース作成後

## 3. スコープ

**対象**

- Cloudflare アカウント
- **dev** 用 D1 データベース 1 つ
- **dev** 用 R2 バケット 1 つ（非公開）
- ローカルバインディング方針（`wrangler.jsonc` の形。ファイル本体は 0-04 で作ってもよい）

**対象外**

- 本番 D1/R2（Phase 7-01）
- R2 のカスタムドメイン公開（禁止。認可付き配信は Phase 4）
- Workers のデプロイ（0-04 のローカル起動が先。dev デプロイは Phase 3-07）

## 4. 成果物

- Cloudflare 上の dev D1: `alco-app-dev`（**FIX**）
- Cloudflare 上の dev R2: `alco-app-photos-dev`（非公開。**FIX**）
- バインディングと env 方針（**FIX**。設定ファイル本体は 0-04）:
  - D1 binding: `DB` / R2 binding: `PHOTOS`
  - wrangler は最初から `env.dev` で分ける。トップレベルを dev 扱いにしない
- `.dev.vars` はまだ空でもよい。ルート `.gitignore` が `.dev.vars*` を除外済み（`.dev.vars.example` は追跡可）

## 5. 細分化タスク

1. `pnpm exec wrangler login` で認証する（ブラウザ）
2. D1 を create し、出力の `database_id` を wrangler 設定へ（チャットのログに残すなら ID のみ、トークンは残さない）
3. R2 バケットを create する。公開設定にしない
4. ダッシュボードでバケットが private であることを確認する
5. 命名を spec または README の「環境」節に書く（ID は wrangler.jsonc のみ）

## 6. 手順

1. ログイン:

```powershell
pnpm exec wrangler login
pnpm exec wrangler whoami
```

2. D1 作成:

```powershell
pnpm exec wrangler d1 create alco-app-dev
```

出力の `database_id` は 0-04 で `wrangler.jsonc` の `env.dev` に書く（本手順書には実 ID を書かない）。

`migrations_dir` は Phase 2 で使う。空ディレクトリを 0-04 で作っておいてもよい。

3. R2 作成:

```powershell
pnpm exec wrangler r2 bucket create alco-app-photos-dev
```

0-04 で書く `wrangler.jsonc` の形（値はダミー。トップレベルに D1/R2 を置かない）:

```jsonc
{
  "name": "alco-app",
  "env": {
    "dev": {
      "name": "alco-app-dev",
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "alco-app-dev",
          "database_id": "<dashboard-or-cli-output>",
          "migrations_dir": "src/db/migrations"
        }
      ],
      "r2_buckets": [
        {
          "binding": "PHOTOS",
          "bucket_name": "alco-app-photos-dev"
        }
      ]
    }
  }
}
```

ローカル起動・デプロイは `wrangler dev --env dev` / `wrangler deploy --env dev`。Phase 7 で `env.production` を追加する。

4. 公開アクセスを有効にしない。Workers からのバインディングのみ。
5. 作成確認:

```powershell
pnpm exec wrangler d1 list
pnpm exec wrangler r2 bucket list
```

## 7. 仕様詳細

[spec/02-tech-stack.md](../../spec/02-tech-stack.md) の構成:

- 1 Worker が SPA と `/api/*` を配信
- D1: ユーザー・記録データ
- R2: 写真。無料枠 10GB、リサイズ済み想定

バインディング名（**FIX**、以降のコードと揃える）:

| リソース | binding  | 用途                  |
| -------- | -------- | --------------------- |
| D1       | `DB`     | Drizzle / Better Auth |
| R2       | `PHOTOS` | ボトル・ノート写真    |

環境名（**FIX**）: Phase 0 から wrangler の `env.dev` を使う。トップレベル（デフォルト env）を dev 扱いにしない。Phase 7 で `env.production` を追加する。コマンドは `--env dev` を明示する。

## 8. 受け入れ条件

- [x] Cloudflare にログインできる
- [x] dev D1 が存在する
- [x] dev R2 が存在し、パブリックアクセスがオフ
- [x] バインディング名がドキュメントか wrangler 設定に書かれている
- [x] シークレット・API トークンが git に含まれない
- [x] 本番リソースを誤って作っていない（名前に `prod` を付けない）

## 9. セキュリティ観点

- R2 は非公開。公開バケット + 推測可能なキーは禁止（[.cursor/rules/security.mdc](../../.cursor/rules/security.mdc)）
- `wrangler.jsonc` に secret を書かない。`BETTER_AUTH_SECRET` 等は `wrangler secret` / `.dev.vars`
- アカウント API トークンをリポジトリに置かない。CI 用は GitHub Secrets（0-07 / Phase 7）

## 10. 関連ファイル / 関連spec

- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)
- 次: [04-hello-world-scaffold.md](04-hello-world-scaffold.md)
- 利用: Phase 2-01（D1 マイグレーション）、Phase 4-04（R2 アップロード）

## 11. リスク・注意点

- ダッシュボードで R2 を public にしてしまうと Phase 4 の認可が無意味になる
- database_id を間違えると別 DB をマイグレーションする
- 無料枠の別アカウントを本番と分けるかは Phase 7 の判断。dev と prod を同じアカウントの別リソースにするのが通常
