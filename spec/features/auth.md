# 認証（メール＋パスワード）

実装: Phase 2-02。画面は [screen-designs/01-auth.md](../screen-designs/01-auth.md)。API 契約は [api-design.md](../api-design.md) 2.2 / 2.3。要件は [01-requirements.md](../01-requirements.md) 1.1。

## 方針

- 認証は **Better Auth のみ**。独自 JWT / パスワードハッシュは作らない
- **招待制は採用しない**（招待コード・登録クローズフラグなし）
- 個人利用ではアプリ URL を公開しない。ボット対策は Phase 8
- メール検証・パスワードリセット・OAuth は MVP 対象外（Phase 8）

## 公開エンドポイント

| 方法 | パス | 認証 | 備考 |
|---|---|---|---|
| * | `/api/auth/*` | Better Auth が処理 | サインアップ / ログイン / ログアウト / セッション |
| GET | `/api/health` | なし | 別契約 |

これ以外の `/api/*` はセッション必須。`GET /api/me` は `{ id, email, name }` のみ返す。

## セッション

- Cookie: **httpOnly / sameSite=Lax / secure（HTTPS のみ）**。DB セッション（Better Auth 標準）。JWT へは移行しない
- 有効期間: **30 日**（`session.expiresIn = 60 * 60 * 24 * 30`）
- 期限更新の間隔: **1 日**（`session.updateAge = 60 * 60 * 24`）。自動延長は有効（`disableSessionRefresh: false`）
- 延長の意味: 毎日定時に足す／期限に 1 日を加算する、ではない。**前回の更新から 1 日以上経過し、まだ期限内のセッションを確認したとき**、その時点から 30 日後へ `expiresAt` と Cookie の `Max-Age` を書き換える。1 日未満の確認では延長しない
- 確認経路: ブラウザは `authClient.useSession()` → `GET /api/auth/get-session`（Better Auth handler が Set-Cookie を返す）。保護 API は認証 MW が `auth.api.getSession({ returnHeaders: true })` し、返った Set-Cookie を Hono 応答へ append する（内部呼び出しのヘッダーは自動では乗らない）
- 期限切れは延長して復活させない。保護 API は 401 `{ "error": "unauthorized" }`。Cookie の失効ヘッダーがあれば転送する
- 既存セッションは設定変更だけでは 30 日に置き換わらない（一括 UPDATE はしない）。次回のセッション確認で延長条件を満たせば、その時点から 30 日になる
- `baseURL` は `BETTER_AUTH_URL`、未設定ならリクエスト origin。本番 URL を dev に書かない
- ログイン試行のレート制限は Better Auth 標準（有効のまま。2-01 スキーマに `rate_limit` が無いためストレージはメモリ）。オフにしない
- クライアントの `redirect` はアプリ内相対パスのみ（`/` 始まり、`//` とスキーム不可）
- **API が 401 を返したら**（期限切れ・別端末での失効）クライアントは `endSession()` でサインアウトし、セッション store が空になった `RequireAuth` が query キャッシュを捨てて `/login?redirect=` へ送る（2-04。[02-tech-stack.md](../02-tech-stack.md) 「クライアントのデータ取得」）。ログアウトも同じ経路。ネットワーク障害や 5xx は期限切れと扱わない

## 画面

| ルート | 内容 |
|---|---|
| `/login` | メール＋パスワード。エラーは「メールまたはパスワードが正しくありません」 |
| `/signup` | 表示名（任意 1〜40）・メール・パスワード（8 文字以上）。既存メールも汎用文 |
| `/` | ログイン後の空ホーム（2-05 の認証後シェル。キャラ `rest`） |
| `/settings` | ログアウト（確認ダイアログ → `endSession`）。`useMe` でメール表示。表示名はインライン編集（`updateUser`）。操作節は触感フィードバック（既定 OFF）と動きを減らす（3-07） |

ログイン済みで `/login` `/signup` に来たら `/`。未ログインで認証後 URL に来たら `/login?redirect=`（`/` のときは `redirect` を付けず `/login`。ログアウト直後の URL を素に保つ）。

## シークレット

- `BETTER_AUTH_SECRET` は `.dev.vars` / `wrangler secret` のみ。値はコード・spec・チャットに書かない
- `.dev.vars.example` はキー名のみ
