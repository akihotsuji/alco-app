# シークレット管理（7-03）

値は書かない。キー名と置き場・手順だけを正とする。実装: Phase 7-03。手順書は [03-secret-management.md](../roadmap/phase-07-production-release/03-secret-management.md)。

- 状態: **7-03 済み**（2026-09-09）。本番 `BETTER_AUTH_SECRET` は Worker `alco-app-prod` に投入済み（値は書かない）

---

## 1. 目的

秘密の置き場を一覧し、コード・spec・roadmap・GitHub の Issue / PR に値が無いことを保証する。dev 漏洩が本番セッションを割れないよう、Auth secret は環境ごとに別にする。

---

## 2. 対象 / 対象外

**対象**

- キー名のインベントリと環境ごとの置き場
- 投入・ローテーション・誤コミット時の手順
- `.dev.vars.example` の同期（キー名のみ、値は空）
- 追跡ファイルに秘密値が混入していないことのテスト

**対象外**

- 実際の秘密値（生成も貼り付けもしない）
- 1Password 等の必須化（当面しない）
- Sentry DSN（7-05。公開してよい場合でもドキュメントに実値を書かない）
- 本番デプロイの実行そのもの（ワークフローは [deploy-prod.md](features/deploy-prod.md)）

---

## 3. インベントリ（キー名のみ）

| キー | local | Workers `env.dev` | Workers `env.production` | GitHub Actions |
|---|---|---|---|---|
| `BETTER_AUTH_SECRET` | `.dev.vars` | wrangler secret | wrangler secret | 置かない |
| `BETTER_AUTH_URL` | 省略可（`.dev.vars`）。未設定ならリクエスト origin | 省略可 | 省略可（7-06 まで origin） | 置かない |
| `CLOUDFLARE_API_TOKEN` | 使わない（`wrangler login`） | — | — | Actions（`deploy-dev.yml` / `deploy-prod.yml`） |
| `CLOUDFLARE_ACCOUNT_ID` | 使わない | — | — | Actions（同上） |

- `database_id` は secret ではない。`wrangler.jsonc` のみ（[production-env.md](features/production-env.md)）
- E2E / CI の `BETTER_AUTH_SECRET` はジョブ内で使い捨て生成する。GitHub Secrets にも本番 wrangler secret にもしない（[e2e.md](features/e2e.md)）
- アプリコードは `src/server/env.ts` のキー名だけで読む。値は `.dev.vars` / wrangler secret から入る

---

## 4. 投入手順

値は `openssl rand -hex 32` で作る。標準出力をチャット・PR・スクリーンショットに残さない。

### ローカル

```powershell
copy .dev.vars.example .dev.vars
# .dev.vars の BETTER_AUTH_SECRET に生成値を書く（git に含めない）
```

### Workers dev

投入済み（3-07）。日常の `deploy-dev.yml` / `deploy-prod.yml` は secret を消さない。入れ直すときだけ:

```powershell
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env dev
```

### Workers 本番

**投入済み**（2026-09-09。dev とは別値。値は残していない）。入れ直すときだけ:

```powershell
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
```

Worker 名は `alco-app-prod`。`deploy-prod.yml` のデプロイは secret を消さない。

### GitHub

Settings → Secrets and variables → Actions。キー名は `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` のみ。`deploy-dev.yml` と `deploy-prod.yml` が同じ名前を読む。トークン権限は [dev-deploy-ci.md](features/dev-deploy-ci.md) のとおり（Account 全権限は付けない）。

---

## 5. ローテーション

| キー | 手順 | 影響 |
|---|---|---|
| `BETTER_AUTH_SECRET` | 新しい値を生成し、対象 env だけ `wrangler secret put`（local は `.dev.vars` を書き換え） | その環境の既存セッションは無効になる |
| `CLOUDFLARE_API_TOKEN` | Cloudflare でトークンを再発行 → GitHub Secret を更新 → 旧トークンを無効化 | デプロイ CI が新トークンになるまで失敗しうる |
| `CLOUDFLARE_ACCOUNT_ID` | アカウントを変えない限りローテーションしない | — |

Auth secret は **env 単位**で回す。dev を回しても本番は変えない。

---

## 6. 誤ってコミットした場合

履歴の force push はしない（`protect-main`）。先に秘密を無効化する。

1. 漏れた値をすぐ無効化する（Auth secret なら対象 env をローテーション。API トークンなら Cloudflare で revoke）
2. 追跡から外し、`.gitignore` を確認する（`.dev.vars*` / `.env*`）
3. 新しい値を正規の置き場へ入れる
4. 履歴に残った旧値は無効化済みとして扱う。書き換えはしない

確認コマンド（値は表示されてもチャットに貼らない）:

```powershell
git ls-files "*.dev.vars" ".env"
git log --all --pretty=format: --name-only -- ".dev.vars" ".env" ":!.dev.vars.example" ":!.env.example"
```

---

## 7. リポジトリ検査

```powershell
git ls-files "*.dev.vars" ".env"
rg -n "BEGIN PRIVATE|sk_live_|sk_test_|ghp_|BETTER_AUTH_SECRET=" --glob "!roadmap/**" --glob "!spec/**"
```

ヒットしたら値かどうか目視する。`.dev.vars.example` の空キー、CI の `openssl rand`、テストの短いダミーは可。

---

## 8. テスト

`src/ci/secrets-inventory.test.ts` が次を固定する。

- `.dev.vars` / `.env` が `git ls-files` に無い
- `.dev.vars.example` の `BETTER_AUTH_SECRET` は空。Cloudflare トークンを書かない
- 追跡ファイルに実値らしい代入（長い hex、`BEGIN PRIVATE`、`sk_live_` 等）が無い
- 本ファイルにインベントリのキー名がある（値の代入は無い）

---

## 関連

- [auth.md](features/auth.md)
- [dev-deploy-ci.md](features/dev-deploy-ci.md)
- [production-env.md](features/production-env.md)
- [dev-deploy.md](dev-deploy.md)
- [.cursor/rules/security.mdc](../.cursor/rules/security.mdc)
