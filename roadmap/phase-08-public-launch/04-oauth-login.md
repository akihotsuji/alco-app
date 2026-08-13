# 8-04 OAuthログイン（Google等）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 8 一般公開準備 |
| ステータス | **未着手** |
| 要件 | v1.x Google 等の OAuth |
| ソース | Phase 8 OAuthログイン |

## 1. 概要

Better Auth の OAuth プロバイダを足す。独自 OAuth 実装はしない。メール+パスワードは残す。

## 2. 前提条件

- 8-03 のメール（アカウントリンクに必要になりうる）
- 独自ドメイン（リダイレクト URI。workers.dev でも可能な場合あり。**要確認**）
- Google Cloud コンソール等のクライアント ID/Secret（secret は wrangler）

## 3. スコープ

**対象**

- Google を第一候補（「等」なので追加は **要確認**）
- ログイン画面のボタン
- 既存メールアカウントとのリンク方針
- テスト（モックまたは staging クライアント）

**対象外**

- Apple 必須（PWA ではストアレス。後回し可）
- ソーシャルプロフィールの公開

## 4. 成果物

- Auth 設定
- UI
- spec 更新（公開エンドポイント `/api/auth/*` のプロバイダ増）
- コールバック URL 一覧（secret なし）

## 5. 細分化タスク

1. プロバイダ決定
2. コンソールでクライアント作成（オーナー。リダイレクトを正確に）
3. Better Auth social 設定
4. アカウント衝突（同じメールのパスワードユーザー）方針。**要確認**
5. UI とエラー
6. 監査（state CSRF はライブラリに任せる）

## 6. 手順

公式の Better Auth Google プロバイダ手順に従う。

```powershell
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

CLIENT_ID は公開でもよいが、git に無理に増やさず env でも可。

ブランチ: `feature/oauth-google`

## 7. 仕様詳細

- ボタン「Google で続行」
- 失敗時は汎用エラー
- 年齢確認: OAuth 後に未確認なら 8-02 へ
- ログアウトは既存

## 8. 受け入れ条件

- [ ] Google でログインできる
- [ ] 自前 OAuth コードがない
- [ ] secret が git に無い
- [ ] 衝突方針が spec にある
- [ ] テストまたは手動手順が release-checklist 系にある
- [ ] 監査

## 9. セキュリティ観点

- redirect URI 完全一致
- Client secret をクライアントバンドルしない
- `state` / PKCE を無効化しない
- プロフィール画像 URL をそのまま `href` にしない場合のスキーム検証

## 10. 関連ファイル / 関連spec

- [spec/01-requirements.md](../../spec/01-requirements.md) 1.1
- [spec/02-tech-stack.md](../../spec/02-tech-stack.md) Better Auth
- [03-open-signup-password-reset.md](03-open-signup-password-reset.md)

## 11. リスク・注意点

- 開発と本番で Google クライアントを分ける
- メール未検証 Google アカウント
- 同意画面のアプリ名が alco-app 仮称のまま
