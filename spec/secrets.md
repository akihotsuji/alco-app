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
- Sentry DSN（7-05 で不採用。将来足す場合もドキュメントに実値を書かない）
- 本番デプロイの実行そのもの（ワークフローは [deploy-prod.md](features/deploy-prod.md)）

---

## 3. インベントリ（キー名のみ）

| キー | local | Workers `env.dev` | Workers `env.production` | GitHub Actions |
|---|---|---|---|---|
| `BETTER_AUTH_SECRET` | `.dev.vars` | wrangler secret | wrangler secret | 置かない |
| `BETTER_AUTH_URL` | 省略可（`.dev.vars`）。未設定ならリクエスト origin | 置かない（本番 URL を書かない） | 省略可。未設定なら `CANONICAL_ORIGIN` | 置かない |
| `ALERT_WEBHOOK_URL` | 省略可（`.dev.vars`）。未設定なら送らない | wrangler secret（任意） | wrangler secret（任意） | 置かない |
| `RESEND_API_KEY` | 省略可（`.dev.vars`）。未設定ならリセットメールは送らない | wrangler secret（8-03。公開時は必須） | wrangler secret（8-03。公開時は必須） | 置かない |
| `FEEDBACK_TO` | 省略可（`.dev.vars`）。未設定ならご意見の通知は送らない | wrangler secret（任意。公開時は推奨） | wrangler secret（任意。公開時は推奨） | 置かない |
| `GOOGLE_CLIENT_ID` | 省略可（`.dev.vars`）。未設定なら Google ログインは失敗する | wrangler secret（8-04。公開時は必須） | wrangler secret（8-04。公開時は必須） | 置かない |
| `GOOGLE_CLIENT_SECRET` | 省略可（`.dev.vars`）。未設定なら Google ログインは失敗する | wrangler secret（8-04。公開時は必須） | wrangler secret（8-04。公開時は必須） | 置かない |
| `TURNSTILE_SECRET_KEY` | 省略可（`.dev.vars`）。サイトキーと両方揃ったときだけ有効 | wrangler secret（8-05。公開時は必須） | wrangler secret（8-05。公開時は必須） | 置かない |
| `CLOUDFLARE_API_TOKEN` | 使わない（`wrangler login`） | — | — | Actions（`deploy-dev.yml` / `deploy-prod.yml` / `backup-d1.yml`） |
| `CLOUDFLARE_ACCOUNT_ID` | 使わない | — | — | Actions（同上） |

- `database_id` は secret ではない。`wrangler.jsonc` のみ（[production-env.md](features/production-env.md)）
- 本番の公開オリジンは `CANONICAL_ORIGIN`（wrangler `vars`。秘密ではない。[custom-domain.md](features/custom-domain.md)）
- リセットメールの From は `EMAIL_FROM`（wrangler `vars`。秘密ではない。8-03。[password-reset.md](features/password-reset.md)）
- Turnstile のサイトキーは `TURNSTILE_SITE_KEY`（wrangler `vars`。公開値。8-05。未投入ならウィジェットも検証も無い。[rate-limit-abuse.md](features/rate-limit-abuse.md)）
- 認識プロファイル（`AI_RECOGNITION_PROFILE` 等）は wrangler `vars`。秘密ではない。Google API キーは増やさない。[ai-recognition.md](features/ai-recognition.md)
- 新規登録の一時停止は `SIGNUPS_CLOSED`（wrangler `vars`。秘密ではない。既定 `"0"`。`"1"` でメール登録と Google 新規を止める。8-06。[usage-monitoring.md](features/usage-monitoring.md)）
- E2E / CI の `BETTER_AUTH_SECRET` はジョブ内で使い捨て生成する。GitHub Secrets にも本番 wrangler secret にもしない（[e2e.md](features/e2e.md)）
- Cloud Agent / 手元の `pnpm dev:vars` も同じ。`.dev.vars` が無いか空のときだけ生成し、既存は上書きしない。値は git に出さない（[local-dev.md](features/local-dev.md)）
- ローカル開発ユーザーのパスワードは `.local-dev-user.json`（gitignore）のみ。固定パスワードをコードに置かない
- アプリコードは `src/server/env.ts` と `src/server/services/error-alert.ts` のキー名だけで読む。値は `.dev.vars` / wrangler secret から入る
- `ALERT_WEBHOOK_URL` は `https:` のみ。トピック名や URL をチャット・spec に書かない（[monitoring.md](features/monitoring.md)）

