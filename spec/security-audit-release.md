# リリース前セキュリティ監査（7-07）

`security-audit` スキルを **リポジトリ全体** に適用した記録。差分レビューではない。攻撃手順は書かない。

- 実施日: **2026-09-09**
- 対象: `origin/main`（`34aa4af`）と本タスクの硬化（出典 URL の HTTPS 限定）
- 正本: [.cursor/skills/security-audit/SKILL.md](../.cursor/skills/security-audit/SKILL.md)、[.cursor/rules/security.mdc](../.cursor/rules/security.mdc)、[api-design.md](api-design.md) 2.3

---

## セキュリティ監査結果

対象: コードベース全体（`src/server` / `src/client` / `src/shared` / `src/db` / `wrangler.jsonc` / `.github/workflows` / 追跡ファイルのシークレット検査）

判定: **合格**（Critical / High ゼロ）

### 指摘事項

- 🔴 Critical: なし
- 🟠 High: なし
- 🟡 Medium:
  - アプリ全体のレート制限は Phase 8。Better Auth のログイン制限は isolate メモリ。公開ドメインではサインアップが誰でもできる（仕様。招待制は不採用）
  - 酒記録の写真は AI Gateway 経由で外部モデルに送る（[ai-recognition.md](features/ai-recognition.md)。Google API キーは置かない。Gateway 本文ログは既定 OFF）
  - R2 の r2.dev / カスタムドメインの **ダッシュボード目視** はオーナー（下記 4 章）。API のバケット取得は公開設定フィールドを返さない
  - 写真 R2 にオブジェクトバージョンは無い。誤削除の復元は不可（[operations.md](operations.md)）

### 確認済み項目

- 新規・既存の `/api` は `createAuthGuard` が `/api/*` に一括適用。公開除外は `PUBLIC_API_ROUTES` のみ
- DB の一覧・更新・削除はセッションの `userId`。ボディ / URL の `userId` は Zod `.strict()` で 400
- 他人 ID と不在は同じ 404。403 は使わない
- 外部入力は `@hono/zod-validator` または写真 multipart の magic bytes。`sql` の値はプレースホルダ。`LIKE` は `escapeLike`
- `dangerouslySetInnerHTML` なし。場所リンクは `isSafeGoogleMapsHref`。認識出典は `isHttpsSourceUrl`
- `.dev.vars` / `.env` は未追跡。`wrangler.jsonc` に secret キー無し。ログはメソッドとパス
- 写真はサーバー採番キー、1MB / 長辺 / 種別検証、`GET /api/photos/:id/content` で認可。R2 は Worker binding のみ
- エラー本文は `error` コード（と 400 の `fields`）。スタック・SQL・内部パスなし
- 保護 API に未認証 401 と IDOR 404 のテストがある。公開例外は仕様と一致
- `pnpm audit --audit-level=high` は High 以上なし
- Preview / PR からの `wrangler deploy` は無い

---

## 1. 公開エンドポイント

実装の allowlist（`src/server/middleware/auth.ts`）と [api-design.md](api-design.md) 2.3 / [health.md](features/health.md) を突合した。

| 方法 | パス | 認証 | 本文 |
|---|---|---|---|
| GET / HEAD | `/api/health` | なし | `{ "ok": true }` のみ。環境変数を返さない |
| GET / HEAD | `/api/config` | なし | `{ "turnstileSiteKey": string \| null }` のみ。シークレットを返さない（8-05） |
| * | `/api/auth/*` | Better Auth | サインアップ / ログイン / ログアウト / セッション。独自トークンなし |

これ以外の `/api/*` は未認証なら **401**（未定義パスも 401。存在を漏らさない）。固定したテスト: `src/ci/security-release-gates.test.ts`、`src/server/middleware/auth.test.ts`。

---

## 2. `/api` ルートと認可テスト

認証 MW はルート解決より前。写真 GET を後回しにしていない。

