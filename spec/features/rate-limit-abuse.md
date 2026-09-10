# レート制限・不正利用対策（8-05）

実装: Phase 8-05。画面は [screen-designs/01-auth.md](../screen-designs/01-auth.md) の Turnstile 行。手順は [roadmap/phase-08-public-launch/05-rate-limit-abuse.md](../../roadmap/phase-08-public-launch/05-rate-limit-abuse.md)。認証の正本は [auth.md](auth.md)。

- 状態: **実装**（2026-09-10）。Turnstile のウィジェット作成とキー投入はオーナー
- 公開仕様ではボット対策の**存在**だけを書く。閾値の詳細は出さない

---

## 1. 目的

オープン登録後のボット登録・総当たり・写真の量産を抑える。キャプチャは **Cloudflare Turnstile** に留め、独自実装はしない。WAF の数値ルールはダッシュボード（コードに出さない）。Workers 有料の Rate Limiting バインディングは使わない（無料枠）。

---

## 2. 対象 / 対象外

**対象**

- サインアップ / ログイン / パスワード再設定メール / Google 開始（`/sign-in/social`）の Turnstile
- サーバー側の siteverify（クライアント成功を信じない）
- SPA の CSP（Turnstile ドメイン）
- 写真アップロードのユーザー日次上限
- WAF / レート制限ルールの置き場と解除手順（[operations.md](../operations.md)）
- 仕様・PP への「ボット対策がある」旨

**対象外**

- 有料 Bot Management の必須化
- 攻撃者向けの回避解説
- 独自キャプチャ画像
- Workers Rate Limiting バインディング（有料プラン）
- ログイン失敗理由の列挙（Phase 2 と同じ）

---

## 3. 決定（8-05。ロードマップの要確認を落とす）

| 項目 | 決定 | 根拠 |
|---|---|---|
| キャプチャ | **Cloudflare Turnstile**（managed / 常時表示）。invisible は使わない | タスク指定。見えるウィジェットの方が支援技術に載る |
| 検証 | Worker が `siteverify` する。トークンはヘッダー `x-captcha-response`。ボディに載せない | クライアント成功を信じない。Better Auth 公式プラグインと同じヘッダー名 |
| 対象パス | `/sign-up/email` `/sign-in/email` `/request-password-reset` `/sign-in/social` | 公開の登録口。リセット爆撃。OAuth 開始の連打 |
| 対象外パス | ログアウト、セッション、パスワード再設定（トークンあり）、業務 API | 再設定は短命トークン。業務は認証済み |
| キー | サイトキーは公開（wrangler `vars`）。シークレットは wrangler secret。**両方揃ったときだけ有効** | 片方だけだとウィジェットだけ・検証だけになり穴になる |
| 未設定 | ウィジェットも検証も無い。既存の個人利用・CI / E2E（HTTP）は動く | 8-03 の Resend と同じ。公開前にオーナーが投入 |
| 公開 API | **`GET /api/config`** を追加。本文は `{ turnstileSiteKey: string \| null }` だけ | サイトキーは公開値。死活確認 `GET /api/health` の契約は変えない |
| 代替（a11y） | 読込失敗は再表示。確認をスキップする裏道は置かない | ロードマップの要確認。迂回はボット対策を無効化する |
| 閾値の公開 | PP / 画面は「回数の上限がある」まで。数値は本ファイルとコード定数 | タスク「閾値の詳細は出しすぎない」 |
| 写真上限 | ユーザーごと **JST 日**。`photos.created_at` を数える。新テーブルは作らない | 認証済み。IP ヘッダでバイパスできない |
| IP レート | Better Auth メモリ（既存）+ **WAF はダッシュボード**。アプリに IP カウンタテーブルは足さない | Workers のメモリ制限は isolate 単位で弱い。WAF が正。無料枠のルール数はオーナーが確認 |
| IPv6 / NAT | WAF は緩めの値から **ログ（模擬）モード**で始める | 正規ユーザーの誤ブロックを先に見る |
| 失敗文 | ログインは従来の汎用文。Turnstile 未完了は「確認を完了してください」。列挙しない | Phase 2 と同じ |
| 依存 | Turnstile は公式スクリプトのみ。React 用パッケージは足さない | 依存最小 |

写真の日次上限（内部。UI / PP には出さない）: **80 枚 / ユーザー / JST 日**。ノート 6 枚や連写を想定して緩く始めた値。

