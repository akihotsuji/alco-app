# 2-04 Hono RPC + TanStack Query のクライアント基盤

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **完了**（2026-09-05） |
| 要件 | 型共有、クライアントは直接 fetch しない（coding-standards） |
| ソース | Phase 2「Hono RPC + TanStack Query のクライアント側データ取得基盤」 |

## 1. 概要

サーバーの `AppType` から `hc` クライアントを作り、TanStack Query の Provider と共通 hooks 規約を敷く。業務 hooks は後続フェーズ。

## 2. 前提条件

- 2-03 で AppType を export できる Hono アプリがある
- React SPA が動く
- `/api/me` があるとデモに使える

## 3. スコープ

**対象**

- `src/client/lib/api.ts`（hc 初期化、credentials include）
- `QueryClientProvider`
- 例: `useMe` query
- 401 時にログインへ飛ばす処理

**対象外**

- drink-logs 等の query 一式
- 楽観的更新の標準化（方針だけ書いて Phase 3 で使う）

## 4. 成果物

- API クライアント 1 箇所
- Query Provider
- サンプル hook と、それを使うホーム（ユーザー id またはメール表示でも可）
- coding-standards に既にある「直接 fetch 禁止」を満たす実装

## 5. 細分化タスク

1. `hono/client` の hc に `AppType` を渡す
2. base URL は相対 `/api`（同オリジン）
3. QueryClient のデフォルト（retry、staleTime）を決める
4. `useMe` を実装する
5. 401 でログイン画面
6. 短いコメントではなく README か spec に「hooks の置き場 `src/client/hooks/`」を書く

## 6. 手順

1. 依存: `@tanstack/react-query`（未導入なら追加理由を PR に）

2. Worker が SPA と API を同オリジン配信するので CORS は不要。`credentials: 'include'` は Cookie のため。

3. 型: `src/server/index.ts` から `export type AppType = typeof app`。クライアントがサーバー実装をバンドルしないよう、型だけ import する（Vite の type-only import）。

4. ブランチ: `feature/rpc-query-foundation`

5. 確認: ログイン後ホームに me が出る。ログアウト後は query が残らないよう `queryClient.clear()`。

### 実装時の確定事項（2026-09-05）

正本は [spec/02-tech-stack.md](../../spec/02-tech-stack.md) 「クライアントのデータ取得（2-04 FIX）」。

| 要確認だった点 | 確定 |
|---|---|
| staleTime | **30 秒**。mutation 後は `invalidateQueries` で取り直す |
| retry | 4xx（`ApiClientError.status < 500`）は再試行しない。5xx・ネットワーク断は 1 回。mutation は再試行しない |
| エラー toast | 2-05 / 2-06 の shadcn 接続後。今は「読み込めませんでした」+ 再試行のインライン表示のみ |
| 401 の経路 | `QueryCache` / `MutationCache` の `onError` → `endSession()`（`authClient.signOut()`、失敗時は `$sessionSignal` を notify）→ セッション store が空 → **`RequireAuth` が `queryClient.clear()` して `/login` へ**。画面から `navigate` しない（Better Auth の store が古いまま `/login` に飛ぶと `GuestOnly` が `/` に押し戻す競合があったため、経路を 1 本にした） |
| ログアウト | 同じ `endSession()`。`useLogout` のような別経路は作らない。`/` から来た未ログインは `/login`（`redirect` なし）にして、ログアウト直後の URL を素に保つ |
| hooks の形 | `xxxQueryOptions(client = api)` を `queryOptions()` で export し、`useXxx()` は `useQuery` に渡すだけ。テストは hook を通さず `queryClient.fetchQuery(xxxQueryOptions(testClient))` |
| エラー本文の扱い | `apiErrorBodySchema.safeParse`。未知のコードや非 JSON はサーバー本文を信用せず `internal_error`（401 のみ `unauthorized`） |
| Cookie と Node テスト | `createApiClient({ fetch: (input, init) => app.request(input, init) })` で `createTestApp()` に直結。`credentials: "include"` と相対 URL `/api/me` が本番と同じ形で流れることをテストで固定 |

## 7. 仕様詳細

Mutation 規約（Phase 3 向け先出し）:

- 成功後に関連 queryKey を invalidate（`queryKeys.<resource>` の先頭要素）
- queryKey は `["drink-logs", { from, to }]` のように配列。定義は `src/client/lib/query-keys.ts`
- 楽観的更新は既定でしない（ホームの 1 タップも「サーバー応答後に更新」）

## 8. 受け入れ条件

- [x] コンポーネント内に裸の `fetch` が基盤コード以外にない（`rg "\bfetch\(" src/client` に該当なし。`hc` の呼び出しも `api.ts` のみ）
- [x] `/api/me` が型付きで呼べる（`src/client/lib/api.test.ts` の `expectTypeOf`、`src/client/hooks/use-me.test.ts`）
- [x] 401 でログインへ（`query-client.test.ts` の `onUnauthorized`、`end-session.test.ts`。ブラウザで `me` 401 → `sign-out` → `/login` を確認）
- [x] ログアウトでキャッシュクリア（`RequireAuth` の `queryClient.clear()`。ブラウザで再ログイン後に `me` が再取得されることを確認）
- [x] lint / typecheck / test

## 9. セキュリティ観点

- クライアントにシークレットを置かない
- me のレスポンスを過剰にキャッシュして共有 PC で残さない（ログアウトで clear）
- XSS で Cookie は httpOnly なら読めない。トークンを localStorage に入れない

## 10. 関連ファイル / 関連spec

- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)
- [.cursor/rules/coding-standards.mdc](../../.cursor/rules/coding-standards.mdc)
- [03-hono-api-structure.md](03-hono-api-structure.md)

## 11. リスク・注意点

- サーバーモジュールを client が実行時 import すると Workers 向けコードがバンドルされる。`import type` を徹底
- wrangler dev と Vite を分離していると Cookie のドメインがずれる。0-04 の起動方式に合わせる