| 方法 | パス | 未認証 401 | 他人 404 |
|---|---|---|---|
| GET | `/api/me` | あり | 自分のセッションのみ |
| GET / POST | `/api/drink-logs` | あり | 一覧に他人を混ぜない。参照 ID は 404 |
| GET | `/api/drink-logs/summary` | あり | 他人を混ぜない |
| POST | `/api/drink-logs/recognize` | あり | 日次上限はユーザー単位 |
| GET / PATCH / DELETE | `/api/drink-logs/:id` | あり | あり |
| GET / POST / PATCH / DELETE | `/api/my-drinks` および `/:id` | あり | あり |
| POST | `/api/my-drinks/:id/log` | あり | あり |
| POST / GET / PATCH / DELETE | `/api/photos` および `/:id` | あり | あり |
| GET | `/api/photos/:id/content` | あり | あり |
| GET / POST / PATCH / DELETE | `/api/bottles` および `/:id` | あり | あり |
| POST | `/api/bottles/recognize` | あり | 日次上限はユーザー単位 |
| POST | `/api/bottles/:id/consume` | あり | あり（記録は作らない） |
| POST | `/api/bottles/:id/restore` | あり | あり |
| GET / POST / PATCH / DELETE | `/api/tasting-notes` および `/:id` | あり | あり |
| POST | `/api/tasting-notes/recognize` | あり | 日次上限はユーザー単位 |

Cron の未紐付け GC は HTTP ではない。未紐付けかつ 24h 超だけ削除する。

---

## 3. ヘッダー・Cookie・XSS

| 経路 | 確認 |
|---|---|
| API | `hono/secure-headers`。CSP `default-src 'none'`、`X-Frame-Options: DENY`、nosniff、`Referrer-Policy: no-referrer`、CORP `same-origin`。CORS なし |
| SPA | `public/_headers`。`'unsafe-inline'` なし。WASM 切り抜き用 `'wasm-unsafe-eval'` は仕様どおり |
| Cookie | httpOnly / sameSite=Lax / secure（HTTPS）。`Domain` は付けない |
| ホスト正規化 | 行き先は `CANONICAL_ORIGIN` のみ。`Host` を信用しない |
| SW | `/api/*` は NetworkOnly（[pwa.md](features/pwa.md)） |

---

## 4. R2 非公開

配信の正は認可付き `GET /api/photos/:id/content`。署名 URL は作らない。バックアップ用 `alco-app-d1-backups` は Worker に bind しない。

| 確認 | 結果 | 誰 |
|---|---|---|
| `wrangler.jsonc` に r2.dev / 公開ドメイン / バックアップバケット名が無い | 2026-09-09 確認。`src/ci/security-release-gates.test.ts` で固定 | エージェント |
| アカウントのバケット一覧 | `alco-app-photos-dev` / `alco-app-photos-prod` / `alco-app-d1-backups` の 3 つ。追加の公開用バケットは無い | エージェント（Cloudflare API。値は書かない） |
| ダッシュボード: Public Development URL が Disabled、Custom Domains が空 | **未実施** | オーナー。リリースチェックリスト |

作成時方針は [production-env.md](features/production-env.md) 6 章。既定は非公開。

---

## 5. シークレット

[secrets.md](secrets.md) のインベントリと `src/ci/secrets-inventory.test.ts`。追跡に `.dev.vars` / `.env` は無い。本番 Auth secret は Worker 投入済み（7-03。値は見ていない）。

---

## 6. 依存

```powershell
pnpm audit --audit-level=high
```

2026-09-09: High 以上なし。新規パッケージは本タスクで追加していない。

---

## 7. 本タスクで入れた硬化

認識出典 URL を **HTTPS のみ**（`javascript:` / `http:` / userinfo を拒否）。クライアントは出典を `href` にしていないが、AI 出力をそのまま採用しない。

---

## 関連

- [release-checklist.md](release-checklist.md)
- [operations.md](operations.md)
- [07-security-audit.md](../roadmap/phase-07-production-release/07-security-audit.md)