WAF の初期目安（ダッシュボード。コードに書かない。ログモードから）: `/api/auth*` の POST を IP あたり短時間で上限。全世界ブロックはしない。バイパス IP を広くしない。

---

## 4. フロー

### 4.1 キー未投入（local / CI / 投入前の dev）

1. `GET /api/config` は `{ "turnstileSiteKey": null }`
2. ウィジェットを出さない
3. Auth の before hook は検証しない
4. 既存の登録・E2E はそのまま

### 4.2 キー投入後

1. ログイン / サインアップ / 再設定メールで `GET /api/config` → サイトキー
2. `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` を読み、ボックスを描画（日本語、テーマは `data-theme`）
3. トークンが無いと送信と「Google で続行」は無効
4. 送信時ヘッダー `x-captcha-response`
5. サーバーはシークレットで siteverify。失敗は登録・ログインしない
6. トークンは使い捨て。失敗後はウィジェットをリセット

読込失敗: 「確認の読み込みに失敗しました。時間をおいて再度お試しください」。スキップボタンは置かない。

### 4.3 写真

`POST /api/photos` の直前に、そのユーザーの JST 当日作成数を数える。上限なら 429 `rate_limited`。R2 には書かない。他ユーザーの枚数は見ない。

---

## 5. 公開 API

| 方法 | パス | 認証 | 本文 |
|---|---|---|---|
| GET | `/api/config` | なし | `{ "turnstileSiteKey": string \| null }` |

- サイトキー以外（シークレット、閾値、内部名、AI プロファイル）は出さない
- 未設定・不正なサイトキーは `null`
- 成功契約以外のフィールドを足さない。使用量・枠残は出さない（8-06）
- `GET /api/health` は `{ "ok": true }` のまま

---

## 6. 画面

正本は [01-auth.md](../screen-designs/01-auth.md)。独立ルートは作らない。

| 画面 | 要素 |
|---|---|
| `/login` | パスワードの下、主ボタンの上にウィジェット（キーがあるとき）。Google も同じトークン |
| `/signup` | 規約チェックの下、主ボタンの上。Google も同じ |
| `/forgot-password` | メールの下、送信の上 |
| `/reset-password` | ウィジェットなし（短命トークン） |

---

## 7. CSP

`public/_headers` の SPA CSP に Turnstile だけ足す。`'unsafe-inline'` は足さない。

- `script-src` に `https://challenges.cloudflare.com`
- `frame-src` に `https://challenges.cloudflare.com`（無ければ `default-src 'self'` で iframe が死ぬ）
- `connect-src` に `https://challenges.cloudflare.com`

API 応答の CSP（`default-src 'none'`）は変えない。

---

## 8. シークレットとオーナー作業

値は書かない。正本は [secrets.md](../secrets.md)。

1. Cloudflare ダッシュボードで Turnstile ウィジェットを作る（ホストに `sake-shiori.com` と local）
2. wrangler `vars` に `TURNSTILE_SITE_KEY`（dev / production。公開値）
3. `pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env dev`（production も同様）
4. ローカル実機確認は `.dev.vars`（gitignore）
5. WAF は [operations.md](../operations.md) の場所で **ログモード**から。誤って全世界ブロックしない

未設定でもアプリは起動する。公開前に両 env へ入れる。

---

## 9. テスト

- 検証を有効にしたサインアップは、トークン無しで失敗しユーザーを作らない
- 検証関数が成功を返したトークン付きは登録できる
- クライアント成功だけ（検証失敗）は登録できない
- `GET /api/config` は未認証で 200。シークレットを含まない
- 写真は同一ユーザーが上限を超えると 429。他ユーザーの枚数は数えない。未認証は 401
- siteverify の引数ログにトークン / シークレットが無い
- `TURNSTILE_SECRET_KEY` が git に無い
- CSP に Turnstile ドメインがあり `unsafe-inline` が無い

---

## 10. 関連

- [auth.md](auth.md)
- [photos.md](photos.md)
- [oauth-login.md](oauth-login.md)
- [password-reset.md](password-reset.md)
- [legal.md](../legal.md) / [legal.md](legal.md)
- [secrets.md](../secrets.md)
- [operations.md](../operations.md)
- [api-design.md](../api-design.md) 2.3 / 2.10