---

## 4. 投入手順

値は `openssl rand -hex 32` で作る。標準出力をチャット・PR・スクリーンショットに残さない。

### ローカル

```powershell
pnpm dev:vars
# または .dev.vars.example をコピーして BETTER_AUTH_SECRET を自分で書く
# 値は git に含めない。既存の .dev.vars は上書きしない
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

### エラー通知ウェブフック

任意。未設定なら Workers Logs だけが残る。投入後に対象 env をデプロイする。

```powershell
pnpm exec wrangler secret put ALERT_WEBHOOK_URL --env dev
pnpm exec wrangler secret put ALERT_WEBHOOK_URL --env production
```

### パスワードリセット（Resend）

未設定ならアプリは起動するが、再設定メールは送らない。公開前に両 env へ入れる。値はチャットに貼らない。

```powershell
pnpm exec wrangler secret put RESEND_API_KEY --env dev
pnpm exec wrangler secret put RESEND_API_KEY --env production
```

### ご意見・ご要望の宛先

未設定ならアプリは起動し、ご意見は D1 に残るが通知メールは送らない。運営者が受け取るアドレス。値はチャットに貼らない。手順の正本は [feedback.md](features/feedback.md) 8 章。

```powershell
pnpm exec wrangler secret put FEEDBACK_TO --env dev
pnpm exec wrangler secret put FEEDBACK_TO --env production
```

### Google OAuth（8-04）

未設定ならアプリは起動するが、Google ログインは失敗する。公開前に両 env へ入れる。値はチャットに貼らない。dev と本番で別クライアントにする。

```powershell
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env dev
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env dev
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env production
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

### Turnstile（8-05）

サイトキーは公開値（wrangler `vars`）。シークレットだけ wrangler secret。両方揃ったときだけ有効。未設定でもアプリは起動する。公開前に両 env へ入れる。値はチャットに貼らない。

```powershell
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env dev
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env production
```

### GitHub

Settings → Secrets and variables → Actions。キー名は `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` のみ。`deploy-dev.yml` / `deploy-prod.yml` / `backup-d1.yml` が同じ名前を読む。トークン権限は [dev-deploy-ci.md](features/dev-deploy-ci.md) のとおり（Account 全権限は付けない）。

---

## 5. ローテーション

| キー | 手順 | 影響 |
|---|---|---|
| `BETTER_AUTH_SECRET` | 新しい値を生成し、対象 env だけ `wrangler secret put`（local は `.dev.vars` を書き換え） | その環境の既存セッションは無効になる |
| `CLOUDFLARE_API_TOKEN` | Cloudflare でトークンを再発行 → GitHub Secret を更新 → 旧トークンを無効化 | デプロイ CI が新トークンになるまで失敗しうる |
| `ALERT_WEBHOOK_URL` | 新しい HTTPS URL を対象 env だけ `wrangler secret put`（local は `.dev.vars`） | 旧 URL への通知は止まる |
| `RESEND_API_KEY` | 新しいキーを対象 env だけ `wrangler secret put`（local は `.dev.vars`）。Resend 側の旧キーは無効化 | 旧キーでの送信は止まる |
| `FEEDBACK_TO` | 新しい宛先を対象 env だけ `wrangler secret put`（local は `.dev.vars`） | 旧アドレスへのご意見通知は止まる |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud でクライアントを再発行し、対象 env だけ `wrangler secret put`（local は `.dev.vars`）。旧クライアントは無効化 | 旧クライアントでの Google ログインは止まる |
| `TURNSTILE_SECRET_KEY` | 対象 env だけ `wrangler secret put`（local は `.dev.vars`）。サイトキーは wrangler `vars` を合わせて更新 | 片方だけだとボット対策は無効のまま |
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
rg -n "BEGIN PRIVATE|sk_live_|sk_test_|ghp_|re_|BETTER_AUTH_SECRET=|RESEND_API_KEY=|FEEDBACK_TO=|GOOGLE_CLIENT_SECRET=|TURNSTILE_SECRET_KEY=" --glob "!roadmap/**" --glob "!spec/**"
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
- [custom-domain.md](features/custom-domain.md)
- [dev-deploy.md](dev-deploy.md)
- [monitoring.md](features/monitoring.md)
- [.cursor/rules/security.mdc](../.cursor/rules/security.mdc)
