# 2-04 Hono RPC + TanStack Query のクライアント基盤

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **未着手** |
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

## 7. 仕様詳細

**要確認**

- staleTime（個人アプリなら 30s でも可）
- エラー toast のライブラリ（shadcn toast を 2-06 後に接続）

Mutation 規約（Phase 3 向け先出し）:

- 成功後に関連 queryKey を invalidate
- queryKey は `["drink-logs", from, to]` のように配列

## 8. 受け入れ条件

- [ ] コンポーネント内に裸の `fetch` が基盤コード以外にない（サンプル画面）
- [ ] `/api/me` が型付きで呼べる
- [ ] 401 でログインへ
- [ ] ログアウトでキャッシュクリア
- [ ] lint / typecheck / test

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
