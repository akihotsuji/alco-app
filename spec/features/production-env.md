# 本番環境リソース（7-01）

実装: Phase 7-01。手順は [01-prod-resources.md](../../roadmap/phase-07-production-release/01-prod-resources.md)。環境表の要約は [02-tech-stack.md](../02-tech-stack.md)「環境（Cloudflare）」。

- 状態: **7-01 済み**（2026-09-09。本番 Worker のデプロイ・migrate・シークレット投入はしない）

---

## 1. 目的

wrangler の **`env.production`** で、dev とデータを混ぜない本番 Worker / D1 / R2 を指す。初回はリソースと設定だけ用意し、デプロイは 7-02 以降。

---

## 2. 対象 / 対象外

**対象**

- 本番 D1 `alco-app-prod` と本番 R2 `alco-app-photos-prod`（非公開）
- `wrangler.jsonc` の `env.production`（binding は dev と同じ `DB` / `PHOTOS` / `AI`）
- 環境一覧（本ファイル・[02-tech-stack.md](../02-tech-stack.md)・README）

**対象外**

- 本番 Worker のデプロイ（`wrangler deploy --env production`）
- 本番 D1 への migrate
- `BETTER_AUTH_SECRET` などシークレットの投入（手順は [secrets.md](../secrets.md)）
- GitHub 本番デプロイパイプライン（7-02）
- 独自ドメイン（7-06）
- シークレット値・アカウント ID・`workers.dev` URL の文書化（禁止）

---

## 3. 環境一覧

ID・アカウント情報はここに書かない。`database_id` は `wrangler.jsonc` のみ。

| 項目 | dev（`env.dev`） | 本番（`env.production`） |
|---|---|---|
| コマンド | `--env dev` | `--env production` |
| Worker 名 | `alco-app-dev` | `alco-app-prod` |
| D1 | `alco-app-dev`（binding `DB`） | `alco-app-prod`（binding `DB`） |
| R2 | `alco-app-photos-dev`（binding `PHOTOS`、非公開） | `alco-app-photos-prod`（binding `PHOTOS`、非公開） |
| Workers AI | binding `AI` | binding `AI`（同じ名前） |
| Cron | `0 18 * * *`（JST 3:00） | 同じ |
| アカウント | 同じ Cloudflare アカウントの別リソース（2026-09-09） | 同左 |

トップレベル（デフォルト env）の Worker 名は `alco-app`。D1 / R2 は置かない。無引数の `wrangler deploy` は本番も dev も向かない。

コードからは引き続き `env.DB` / `env.PHOTOS` / `env.AI` で参照する。

---

## 4. 分離の定義

- 別 D1（同じ `database_id` を 2 env から指さない）
- 別 R2
- 別 Worker 名
- 別 `BETTER_AUTH_SECRET`（置き場は [secrets.md](../secrets.md)。7-01 では入れない）
- 別 Cookie ドメイン（カスタムドメインは 7-06）

---

## 5. コマンド

日常開発は変わらない（`pnpm dev` は内部で `CLOUDFLARE_ENV=dev`）。

```powershell
pnpm exec wrangler deploy --env dev
pnpm exec wrangler deploy --env production
```

本番の migrate / secret / deploy は 7-02 または初回リリース。本タスクでは実行しない。

---

## 6. R2 非公開

作成時に公開アクセス（r2.dev カスタムドメイン含む）を有効にしない。配信は認可付きの `GET /api/photos/:id/content` のみ（[photos.md](photos.md)）。

ダッシュボードでの最終確認はオーナーが行う。

---

## 7. テスト

`src/ci/wrangler-env.test.ts` が `wrangler.jsonc` を読み、次を固定する。

- `env.dev` と `env.production` の Worker / D1 / R2 名が違う
- トップレベルに D1 / R2 が無い
- 設定に secret 値のキーが無い

---

## 関連

- [02-tech-stack.md](../02-tech-stack.md) 環境
- [dev-deploy-ci.md](dev-deploy-ci.md)（main → `env.dev`）
- [02-deploy-pipeline.md](../../roadmap/phase-07-production-release/02-deploy-pipeline.md)
