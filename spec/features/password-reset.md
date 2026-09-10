# 公開登録の確認・パスワードリセット（8-03）

実装: Phase 8-03。画面は [screen-designs/01-auth.md](../screen-designs/01-auth.md) の `auth-forgot-password` / `auth-reset-password`。手順は [roadmap/phase-08-public-launch/03-open-signup-password-reset.md](../../roadmap/phase-08-public-launch/03-open-signup-password-reset.md)。認証の正本は [auth.md](auth.md)。

- 状態: **実装**（2026-09-10）。Resend のドメイン認証と API キー投入はオーナー
- 招待制は **採用していない**（解除作業は無い）

---

## 1. 目的

一般公開に耐える新規登録（招待コードなし）を確認し、パスワードを **メールのリンク** で再設定できるようにする。メール送信基盤を初めて入れる。トークン処理は **Better Auth 標準だけ**。自前トークンは作らない。

---

## 2. 対象 / 対象外

**対象**

- 招待コードなしのメール＋パスワード登録が仕様どおり動くことの確認
- Better Auth の `requestPasswordReset` / `resetPassword`
- Resend によるリセットメール（Workers から HTTP。SMTP は使わない）
- リセット UI（`/forgot-password` / `/reset-password`）
- 未登録メールへの要求も同じ応答（列挙防止）
- テストはメールをモック。トークンを git に置かない

**対象外**

- 招待フラグ / コードの削除（存在しない）
- メールアドレス検証（マジックリンク必須化）
- ログイン中のパスワード変更（設定画面。将来）
- メーリングリスト
- Cloudflare Email Service（Workers **有料**プラン。本アプリは無料枠）
- アプリ全体の WAF / Turnstile（8-05）

---

## 3. 決定（8-03。ロードマップの要確認を落とす）

| 項目 | 決定 | 根拠 |
|---|---|---|
| 招待 | **何もしない**。検索しても登録クローズフラグは無い | 2026-08-13 FIX |
| トークン | Better Auth の `verification`（`reset-password:` + 24 文字 ID）。自前テーブル・自前乱数は置かない | security 規約。2-01 の Auth テーブルを流用 |
| 有効期限 | **3600 秒（1 時間）**。`resetPasswordTokenExpiresIn` を明示 | Better Auth 既定。spec に書く |
| セッション | 再設定成功で **全セッション失効**（`revokeSessionsOnPasswordReset: true`） | 奪取済み Cookie を残さない |
| 列挙 | 登録の有無で HTTP 状態・本文を変えない。未登録でも 200 | Better Auth がダミー処理してから同じ JSON |
| 送信 | **Resend** REST（`https://api.resend.com/emails`）。`resend` npm は足さない（`fetch`） | Workers から SMTP 不可。公式チュートリアルあり。無料 100 通/日・3000 通/月 |
| FROM | wrangler `vars` の `EMAIL_FROM`（秘密ではない）。本番は `酒のしおり <noreply@sake-shiori.com>` | 独自ドメイン（7-06）。SPF/DKIM は Resend のドメイン認証 |
| 秘密 | `RESEND_API_KEY` は `.dev.vars` / wrangler secret。未設定なら送らない（CI・ローカル） | [secrets.md](../secrets.md) |
| ログ | リセット URL・トークン・メール本文を出さない。失敗は `reset email send failed` だけ | security 規約 |
| 公開 API | **増やさない**。`/api/auth/*` の公式ルートだけ | [api-design.md](../api-design.md) 2.3 |
| レート制限 | Better Auth 既定（`/request-password-reset` は 60 秒 3 回）。8-05 の WAF は別タスク | メール爆撃の最低限 |
| 文面 | テキストのみ。飲酒を勧める文言は置かない | [character.md](../character.md) |

---

## 4. プロバイダ選定

| 候補 | 採用 | 理由 |
|---|---|---|
| **Resend** | **採用** | Workers から HTTPS。無料枠が個人〜初期公開に足りる。ドメイン認証で SPF/DKIM。依存パッケージを増やさない |
| Cloudflare Email Service | 不採用 | 2026 時点で Workers **有料**プラン。無料枠運用と両立しない |
| SES / 自前 SMTP | 不採用 | AWS アカウント増。Workers から SMTP 不可 |

