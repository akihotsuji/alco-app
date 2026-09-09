# CI: タグまたは承認で Cloudflare `env.production` へデプロイ

Phase 7-02 の本番側。dev 自動デプロイは先行済み（[dev-deploy-ci.md](dev-deploy-ci.md)）。

- 状態: **7-02 ワークフロー済み**（2026-09-09）。GitHub Environment `production` の必須レビューア設定と初回デプロイはオーナー

---

## 1. 目的

`main` へマージしただけでは本番は変わらない。タグ `vX.Y.Z` または `main` からの手動実行と、GitHub Environment `production` の承認があるときだけ `alco-app-prod` を更新する。

---

## 2. 対象 / 対象外

**対象**

- `.github/workflows/deploy-prod.yml`
- タグ `vX.Y.Z`（例 `v1.0.0`）
- `workflow_dispatch`（ref は `main` のみ）
- デプロイ前の CI 成功確認、`CLOUDFLARE_ENV=production pnpm build`、本番 D1 migrate、`wrangler deploy --env production`
- 公開 Actions ログから `workers.dev` URL を除去する

**対象外**

- `main` マージでの本番自動デプロイ
- PR / Preview デプロイ
- `BETTER_AUTH_SECRET` の投入（Worker の wrangler secret。GitHub には置かない。[secrets.md](../secrets.md)）
- Git の長期ブランチ `dev`
- 独自ドメインのゾーン作成そのもの（購入はオーナー。設定は [custom-domain.md](custom-domain.md)）

---

## 3. 起動条件

| 起動 | デプロイするか |
|---|---|
| タグ `vX.Y.Z` の push | する。Environment `production` の承認後。対象 SHA はタグの commit |
| `workflow_dispatch` で `main` | する。Environment `production` の承認後。対象は `main` の HEAD |
| `workflow_dispatch` で `main` 以外 | しない |
| `main` への push | しない（dev だけ [deploy-dev.yml](../../.github/workflows/deploy-dev.yml)） |
| PR / `pull_request_target` | 起動しない |
| その commit の `CI` が未成功 | しない |

`.github/workflows/ci.yml` は検証のみのまま。

---

## 4. デプロイ手順（CI 内）

環境は必ず `--env production`。素の `wrangler deploy` は禁止。

1. 対象 commit を checkout
2. 同じ SHA でワークフロー `CI` が `success` であることを確認（失敗ならデプロイしない）
3. `pnpm install --frozen-lockfile`
4. `CLOUDFLARE_ENV=production pnpm build`（Vite プラグインが `env.production` 向けに `dist/` を作る。未設定だと `dev` になり、`wrangler deploy --env production` が拒否する）
5. `pnpm exec wrangler d1 migrations apply alco-app-prod --remote --env production`（失敗したらデプロイしない）
6. `pnpm exec wrangler deploy --env production`（既存の wrangler secret は消さない）

認証は GitHub Secrets の名前だけを使う。値はログに出さない。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

OIDC は公式の GitHub Actions / wrangler-action でも当面 API トークンが正（Workers Builds も API token）。dev と同じキーを使う。

---

## 5. オーナーが先にすること

### GitHub Environment `production`

スマホの GitHub でも可。Settings → Environments → New environment。

| 項目 | 値 |
|---|---|
| 名前 | `production` |
| Required reviewers | オーナー（自分） |
| Wait timer | なし |
| Deployment branches | 任意。ワークフロー側でタグと `main` に制限する |

必須レビューアが無いと、タグ push だけで本番が変わる。初回デプロイの前に入れる。

### GitHub Secrets

dev デプロイと同じ `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。権限は [dev-deploy-ci.md](dev-deploy-ci.md)。Environment 専用シークレットは作らない（リポジトリ Secrets を使う）。

### 本番 Auth secret

投入済み（7-03。Worker `alco-app-prod`）。デプロイは消さない。

---

## 6. 初回デプロイのやり方（スマホ可）

ワークフローをマージしたあと、まだ本番アプリは載っていない（secret 用の空 Worker だけ）。

1. Environment `production` の必須レビューアを入れる
2. Actions → **Deploy prod** → Run workflow → ブランチ `main`
3. Environment の承認を求められたら Approve
4. ジョブが migrate → deploy する
5. ログに `workers.dev` URL が残っていないこと（`[redacted-url]`）

タグで上げるとき（PC または後続）:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

同じ Environment 承認が要る。

---

## 7. テスト

- `src/ci/deploy-prod-workflow.test.ts`: 起動条件、`CLOUDFLARE_ENV=production` で build、`--env production`、migrate が deploy より前、CI 成功確認、secret の echo 禁止、PR から起動しない
- `src/ci/require-ci-success.test.ts`: `CI` 成功以外は拒否

---

## 関連

- [dev-deploy-ci.md](dev-deploy-ci.md)
- [production-env.md](production-env.md)
- [secrets.md](../secrets.md)
- [02-deploy-pipeline.md](../../roadmap/phase-07-production-release/02-deploy-pipeline.md)
