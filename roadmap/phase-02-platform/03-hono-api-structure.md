# 2-03 Hono APIの基本構造

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **未着手** |
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

1. ルート構成案:

```
src/server/
  index.ts          # app 組み立て
  middleware/auth.ts
  middleware/error.ts
  routes/me.ts
  routes/health.ts
```

2. `c.get("user")` を MW でセット。ハンドラは `body.userId` を見ない。

3. エラー:

```typescript
// クライアント: { error: "internal_error" } など汎用
// 詳細は console または Workers Logs のみ。パスワードをログらない
```

4. CSP: Vite 開発と本番で分ける必要がありうる。厳しすぎて SPA が死なないか wrangler dev で確認。

5. ブランチ: `feature/api-foundation`

## 7. 仕様詳細

api-conventions に書くこと:

- ルートはリソース単位
- 更新・削除は `and(eq(id), eq(userId))`
- 入力は shared Zod
- レスポンスは明示的な型（RPC 用に AppType を export）

`/api/me` は `{ id, email, name }`（[spec/api-design.md](../../spec/api-design.md) で確定）。表示名更新は Better Auth クライアント。独自 PATCH は置かない。

## 8. 受け入れ条件

- [ ] 保護ルートが未ログインで 401
- [ ] `/api/health` は 200
- [ ] エラー本文にスタック・パスがない
- [ ] secure-headers が付く
- [ ] api-conventions ルールがある
- [ ] lint / typecheck / test

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
