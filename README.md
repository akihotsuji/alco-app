# alco-app

お酒の記録に特化したスマートフォン向け Web アプリ（PWA）。仕様は [spec/](spec/) を参照。

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

Cloudflare の開発環境は wrangler の **`env.dev`**（トップレベルを dev 扱いにしない）。詳細は [spec/02-tech-stack.md](spec/02-tech-stack.md)。

| リソース | 名前 | binding |
|---|---|---|
| D1 | `alco-app-dev` | `DB` |
| R2 | `alco-app-photos-dev`（非公開） | `PHOTOS` |

ID は `wrangler.jsonc` のみに書く。本番（`env.production`）は Phase 7。

## 起動

```powershell
pnpm install
pnpm dev
```

日常開発は **`pnpm dev`（Vite + Cloudflare Vite プラグイン）**。プラグインが workerd 上で Hono と SPA を動かすため、Vite と wrangler を同時起動しない。

ブラウザで確認する:

- `/` … SPA の Hello World（「alco-app」）
- `/api/health` … `{ "ok": true }`（公開エンドポイント。仕様は [spec/features/health.md](spec/features/health.md)）

Phase 0 DoD の wrangler 単体確認（先にビルドが必要）:

```powershell
pnpm build
pnpm exec wrangler dev --env dev
```

デプロイ（dev）は Phase 3。コマンドは `wrangler deploy --env dev`。

## 品質チェック

```powershell
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm audit --audit-level=high
```

- `typecheck` … TypeScript strict（`tsc --noEmit`）
- `lint` … Biome の lint / format チェック（書き込みなし）
- `format` … Biome で整形してから再チェック
- `test` … Vitest を非インタラクティブ実行（`vitest run`。CI もこれを呼ぶ）。監視は `pnpm test:watch`
- `audit`（ローカル） … `pnpm audit --audit-level=high`。npm の audit API がタイムアウトすることがある
- `audit`（CI） … OSV-Scanner で `pnpm-lock.yaml` を検査。既知脆弱性があれば失敗

Workers の `Env` 型は `worker-configuration.d.ts`（`wrangler types --env dev`）。`wrangler.jsonc` を変えたら `pnpm cf-typegen` を再実行してコミットする。

## CI

PR と `main` への push で GitHub Actions（`.github/workflows/ci.yml`）が次を実行する。デプロイはしない。

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
# 依存監査は OSV-Scanner（npm audit API は使わない）
```

lockfile が `package.json` と食い違うと `--frozen-lockfile` で失敗する。Cloudflare トークン等のシークレットは参照しない。

## ブランチ運用

`main` へは直接 push しない。作業ブランチは切る直前に `git fetch origin main` し、`git checkout -b feature/<内容> origin/main`（または `fix/`）で **リモートの最新 `main` 先端から切る**。PR 経由でのみマージする。マージ方式は merge / squash / rebase いずれも可。CI は回すが、ruleset の必須チェックにはしない。

保護は GitHub の Repository ruleset `protect-main`（[`.github/rulesets/protect-main.json`](.github/rulesets/protect-main.json)）。bypass なし。force push と `main` の削除を禁止する。classic branch protection は使わない。

適用と private 化はリポジトリ管理者が行う（エージェントのトークンでは 403）。

```powershell
gh repo edit akihotsuji/alco-app --visibility private --accept-visibility-change-consequences
gh api --method POST repos/akihotsuji/alco-app/rulesets --input .github/rulesets/protect-main.json
```

詳細は [roadmap/phase-00-project-foundation/08-branch-protection.md](roadmap/phase-00-project-foundation/08-branch-protection.md)。
