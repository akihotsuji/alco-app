# 2-02 Better Auth導入

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **完了** |
| 要件 | [spec/01-requirements.md](../../spec/01-requirements.md) 1.1 メール＋パスワード |
| ソース | Phase 2「サインアップ/ログイン/ログアウト、セッション管理（招待制は採用しない）」

## 1. 概要

Better Auth の標準機能で認証する。独自 JWT や自前パスワードハッシュは禁止。**招待制は採用しない**（2026-08-13 確定）。

## 2. 前提条件

- 2-01 の `0000_init` に Auth 4 テーブル（`user` / `session` / `account` / `verification`）とアプリ 6 テーブルがある
- Auth スキーマは 2-01 の CLI 生成物を正とする（`issuer` / `rate_limit` は足さない）
- `BETTER_AUTH_SECRET` を `.dev.vars` に置く（gitignore 済み）
- 公開エンドポイント `/api/auth/*` を api-design に明記済みであること

## 3. スコープ

**対象**

- サインアップ、ログイン、ログアウト
- セッション Cookie（httpOnly / secure / sameSite）
- ログイン試行のレート制限（Better Auth 標準。`rate_limit` テーブルは使わずメモリ）
- クライアントのログイン/サインアップ画面（最低限）

**対象外**

- 招待コード・登録クローズフラグ（採用しない）

**対象外**

- OAuth（Phase 8-04）
- パスワードリセットメール（Phase 8-03）
- プロフィール編集の本格 UI

## 4. 成果物

- サーバー: Better Auth handler のマウント
- クライアント: ログイン/サインアップ/ログアウト
- `.dev.vars.example`（値はダミー。`BETTER_AUTH_SECRET=` のキー名のみ）

招待制用の環境変数は作らない。

## 5. 細分化タスク

1. Better Auth + D1 + Drizzle + Hono の公式手順で導入する（招待制は入れない）
2. Cookie 属性を production 想定で設定する（local は secure の例外が必要か確認）
3. 画面 2 枚（login/signup）とログアウト
4. 未ログインでホームに行けないことを手動確認
5. テストは 2-07 でも可。本 PR で最低 1 本あるとよい

## 6. 手順

1. 公式ドキュメントの Hono / Drizzle / D1 組み合わせに従う。パスワード処理を自作しない。

2. シークレット:

```powershell
# 値をチャットに貼らない。ローカルファイルへ
# .dev.vars に BETTER_AUTH_SECRET を設定
```

生成はオーナーまたはエージェントがローカルで `openssl rand -hex 32` 相当。出力を git に含めない。

3. `baseURL` は環境ごとに変える。ハードコードした本番 URL を dev に書かない。

4. 画面はモバイル幅。メール・パスワード・送信。エラーは汎用（「メールまたはパスワードが正しくありません」）。ユーザー列挙を避ける。

5. ブランチ: `feature/better-auth`

## 7. 仕様詳細

### 招待制（2026-08-13 確定: 採用しない）

メール＋パスワードでサインアップできる。招待コードも登録クローズフラグも実装しない。個人利用フェーズでは **アプリ URL を公開しない**。一般公開時のボット対策は Phase 8-05。

Phase 8-03 の「招待制の解除」は発生しない。同タスクはパスワードリセットメールに縮小する。

### セッション

- httpOnly, sameSite=Lax または Strict（**要確認**。Strict は外部リンク戻りで消える）
- secure: 本番 true。wrangler dev の http は公式推奨に従う

### パスワード

- Better Auth のハッシュ設定に任せる
- 最小長は Zod と Auth 設定で一致（例 8 文字。**要確認**）

## 8. 受け入れ条件

- [x] サインアップ → ログイン → ホーム（空）が実機ブラウザでできる（Phase 2 DoD の一部。レイアウトは 2-05）
- [x] ログアウトできる
- [x] Cookie が httpOnly
- [x] 独自トークン実装がない
- [x] 招待制のコード・フラグが無い（方針どおり）
- [x] `.dev.vars` がコミットされていない
- [x] security-audit Critical/High ゼロ

## 9. セキュリティ観点

- 認証は Better Auth のみ
- レート制限をオフにしない
- ログに Cookie / パスワードを出さない
- サインアップは公開エンドポイントになるため、仕様（01-requirements 1.1）に明記済み。URL 非公開運用を守る

## 10. 関連ファイル / 関連spec

- [spec/01-requirements.md](../../spec/01-requirements.md) 1.1
- [../phase-01-design/05-api-design.md](../phase-01-design/05-api-design.md)
- テスト: [07-auth-tests.md](07-auth-tests.md)

## 11. リスク・注意点

- 2-01 の `auth-schema.ts` を手で増やさない。`rateLimit.storage: "database"` は `rate_limit` を生成し、2-01 の 10 テーブル検証が壊れる
- Workers での Better Auth 設定ミス（baseURL、trustedOrigins）
- 招待制を後から足すと Auth 設定と仕様が再び分岐する。必要になったら Phase 8 で別途決める
- メール検証（マジックリンク）を MVP でやるかは **要確認**。個人利用なら検証なしでも可
