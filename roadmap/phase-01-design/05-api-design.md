# 1-05 API設計

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 1 設計 |
| ステータス | **未着手**（`spec/api-design.md` なし） |
| 要件 | 全 API 認証・認可、user_id スコープ |
| ソース | Phase 1「リソース単位のエンドポイント一覧、認可ルール → spec/api-design.md」 |

## 1. 概要

Hono で公開する HTTP API の契約を決める。実装は Phase 2 以降。クライアントは Hono RPC で同じ型を使うため、ルートの形をここで固定する価値が高い。

## 2. 前提条件

- 1-04 のデータモデル草案
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

- `spec/api-design.md`（Phase 1 DoD）
- （Phase 2 で）rule `api-conventions` に落とす項目の草案を本ファイルに含めてよい

## 5. 細分化タスク

1. プレフィックス `/api` と Auth のマウントパスを決める
2. リソース一覧を CRUD 表にする
3. エラーコードと HTTP ステータスを決める
4. 公開エンドポイントを明示リストにする（オーナー承認対象）
5. 承認 PR

## 6. 手順

1. Better Auth の Hono マウントパス（よくあるのは `/api/auth/**`）を公式どおりに書く。独自実装しない。
2. `spec/api-design.md` を作成する。
3. 各エンドポイントに「セッションの userId のみ使用」と明記する。
4. PR: `docs: API設計を追加`

## 7. 仕様詳細

### 共通

- JSON、UTF-8
- 認証: セッション Cookie（httpOnly, secure, sameSite）。Bearer を自作しない
- 未認証: **401**
- 存在しない / 他人のリソース: **404**（同じ本文）
- バリデーション失敗: **400**（Zod のフィールドエラーを返すかは **要確認**。内部パスは出さない）
- サーバーエラー: **500** 汎用メッセージ

### 公開（仕様に明記）

| パス | 理由 |
|---|---|
| `GET /api/health` | 生存確認 |
| `/api/auth/*` | Better Auth（ログイン前に必要） |

これ以外は認証必須。

### 草案エンドポイント

**drink-logs**

- `GET /api/drink-logs?from=&to=` 一覧（ユーザー自身、期間）
- `POST /api/drink-logs` 作成
- `GET /api/drink-logs/:id`
- `PATCH /api/drink-logs/:id`
- `DELETE /api/drink-logs/:id`
- （任意）`GET /api/drink-logs/summary?period=day|week|month`

**my-drinks**

- CRUD `/api/my-drinks`
- （任意）`POST /api/my-drinks/:id/log` 1 タップ記録

**bottles**

- CRUD `/api/bottles`
- `GET /api/bottles?q=&type=&status=`

**tasting-notes**

- CRUD `/api/tasting-notes`
- `GET /api/tasting-notes?bottleId=`

**photos**

- `POST /api/photos`（multipart、サーバーがキー生成）
- `GET /api/photos/:id` または署名 URL 発行 `POST /api/photos/:id/url`
- `DELETE /api/photos/:id`

配信を Worker 経由にするか署名付き URL にするかは security 上どちらも可。有効期限付き署名を推奨。**要確認**。

### 認可

```text
WHERE id = :id AND user_id = :sessionUserId
```

ボディの `userId` は無視する（スキーマに含めない）。

### ページング

**要確認**: カーソル vs offset。個人利用なら初期は `limit` 上限 100 + 日付降順で十分。

## 8. 受け入れ条件

- [ ] `spec/api-design.md` 承認済み
- [ ] 全データ API に認可ルールがある
- [ ] 公開エンドポイントが列挙され、オーナーが認識している
- [ ] 404 統一が書いてある
- [ ] 計算式の正はサーバー（クライアント表示は同じ shared 関数で可）

## 9. セキュリティ観点

- IDOR 禁止、Zod 必須、生 SQL 禁止
- 写真 GET に認可
- レート制限は Phase 8。MVP でも Better Auth のログイン試行制限は有効化（Phase 2-02）
- CORS: 同一 Worker 配信なら SPA と API は同オリジン。余計な CORS 全開放をしない

## 10. 関連ファイル / 関連spec

- [04-er-drizzle-schema.md](04-er-drizzle-schema.md)
- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc)
- 実装: [../phase-02-platform/03-hono-api-structure.md](../phase-02-platform/03-hono-api-structure.md)

## 11. リスク・注意点

- RPC のためにネストした Hono チェーンの型が複雑。ルートを浅く保つ
- サマリーをクライアント集計だけにすると改ざんできる。表示用でもサーバー集計か shared 計算 + 生データで再計算
