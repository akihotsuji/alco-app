# dev 環境デプロイ（3-07）

飲酒記録が使える状態を Cloudflare の **dev Workers** に載せる手順。**日常の更新は GitHub Actions**（`main` マージ後に `env.dev` へ自動デプロイ）。手動 wrangler はフォールバック。本番分離と本番デプロイは Phase 7。後で [operations.md](operations.md)（Phase 7）へ統合する。

自動デプロイの正本は [features/dev-deploy-ci.md](features/dev-deploy-ci.md)。

## 前提

- 3-02〜3-06 が main に入っている
- 0-03 の D1 `alco-app-dev` / R2 `alco-app-photos-dev`、Worker 名 `alco-app-dev`
- 自動デプロイには GitHub Secrets の `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` が必要（値はチャットに出さない）
- 手動デプロイの権限はオーナーのマシン、またはエージェントが `wrangler login --device` で都度承認を取る。トークン値はチャットに出さない。エージェントの手動デプロイでは GitHub Secrets を使わない

## コマンド

環境は `env.dev`。必ず `--env dev` を付ける。

`wrangler deploy` はソースではなく **`dist/` の成果物**を上げる（`assets.directory` は `dist/client`）。コードを直した・`git pull` したあとは、必ず `pnpm build` してから `deploy` する。ビルドを省略すると前回の古い資産が載る。`package.json` / lockfile が変わった pull なら、ビルドの前に `pnpm install` する。

```powershell
pnpm exec wrangler login --device --browser=false
pnpm install
pnpm build
pnpm exec wrangler d1 migrations apply alco-app-dev --remote --env dev
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env dev
pnpm exec wrangler deploy --env dev
```

- エージェントからデプロイするときは、毎回 `wrangler login --device --browser=false` を先に実行する。表示された URL とコードをオーナーへ渡し、オーナーが [Cloudflare のデバイス認証](https://dash.cloudflare.com/oauth2/device/verify) で入力・承認してから migrate / deploy する。トークンやアカウント ID をチャットで要求しない
- `BETTER_AUTH_SECRET` は `.dev.vars` と同じく `openssl rand -hex 32` で作る。ドキュメントにはキー名だけ書く
- `BETTER_AUTH_URL` は省略可（未設定ならリクエストの origin）。本番 URL を dev に書かない
- デプロイ成果物の workers.dev URL は **公開しない**（招待制は採用していない）
- workers.dev のアカウントサブドメインは Cloudflare ダッシュボードの設定。リポジトリとこのファイルには書かない

初回デプロイは **2026-09-06** にオーナーが migrate / secret / deploy を実行済み。Phase 5 完了版の再デプロイは **2026-09-07**（`e057825`、デバイス認証のあと `pnpm build` と `wrangler deploy --env dev`）。

以降の日常更新は `main` マージで `Deploy dev` ワークフローが `pnpm build`・リモート migrate・`wrangler deploy --env dev` を行う。secret は入っているので `secret put` は不要。シークレット未設定時や CI 障害時だけ、上記の手動コマンドを使う（エージェントは毎回デバイス認証する）。

## デプロイ後

1. workers.dev URL を実機 Safari / Chrome で開く
2. サインアップ（招待なし。メール＋パスワード）
3. マイドリンクを 1 つ作り、今夜から使う

## 失敗時のログ

`pnpm exec wrangler tail --env dev` で Workers の実行ログを見る。サーバーはメソッドとパスだけを出す実装なので、Cookie・セッショントークン・パスワードがログに出ないことを確認する。本文やクエリを足して調べない。

## 了解事項

- D1 の日次バックアップは 7-04（[features/d1-backup.md](features/d1-backup.md)）。dev も同じジョブで export する。写真 R2 の誤削除は別災害
- スキーマ変更はリモート D1 へ forward migration で入れる。ローカルとリモートの差分に注意する
- 無料枠のデプロイ回数を浪費しない
