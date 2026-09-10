# OAuthログイン（Google）（8-04）

実装: Phase 8-04。画面は [screen-designs/01-auth.md](../screen-designs/01-auth.md) の `auth-login` / `auth-signup`。手順は [roadmap/phase-08-public-launch/04-oauth-login.md](../../roadmap/phase-08-public-launch/04-oauth-login.md)。認証の正本は [auth.md](auth.md)。

- 状態: **実装**（2026-09-10）。Google Cloud のクライアント作成と secret 投入はオーナー
- プロバイダは **Google のみ**。Apple や他社は足さない

---

## 1. 目的

メール＋パスワードに加え、Google アカウントでログイン／新規登録できるようにする。OAuth は **Better Auth 標準だけ**。認可コード・token 交換・`state` / PKCE を自前実装しない。

---

## 2. 対象 / 対象外

**対象**

- Google（第一候補。「等」の追加はしない）
- ログイン／サインアップ上の「Google で続行」
- 既存メール＋パスワードアカウントとの衝突方針
- 新規 Google ユーザーの規約同意（8-01）と年齢確認（8-02）
- テストは Google をモック。実クライアントは git に置かない

**対象外**

- Apple Sign In（PWA・ストアレス。後回し）
- GitHub 等の追加プロバイダ
- ソーシャルプロフィールの公開・Google プロフィール画像の表示
- 設定からの後付けリンク UI（`linkSocial`）
- One Tap / GIS スクリプト
- 独自 OAuth クライアント

---

## 3. 決定（8-04。ロードマップの要確認を落とす）

| 項目 | 決定 | 根拠 |
|---|---|---|
| プロバイダ | **Google のみ** | ロードマップの第一候補。追加は要確認のまま足さない |
| 実装 | Better Auth `socialProviders.google`。自前の token 交換は置かない | security 規約。2-02 の延長 |
| リダイレクト URI | `{baseURL}/api/auth/callback/google`。`baseURL` は既存の `BETTER_AUTH_URL` → `CANONICAL_ORIGIN` → リクエスト origin | 7-06 の本番は `https://sake-shiori.com`。workers.dev をドキュメントに書かない |
| クライアント | **環境ごと**（local / dev / production で別）。ID も Secret も git に増やさない | タスク「開発と本番で分ける」 |
| 新規登録 | `disableImplicitSignUp: true`。ログインのボタンは既存 Google ユーザーだけ。新規はサインアップのボタン（`requestSignUp: true`） | ログインから同意なし登録を防ぐ |
| 衝突 | **暗黙リンクしない**（`disableImplicitLinking: true`、`trustedProviders: []`、`requireLocalEmailVerified: true`）。同じメールのパスワードユーザーは Google で入れない | 未検証メールで先登録して被害者の Google を奪う攻撃を防ぐ |
| 未検証 Google メール | 拒否（`user.validateUserInfo`。`emailVerified !== true`） | メール未検証 Google アカウント |
| 規約同意 | サインアップの既存チェックが必須。`/sign-in/social` で `requestSignUp` のとき `additionalData` を 8-01 と同じスキーマで検証。成功後 `legal_consents` に現行版を残す | チェックをクライアントだけで迂回できない |
| 年齢 | 新規は `newUserCallbackURL` を `/age`（`redirect` があれば引き継ぐ）。既存はこれまでどおり `RequireAgeVerified` | 8-02 |
| 失敗 | 汎用文だけ。Google / Better Auth の `error` クエリは画面に出さずアドレスバーから消す | 存在推測・内部コードの露出を避ける |
| 公開 API | **増やさない**。`/api/auth/*` の公式ルートだけ | [api-design.md](../api-design.md) 2.3 |
| プロフィール画像 | `user.image` に Google の URL を残さない。`GET /api/me` にも出さない | `javascript:` / 外部 URL を `href` にしない。表示もしない |
| `state` / PKCE | 無効化しない。`skipStateCookieCheck` は付けない | タスクの監査項目 |
| トークン保管 | `encryptOAuthTokens: true`。アプリは `account` の token 列を SELECT しない | DB 漏洩時の外部トークン悪用を減らす |

