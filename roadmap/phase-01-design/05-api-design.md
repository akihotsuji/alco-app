# 1-05 API設計

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 1 設計 |
| ステータス | **完了**（`spec/api-design.md` 承認済み。#12） |
| 要件 | 全 API 認証・認可、user_id スコープ |
| ソース | Phase 1「リソース単位のエンドポイント一覧、認可ルール → spec/api-design.md」 |

## 1. 概要

Hono で公開する HTTP API の契約を決める。実装は Phase 2 以降。クライアントは Hono RPC で同じ型を使うため、ルートの形をここで固定する価値が高い。

## 2. 前提条件

- [spec/data-model.md](../../spec/data-model.md)（1-04 承認済み）
- [security.mdc](../../.cursor/rules/security.mdc)
- 公開例外: `/api/health`、Better Auth 配下

## 3. スコープ

**対象**

- リソースごとのエンドポイント（method, path, 概要, 認証, エラー）
- 共通レスポンス / エラー形式
- ページング、フィルタのクエリ
- 認可ルール（IDOR、404 統一）

**対象外**

- ハンドラ実装
- RPC クライアント生成（Phase 2-04）
- 写真 multipart の詳細バイト数（骨格はここ、数値は 4-04 と cellar spec）

## 4. 成果物

- [spec/api-design.md](../../spec/api-design.md)（Phase 1 DoD）
- Phase 2 の rule `api-conventions` に落とす草案（同ファイル §6）

## 5. 細分化タスク

1. [x] プレフィックス `/api` と Auth のマウントパスを決める
2. [x] リソース一覧を CRUD 表にする
3. [x] エラーコードと HTTP ステータスを決める
4. [x] 公開エンドポイントを明示リストにする（オーナー承認対象）
5. [ ] 承認 PR

## 6. 手順

1. Better Auth の Hono マウントパスは公式どおり `/api/auth/*`。独自実装しない。
2. `spec/api-design.md` を作成する。
3. 各エンドポイントに「セッションの userId のみ使用」と明記する。
4. PR: `docs: API設計を追加`

## 7. 仕様詳細

正本は [spec/api-design.md](../../spec/api-design.md)。本タスクの「要確認」は次のとおり確定した。

| 旧要確認 | 決定 |
|---|---|
| Zod フィールドエラー | 返す。`{ error: "validation_error", fields }`。内部パスは出さない |
| ページング | `limit` 最大 100 + 不透明 `cursor`。offset なし |
| summary | 必須。サーバー集計。週は月曜始まり |
| 1 タップ | `POST /api/my-drinks/:id/log` 必須。サーバーがプリセットをコピー |
| 写真配信 | 認可付き `GET /api/photos/:id/content`。署名 URL は MVP 不採用 |
| CORS | 同一オリジン。全開放しない |

## 8. 受け入れ条件

- [x] `spec/api-design.md` を作成（承認は本 PR）
- [x] 全データ API に認可ルールがある
- [x] 公開エンドポイントが列挙され、オーナーが認識できる
- [x] 404 統一が書いてある
- [x] 計算式の正はサーバー（クライアント表示は同じ shared 関数で可）

## 9. セキュリティ観点

- IDOR 禁止、Zod 必須、生 SQL 禁止
- 写真 GET に認可
- レート制限は Phase 8。MVP でも Better Auth のログイン試行制限は有効化（Phase 2-02）
- CORS: 同一 Worker 配信なら SPA と API は同オリジン。余計な CORS 全開放をしない

## 10. 関連ファイル / 関連spec

- [spec/api-design.md](../../spec/api-design.md)
- [04-er-drizzle-schema.md](04-er-drizzle-schema.md)
- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc)
- 実装: [../phase-02-platform/03-hono-api-structure.md](../phase-02-platform/03-hono-api-structure.md)

## 11. リスク・注意点

- RPC のためにネストした Hono チェーンの型が複雑。ルートを浅く保つ（api-design §5）
- サマリーをクライアント集計だけにすると改ざんできる → サーバー集計を必須にした
