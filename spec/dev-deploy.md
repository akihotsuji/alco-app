# dev 環境デプロイ（3-07）

飲酒記録が使える状態を Cloudflare の **dev Workers** に載せる手順。本番分離と CI 自動デプロイは Phase 7。後で [operations.md](operations.md)（Phase 7）へ統合する。

## 前提

- 3-02〜3-06 が main に入っている
- 0-03 の D1 `alco-app-dev` / R2 `alco-app-photos-dev`、Worker 名 `alco-app-dev`
- デプロイ権限はオーナーのマシンまたは GitHub Secrets の `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。**値をチャットに出さない**

## コマンド

環境は `env.dev`。必ず `--env dev` を付ける。

```powershell
pnpm exec wrangler d1 migrations apply alco-app-dev --remote --env dev
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env dev
pnpm exec wrangler deploy --env dev
```

- `BETTER_AUTH_SECRET` は `.dev.vars` と同じく `openssl rand -hex 32` で作る。ドキュメントにはキー名だけ書く
- `BETTER_AUTH_URL` は省略可（未設定ならリクエストの origin）。本番 URL を dev に書かない
- デプロイ成果物の workers.dev URL は **公開しない**（招待制は採用していない）
- workers.dev のアカウントサブドメインは Cloudflare ダッシュボードの設定。リポジトリとこのファイルには書かない

初回デプロイは **2026-09-06** にオーナーが上記 3 コマンドを実行済み。以降の更新も同じコマンド（secret は入っているので `secret put` は不要。migrate は差分があるときだけ）。

## デプロイ後

1. workers.dev URL を実機 Safari / Chrome で開く
2. サインアップ（招待なし。メール＋パスワード）
3. マイドリンクを 1 つ作り、今夜から使う

## 失敗時のログ

`pnpm exec wrangler tail --env dev` で Workers の実行ログを見る。サーバーはメソッドとパスだけを出す実装なので、Cookie・セッショントークン・パスワードがログに出ないことを確認する。本文やクエリを足して調べない。

## 了解事項

- バックアップはまだ無い（Phase 7-04）。ドッグフード中のデータ消失リスクをオーナーが了解する
- スキーマ変更はリモート D1 へ forward migration で入れる。ローカルとリモートの差分に注意する
- 無料枠のデプロイ回数を浪費しない
