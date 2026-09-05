# 2-03 Hono APIの基本構造

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **完了**（2026-09-05） |
| 要件 | 全 API 認証、Zod、secure-headers |
| ソース | Phase 2「ルーティング分割、認証ミドルウェア、エラーハンドリング、Zodバリデーション」 |

## 1. 概要

後続機能がコピーできる API の骨格を作る。ドメインルート（drink-logs 等）は空または ping 程度。規則を `api-conventions` ルールに固定する。

## 2. 前提条件

- 0-04 の Hono Hello World
- 2-02 のセッションが取れる
- `spec/api-design.md` の共通エラー形式

## 3. スコープ

**対象**

- `src/server` のディレクトリ分割（routes / middleware / services）
- 認証ミドルウェア（公開パス以外）
- グローバルエラーハンドラ（スタックをクライアントに出さない）
- `@hono/zod-validator`
- `hono/secure-headers`
- サンプルの保護エンドポイント（例 `GET /api/me`）

**対象外**

- 飲酒記録などの業務 CRUD
- RPC フック（2-04）

## 4. 成果物

- 上記ソース
- `.cursor/rules/api-conventions.mdc`
- `GET /api/me` が `{ id, email, name }` を返す（出しすぎない。image は返さない）

## 5. 細分化タスク

1. ディレクトリを切る
2. 公開パスリスト（health, auth）を一箇所に定義する
3. 認証 MW: 失敗時 401
4. エラーハンドラ
5. secure-headers（CSP は SPA とインラインの兼ね合い。**要確認**）
6. `/api/me` + Zod なし GET
7. ルールファイル

## 6. 手順

1. ルート構成（実装済み）:

```
src/server/
  index.ts              # app 組み立て、AppType export
  app-env.ts
  errors.ts             # ApiError / code ↔ status
  validation.ts         # validate(target, schema)
  middleware/auth.ts    # PUBLIC_API_ROUTES / createAuthGuard
  middleware/error.ts   # errorHandler / notFoundHandler
  routes/health.ts
  routes/me.ts
  services/             # 空（後続フェーズ）
src/shared/
  api-error.ts          # API_ERROR_CODES / apiErrorBodySchema
  zod-config.ts         # ja ロケール + jitless
public/_headers         # SPA 静的アセットの CSP 等
```

2. `c.get("user")` を MW でセット。ハンドラは `body.userId` を見ない。

3. エラー:

```typescript
// クライアント: { error: "internal_error" } など汎用
// 詳細は console または Workers Logs のみ。パスワードをログらない
```

4. CSP: Vite 開発と本番で分ける必要がありうる。厳しすぎて SPA が死なないか wrangler dev で確認。

5. ブランチ: `feature/api-foundation`

### 実装時の確定事項（2026-09-05）

| 要確認だった点 | 確定 |
|---|---|
| CSP と SPA / インライン | Worker の `secureHeaders` は `/api/*` にしか届かない（`run_worker_first: ["/api/*"]`）。**API 応答は `default-src 'none'`、SPA は `public/_headers`** で `script-src 'self'; style-src 'self'`（`unsafe-inline` なし）。`pnpm build` → `wrangler dev --env dev` で `/login` → ログイン → ホーム → ログアウトを Chrome DevTools で確認し、CSP 違反ゼロ |
| Vite 開発と本番の分離 | `pnpm dev`（Vite）では `_headers` は適用されない。React Fast Refresh がインラインスクリプトのため、開発時に CSP を掛けない方が正しい。本番相当の確認は wrangler dev で行う |
| Zod の `new Function` プローブ | Zod v4 が JIT 可否判定で `new Function("")` を試し、CSP 違反として記録される（動作は壊れない）。`z.config({ jitless: true })` で抑止。`'unsafe-eval'` は足さない |
| 認証 MW の掛け方 | ルート個別の `requireAuth` ではなく `/api/*` 全体に `createAuthGuard`。公開ルートは `PUBLIC_API_ROUTES` で除外するので登録順に依存しない。未認証の未定義 `/api/*` は 404 より先に 401 |
| health と D1 | `GET /api/health` は Better Auth を組み立てない（D1 に触らない）。死活確認が DB 障害に巻き込まれない |
| ZodError の扱い | ハンドラ内で `parse` が投げた ZodError も `onError` で 400 に寄せる。サーバー側データの検証は `safeParse` を使う（ルールに明記） |
| HTTPException | `hono/validator` の壊れた JSON 等（400）はキー `""` の日本語メッセージ 1 件に置換し、Hono の英語文言をエコーしない。対応表にない 403 等は 500 `internal_error` にして 403 を出さない |
| Better Auth のレート制限とテスト | メモリストアがプロセス共有なので、テストヘルパーがアプリごとに `cf-connecting-ip` を変えて 429 を避ける |

## 7. 仕様詳細

api-conventions に書くこと:

- ルートはリソース単位
- 更新・削除は `and(eq(id), eq(userId))`
- 入力は shared Zod
- レスポンスは明示的な型（RPC 用に AppType を export）

`/api/me` は `{ id, email, name }`（[spec/api-design.md](../../spec/api-design.md) で確定）。表示名更新は Better Auth クライアント。独自 PATCH は置かない。

## 8. 受け入れ条件

- [x] 保護ルートが未ログインで 401（`src/server/auth.test.ts`。未定義 `/api/*` も 401）
- [x] `/api/health` は 200（`src/server/index.test.ts`）
- [x] エラー本文にスタック・パスがない（`src/server/middleware/error.test.ts`）
- [x] secure-headers が付く（API: `index.test.ts`。SPA: `public/_headers` を wrangler dev で確認）
- [x] api-conventions ルールがある（`.cursor/rules/api-conventions.mdc`）
- [x] lint / typecheck / test

## 9. セキュリティ観点

- 認可 MW の順序（validator より前に認証してよい。ID を知る前に 401）
- CSP で `unsafe-inline` を安易に全開放しない
- X-Content-Type-Options nosniff 等は secure-headers に任せる

## 10. 関連ファイル / 関連spec

- [spec/api-design.md](../../spec/api-design.md)
- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc)
- 次: [04-hono-rpc-tanstack-query.md](04-hono-rpc-tanstack-query.md)

## 11. リスク・注意点

- Auth ルートまで MW で保護するとログイン不能
- Hono の `app.onError` で ZodError を 400 にマップし忘れると 500 になる
