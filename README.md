# 酒のしおり

お酒の記録に特化したスマートフォン向け Web アプリ（PWA）。リポジトリ名は `alco-app`。仕様は [spec/](spec/) を参照。

## 開発環境

| ツール | バージョン |
|---|---|
| Node.js | 22（`.node-version` / `engines`） |
| pnpm | 10（`packageManager`: `pnpm@10.11.0`。Corepack 推奨） |
| wrangler | プロジェクトローカル（`pnpm exec wrangler`。グローバル必須にしない） |

```powershell
node -v
pnpm -v
```

pnpm が PATH に無い場合は `corepack enable` のあと `corepack prepare pnpm@10.11.0 --activate`。

## 環境

Cloudflare は wrangler の **`env.dev`** と **`env.production`** で分ける（トップレベルをどちらにもしない）。詳細は [spec/02-tech-stack.md](spec/02-tech-stack.md) と [spec/features/production-env.md](spec/features/production-env.md)。

| wrangler env | リソース | 名前 | binding |
|---|---|---|---|
| `env.dev` | D1 | `alco-app-dev` | `DB` |
| `env.dev` | R2 | `alco-app-photos-dev`（非公開） | `PHOTOS` |
| `env.production` | D1 | `alco-app-prod` | `DB` |
| `env.production` | R2 | `alco-app-photos-prod`（非公開） | `PHOTOS` |
| （CI のみ） | R2 | `alco-app-d1-backups`（非公開。D1 SQL） | なし |

ID は `wrangler.jsonc` のみに書く。シークレットの置き場は [spec/secrets.md](spec/secrets.md)。本番デプロイは 7-02。D1 バックアップは [spec/features/d1-backup.md](spec/features/d1-backup.md)。

## 起動

```powershell
pnpm install
pnpm dev
```

日常開発は **`pnpm dev`（Vite + Cloudflare Vite プラグイン）**。プラグインが workerd 上で Hono と SPA を動かすため、Vite と wrangler を同時起動しない。

ブラウザで確認する:

- `/login` `/signup` … メール＋パスワード（仕様は [spec/features/auth.md](spec/features/auth.md)）
- `/` … ログイン後の空ホーム
- `/api/health` … `{ "ok": true }`（公開エンドポイント。仕様は [spec/features/health.md](spec/features/health.md)）
- `/api/config` … `{ "turnstileSiteKey": string | null }`（公開。サイトキーだけ。仕様は [spec/features/rate-limit-abuse.md](spec/features/rate-limit-abuse.md)）

初回は `.dev.vars.example` をコピーして `.dev.vars` を作り、`BETTER_AUTH_SECRET` を入れる（値は git に含めない。置き場は [spec/secrets.md](spec/secrets.md)）。ローカル D1 へ初回マイグレーション（`0000_init`）を適用する:

```powershell
pnpm db:migrate:local
```

Phase 0 DoD の wrangler 単体確認（先にビルドが必要）:

```powershell
pnpm build
pnpm exec wrangler dev --env dev
```

デプロイ（dev）の日常経路は GitHub Actions（[spec/features/dev-deploy-ci.md](spec/features/dev-deploy-ci.md)）。`main` の CI が成功すると `pnpm build`・リモート D1 migrate・`wrangler deploy --env dev` が走る。手動は [spec/dev-deploy.md](spec/dev-deploy.md)。エージェントから手動デプロイするときは毎回 `wrangler login --device` をオーナーが承認してから同じコマンドを実行する。

## クライアントのデータ取得

画面やコンポーネントで `fetch` を直接書かない。決定の正本は [spec/02-tech-stack.md](spec/02-tech-stack.md) の「クライアントのデータ取得（2-04 FIX）」。

| 置き場 | 内容 |
|---|---|
| `src/client/lib/api.ts` | Hono RPC クライアント `api`（`hc<AppType>("/")`。`AppType` は型のみ import）、`unwrap()`、`ApiClientError` |
| `src/client/lib/query-client.ts` | `createQueryClient()`（staleTime 30s、4xx は再試行しない、401 で `onUnauthorized`） |
| `src/client/lib/query-provider.tsx` | `QueryClientProvider`。`App` の最外 |
| `src/client/lib/query-keys.ts` | `queryKeys`（queryKey はここに集約） |
| `src/client/hooks/` | データ取得 hooks。`use-<resource>.ts` に `xxxQueryOptions()` と `useXxx()` を置く（例 `use-me.ts`） |
| `src/client/auth/end-session.ts` | `endSession()`。ログアウトと API の 401 が共通で通る。`RequireAuth` がキャッシュを捨てて `/login` へ送る |

新しい API を使うときは `hooks/use-<resource>.ts` を足し、`queryFn` / `mutationFn` を `unwrap(api.api.<resource>.$get())` の形で書く。mutation 成功後は `queryKeys.<resource>` を `invalidateQueries` する。