---

## 4. フロー

### 4.1 ログイン（既存 Google）

1. `/login` の「Google で続行」
2. `POST /api/auth/sign-in/social`（`provider: google`。`requestSignUp` なし）
3. Google の同意画面（`prompt: select_account`、PKCE）
4. `{origin}/api/auth/callback/google`
5. 既存の Google `account` があればセッション。未確認なら `/age`
6. 未登録メールなら登録しない。エラーは `/login` へ汎用文

### 4.2 サインアップ（新規 Google）

1. `/signup` で規約チェックを入れて「Google で続行」
2. 同じ公式エンドポイント。`requestSignUp: true` と `additionalData: { acceptedLegal, legalVersion }`
3. 同意なし・旧版は 400。Google へは進まない
4. 新規なら `legal_consents` を書き、`/age` へ
5. 同じメールのパスワードユーザーがいるときはリンクせず失敗（メール＋パスワードのまま）

### 4.3 ログアウト

既存の `endSession`。変更しない。

---

## 5. 画面

正本は [01-auth.md](../screen-designs/01-auth.md)。独立ルートは作らない。

| 画面 | 要素 |
|---|---|
| `/login` | 主ボタンの下、「または」、副ボタン「Google で続行」 |
| `/signup` | 同じ。規約未チェックでは Google ボタン無効 |
| 失敗 | カード上部の汎用文。クエリの `error` は残さない |

---

## 6. コールバック URL（secret なし）

Google Cloud コンソールの「承認済みのリダイレクト URI」に、環境ごとの origin を完全一致で入れる。

| 環境 | URI |
|---|---|
| ローカル（Vite 既定） | `http://localhost:5173/api/auth/callback/google` |
| ローカル（127.0.0.1） | `http://127.0.0.1:5173/api/auth/callback/google` |
| 本番 | `https://sake-shiori.com/api/auth/callback/google` |
| Workers `env.dev` | その環境の公開 origin + `/api/auth/callback/google`（origin 自体はドキュメントに書かない） |

`basePath` を変えない限りパスは `/api/auth/callback/google` で固定。

---

## 7. シークレットとオーナー作業

値は書かない。正本は [secrets.md](../secrets.md)。

1. Google Cloud でプロジェクトを作り、OAuth 同意画面のアプリ名を **酒のしおり** にする（`alco-app` のままにしない）
2. クライアント種類は「ウェブ アプリケーション」。dev と本番でクライアントを分ける
3. 上表のリダイレクト URI を登録する
4. `pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env dev`（production も同様）
5. `pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env dev`（production も同様）
6. ローカルは `.dev.vars` に同じキー（gitignore）

未設定でもアプリは起動する。ボタンは出す。押すと汎用エラー。公開前に両 env へ入れる。

---

## 8. テスト

- `/sign-in/social` の `requestSignUp` は同意なし・旧版で 400。ユーザーを作らない
- Google 未設定の `/sign-in/social` は 400 の JSON。Better Auth の 404 `Provider not found` は返さない（SPA の HTML フォールバックと無反応を避ける）
- 設定ありなら認可 URL は `accounts.google.com` で、`state` / `code_challenge` / 完全一致の `redirect_uri` がある
- モック callback で新規 Google ユーザーがセッションと `legal_consents` を持ち、`/api/me` に `image` が無い。年齢未確認の機能 API は 403
- 同じメールのパスワードユーザーへはリンクしない。パスワードログインは残る
- `requestSignUp` なしの新規はユーザーを作らない
- Google メール未検証は拒否
- `GOOGLE_CLIENT_SECRET` が git に無い。自前の token 交換コードが無い

---

## 9. 関連

- [auth.md](auth.md)
- [legal.md](../legal.md) / [legal.md](legal.md)
- [age-verification.md](age-verification.md)
- [password-reset.md](password-reset.md)
- [secrets.md](../secrets.md)
- [api-design.md](../api-design.md) 2.3
- [custom-domain.md](custom-domain.md)
