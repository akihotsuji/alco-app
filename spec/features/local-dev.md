# ローカル開発と Cloud Agent

実装: Cloud Agent 上でも `pnpm dev` 相当が立ち上がり、ブラウザ確認までできること。秘密の値は git に置かない。置き場の正本は [secrets.md](../secrets.md)。

- 状態: **本 PR で追加**
- 認証は [auth.md](auth.md)。E2E の毎回サインアップは [e2e.md](e2e.md)

---

## 1. 目的

オーナーの手元と Cursor Cloud Agent で、同じ手順でローカル Worker を起動する。

| できること | できないこと |
|---|---|
| 使い捨て `BETTER_AUTH_SECRET` を `.dev.vars` に書く | 本番・dev Worker の secret を読む |
| ローカル D1 に migrate する | リモート D1 / R2 を触る |
| メール登録の開発ユーザーをローカル D1 に作る | Google / Turnstile / 実メール送信 |
| Vite（5173）で画面を開く | 本番 URL での確認を必須にしない |

---

## 2. 起動

| 手順 | コマンド | 備考 |
|---|---|---|
| 依存 | `pnpm install` | Cloud Agent の `install` |
| 秘密 | `pnpm dev:vars` | `.dev.vars` が無いか `BETTER_AUTH_SECRET` が空のときだけ生成。既存は上書きしない |
| DB | `pnpm db:migrate:local` | ローカル D1。冪等 |
| アプリ | `pnpm dev` | Vite + Cloudflare プラグイン。`CLOUDFLARE_VITE_FORCE_LOCAL=true` を推奨 |
| ユーザー | `pnpm dev:seed` | health 後。資格情報は `.local-dev-user.json`（gitignore） |

Cloud Agent は `.cursor/environment.json` の `start` で vars + migrate、`terminals` で Vite と `dev:seed --wait` を行う。

死活は `GET http://127.0.0.1:5173/api/health` が 200。

---

## 3. 開発ユーザー

- メールは `local.dev@localhost`。パスワードは実行時生成。値は `.local-dev-user.json` だけに書く
- 年齢確認済み（1990-01-15）。セラーにシルエット 2 本（赤・白）を空なら足す
- チャット・コミット・ログにパスワードを出さない
- 初回ガイドはブラウザの `localStorage`。画面では「今はしない」

固定パスワードや OAuth クライアントを git に置かない。Google ログインの確認は対象外。

---

## 4. 受け入れ

- [ ] `.dev.vars` / `.local-dev-user.json` が git に含まれない
- [ ] `.dev.vars.example` の秘密キーは空のまま
- [ ] `pnpm dev:vars` は既存の `.dev.vars` を壊さない
- [ ] Cloud Agent の start 後、`/api/health` が 200 になり、`.local-dev-user.json` でログインできる