## 品質チェック

```powershell
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm test:e2e
pnpm audit --audit-level=high
```

- `typecheck` … TypeScript strict（`tsc --noEmit`）
- `lint` … Biome の lint / format チェック（書き込みなし）
- `format` … Biome で整形してから再チェック
- `test` … Vitest を非インタラクティブ実行（`vitest run`。CI もこれを呼ぶ）。監視は `pnpm test:watch`
- `test:e2e` … Playwright の主要導線スモーク（仕様は [spec/features/e2e.md](spec/features/e2e.md)）。初回は `pnpm exec playwright install --with-deps chromium`。手順は skill `e2e-testing`
- `audit`（ローカル） … `pnpm audit --audit-level=high`。npm の audit API がタイムアウトすることがある
- `audit`（CI） … OSV-Scanner で `pnpm-lock.yaml` を検査。既知脆弱性があれば失敗

Workers の `Env` 型は `worker-configuration.d.ts`（`wrangler types --env dev`）。`wrangler.jsonc` を変えたら `pnpm cf-typegen` を再実行してコミットする。

## CI

PR と `main` への push で GitHub Actions（`.github/workflows/ci.yml`）が次を実行する。このワークフローはデプロイしない。`main` の CI 成功後は `.github/workflows/deploy-dev.yml` が Cloudflare `env.dev` へ載せる。本番は `.github/workflows/deploy-prod.yml`（タグ `vX.Y.Z` または `main` からの手動実行。Environment `production` の承認後。[spec/features/deploy-prod.md](spec/features/deploy-prod.md)）。

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
# 依存監査は OSV-Scanner（npm audit API は使わない）
# 別ジョブ e2e: 使い捨て BETTER_AUTH_SECRET を作り、Playwright Chromium を実行
```

lockfile が `package.json` と食い違うと `--frozen-lockfile` で失敗する。Cloudflare トークン等のシークレットは参照しない。

## PWA（6-01）

ホーム画面追加とスタンドアロン表示。オフライン記録は対象外。仕様は [spec/features/pwa.md](spec/features/pwa.md)。

確認は **ビルド後**（`pnpm dev` では Service Worker を登録しない）:

```powershell
pnpm build
pnpm exec wrangler dev --env dev
```

Chrome（デスクトップ）:

1. 開いたオリジンで Application → Manifest。`display: standalone`、192 / 512 / maskable がある
2. Application → Service Workers。`sw.js` が登録され、Network で `/api/*` が `(ServiceWorker)` 経由でも **from ServiceWorker cache に API JSON が残らない**（NetworkOnly）
3. Install できること。インストール後はブラウザのタブバーが消え、アプリの下部タブだけになる（二重にならない）

更新: `registerType: autoUpdate` + `skipWaiting`。デプロイ後は次の起動で新 SW が有効。壊れた古い SW が残るときは、そのオリジンの Application → Service Workers で Unregister し、ハード再読み込みする。

実機の確認項目は [spec/qa-devices.md](spec/qa-devices.md)。

### iOS Safari（ホーム画面に追加）

1. Safari で dev の HTTPS URL を開く（[spec/dev-deploy.md](spec/dev-deploy.md)。URL はドキュメントに書かない）
2. 共有ボタン（四角から上矢印）を開く
3. 「ホーム画面に追加」を選ぶ
4. 追加後、ホームのアイコンから起動する。Safari のタブバーが消え、アプリの下部タブだけになる

### Android Chrome（ホーム画面に追加）

1. Chrome で同じ URL を開く
2. メニュー（︙）→「アプリをインストール」または「ホーム画面に追加」
3. インストールバナーが出ればそれを使ってもよい
4. 追加後、ホームのアイコンから起動する。ブラウザの UI が消える

## ブランチ運用

`main` へは直接 push しない。作業ブランチは切る直前に `git fetch origin main` し、`git checkout -b feature/<内容> origin/main`（または `fix/`）で **リモートの最新 `main` 先端から切る**。PR 経由でのみマージする。マージ方式は merge / squash / rebase いずれも可。CI は回すが、ruleset の必須チェックにはしない。

保護は GitHub の Repository ruleset `protect-main`（[`.github/rulesets/protect-main.json`](.github/rulesets/protect-main.json)）。bypass なし。force push と `main` の削除を禁止する。classic branch protection は使わない。

`protect-main`（id `22315799`）は 2026-09-05 に適用済み。可視性は public（Free で ruleset を使うため）。変更はリポジトリ管理者のみ。

詳細は [roadmap/phase-00-project-foundation/08-branch-protection.md](roadmap/phase-00-project-foundation/08-branch-protection.md)。