コスト: Resend Free は 1 日 100 通・月 3000 通。パスワード再設定だけなら余裕。超過したら有料枠か 8-06 で見直す。

---

## 5. フロー

1. ログインの「パスワードを忘れた」→ `/forgot-password`
2. メールを送る → `POST /api/auth/request-password-reset`（`redirectTo: /reset-password`）
3. 登録があるときだけ Better Auth が `verification` を作り、`sendResetPassword` を呼ぶ。未登録でも同じ 200
4. メールのリンクは `{origin}/api/auth/reset-password/{token}?callbackURL=...`（Better Auth の callback）。クリックで `/reset-password?token=` へ 302
5. 画面はトークンをメモリに移し、アドレスバーから query を消す（履歴・Referrer。CSP は既に `no-referrer`）
6. 新しいパスワードを送る → `POST /api/auth/reset-password`
7. 成功したら `/login?reset=1`。全セッションは失効済みなので再ログイン

リンク切れ・期限切れ・再利用は同じ無効画面。トークンの正否を文面で分けない。

---

## 6. メール

| 項目 | 内容 |
|---|---|
| 件名 | パスワードの再設定 |
| 本文 | 酒のしおりの再設定であること、**1 時間以内**、リンク 1 本、心当たりがなければ無視、リンクを他人に教えない |
| 形式 | `text` のみ（HTML なし） |
| リンク | Better Auth が渡す `url` だけ。トークンを本文に二重掲載しない |
| 送信失敗 | メーラーは投げない（列挙になる 500 を避ける）。ログは汎用 1 行 |

`RESEND_API_KEY` が無い環境（CI・キー未投入の local）は送らず、テストは注入したモックが `url` を受け取る。

---

## 7. 画面と遷移

正本は [01-auth.md](../screen-designs/01-auth.md)。

| ルート | 認証 | 内容 |
|---|---|---|
| `/forgot-password` | なし（ログイン中でも表示） | メール入力。完了文は登録の有無で変えない |
| `/reset-password` | なし（メールのリンクをログイン中でも使える） | 新パスワード＋確認。トークン無しは無効 |
| `/login` | ゲストのみ | L7「パスワードを忘れた」。`?reset=1` で完了文 |

`GuestOnly` に入れない（`/terms` と同じ）。ログイン中にメールリンクを踏んでも `/` へ飛ばさない。

---

## 8. シークレットとオーナー作業

値は書かない。

1. Resend アカウントを作り、`sake-shiori.com` を認証する（DNS の SPF/DKIM）
2. `pnpm exec wrangler secret put RESEND_API_KEY --env dev`
3. `pnpm exec wrangler secret put RESEND_API_KEY --env production`
4. `EMAIL_FROM` は wrangler `vars`（両 env）。差し替えは vars だけ

ローカル実送信は `.dev.vars` の `RESEND_API_KEY`（gitignore）。無くてもアプリは起動する。

---

## 9. テスト

- 未登録メールと登録済みメールの `request-password-reset` は同じ status / 本文
- 登録済みだけメーラーが 1 回呼ばれる。`url` は `http(s):` でトークンを含む
- トークンで再設定すると旧パスワードは失敗、新パスワードでログインできる
- 不正・再利用トークンは失敗。応答にトークンを出さない
- メーラーのログ引数に URL / トークン / API キーが無い
- サインアップに招待コードが無く、無しで登録できる
- `RESEND_API_KEY` が git に無い

---

## 10. 関連

- [auth.md](auth.md)
- [legal.md](../legal.md) / [legal.md](legal.md)（Resend を委託先に追加）
- [secrets.md](../secrets.md)
- [api-design.md](../api-design.md) 2.3
- [data-model.md](../data-model.md) `verification`
- [age-verification.md](age-verification.md)（登録後は `/age` のまま）
