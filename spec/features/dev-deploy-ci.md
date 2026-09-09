# CI: main マージで Cloudflare `env.dev` へ自動デプロイ

開発 Phase で 7-02 の「main → dev Worker」だけを先行する。本番（`env.production`、タグ、承認）は Phase 7。

## 目的

`main` にマージしたコミットを、検証（lint / typecheck / test / audit）が通ったあと Cloudflare の **dev Workers**（`alco-app-dev`）へ載せる。オーナーが手元で `wrangler login` しなくても、GitHub のマージだけで開発環境が更新される。

## 対象 / 対象外

**対象**

- `.github/workflows/deploy-dev.yml`
- `main` への push で走った `CI` が成功したとき、その commit を `env.dev` へデプロイ
- GitHub の `workflow_dispatch`（Actions からの手動再デプロイ。スマホの GitHub アプリ可）
- デプロイ前の `pnpm build` とリモート D1 migrate（`alco-app-dev`）
- 公開 Actions ログから `workers.dev` URL を除去する

**対象外**

- 本番 Worker / 本番 D1 / 本番 R2
- `deploy-prod.yml`、タグ `v*`、GitHub Environment `production` の承認
- PR ごとの Preview デプロイ
- `BETTER_AUTH_SECRET` の投入（既存の wrangler secret を使う。GitHub Secrets には置かない）
- Git の長期ブランチ `dev`（後述）

## 起動条件

| 起動 | デプロイするか |
|---|---|
| `CI` が `main` の **push** で成功（`workflow_run`） | する。対象 SHA は成功した CI の `head_sha` |
| `CI` が PR で成功 | しない（`workflow_run.branches: [main]` かつ triggering event が `push` のときだけ） |
| `CI` が失敗 | しない（`conclusion == success` のみ） |
| `workflow_dispatch` | する。選択した ref の HEAD（既定は `main`） |
| `pull_request` / `pull_request_target` | 起動しない |

`.github/workflows/ci.yml` は検証のみのまま。デプロイも Cloudflare シークレットも参照しない。

## デプロイ手順（CI 内）

環境は必ず `--env dev`。素の `wrangler deploy` は禁止（トップレベル Worker 名を向く）。

1. 対象 commit を checkout
2. `pnpm install --frozen-lockfile`
3. `pnpm build`（`wrangler deploy` は `dist/` を上げる）
4. `pnpm exec wrangler d1 migrations apply alco-app-dev --remote --env dev`（差分が無ければ no-op。失敗したらデプロイしない）
5. `pnpm exec wrangler deploy --env dev`

認証は GitHub Secrets の名前だけを使う。値はログに出さない。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

`BETTER_AUTH_SECRET` は Worker 側の wrangler secret。デプロイは secret を消さない。

未設定ならジョブはキー名だけを出して失敗する。トークン値やアカウント ID をチャット・PR・spec に書かない。

## オーナーが先に入れるもの

値は GitHub の Settings → Secrets and variables → Actions にだけ置く。

1. Cloudflare ダッシュボードで API トークンを作る（テンプレート **Edit Cloudflare Workers** を土台にする）
2. 次を足す（Account 全権限は付けない）
   - Account Settings: Read
   - Workers Scripts: Edit
   - Workers R2 Storage: Edit
   - D1: Edit（リモート migrate 用。Workers テンプレだけでは足りないことがある）
3. トークンのスコープは **このアプリのアカウントだけ**
4. GitHub Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を入れる

手動デプロイ（`wrangler login`）は、シークレット未設定時や CI 障害時のフォールバック。正本コマンドは [dev-deploy.md](../dev-deploy.md)。

## ブランチ運用（Git の `dev` ブランチ案）

`dev` ブランチへマージしたら Cloudflare `env.dev`、`dev` を `main` へマージしたら本番、という GitFlow は **今は採用しない**。

理由:

- 当時は本番リソース（`env.production`）が無かった。Git の `dev` を足してもデプロイ先は `alco-app-dev` のままになり、長期ブランチが 1 本増えるだけだった（7-01 で本番 D1 / R2 は追加済み。GitFlow は今も採用しない）
- いまの PR はすべて `main` 向け。ターゲットを `dev` に変えると保護ルールと日常の PR 先が全部変わる
- Phase 7 の決め（[02-deploy-pipeline.md](../../roadmap/phase-07-production-release/02-deploy-pipeline.md)）は **`main` = 最新の良いコード（ドッグフード）**、本番は **タグまたは承認で特定コミットを上げる**。`main` 即本番よりロールバックしやすい

将来 GitFlow にするなら、このワークフローの `branches` を `dev` に変え、本番ワークフローを `main` に足せばよい。そのときは `dev` ブランチ保護と PR の既定ターゲットも同じ変更で直す。

## セキュリティ

- `pull_request_target` を使わない
- PR ではデプロイしない（fork がシークレットを使えないようにする）
- 権限は `contents: read` のみ
- トークン・アカウント ID・`workers.dev` URL をログ・spec・README に書かない
- `ci.yml` にデプロイや Cloudflare シークレットを足さない
- OIDC は Phase 7 で公式推奨を再確認する。本先行実装は API トークン

## テスト

`src/ci/deploy-dev-workflow.test.ts` が YAML を読み、起動条件・`--env dev`・migrate が deploy より前・シークレットの echo 禁止・`ci.yml` にデプロイが無いことを固定する。

`src/ci/redact-wrangler-log.ts` が wrangler 出力の `workers.dev` URL を `[redacted-url]` にする。

## 関連

- [dev-deploy.md](../dev-deploy.md)
- [02-tech-stack.md](../02-tech-stack.md) CI / CD
- [02-deploy-pipeline.md](../../roadmap/phase-07-production-release/02-deploy-pipeline.md)
