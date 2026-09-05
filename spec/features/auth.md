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

- Cookie: **httpOnly / sameSite=Lax / secure（HTTPS のみ）**
- `baseURL` は `BETTER_AUTH_URL`、未設定ならリクエスト origin。本番 URL を dev に書かない
- ログイン試行のレート制限は Better Auth 標準（有効のまま。2-01 スキーマに `rate_limit` が無いためストレージはメモリ）。オフにしない
- クライアントの `redirect` はアプリ内相対パスのみ（`/` 始まり、`//` とスキーム不可）

## 画面

| ルート | 内容 |
|---|---|
| `/login` | メール＋パスワード。エラーは「メールまたはパスワードが正しくありません」 |
| `/signup` | 表示名（任意 1〜40）・メール・パスワード（8 文字以上）。既存メールも汎用文 |
| `/` | ログイン後の空ホーム。ログアウトは 2-05 で設定へ移すまでの仮置き |

ログイン済みで `/login` `/signup` に来たら `/`。未ログインで認証後 URL に来たら `/login?redirect=`。

## シークレット

- `BETTER_AUTH_SECRET` は `.dev.vars` / `wrangler secret` のみ。値はコード・spec・チャットに書かない
- `.dev.vars.example` はキー名のみ
