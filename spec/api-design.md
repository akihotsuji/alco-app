# API設計

Phase 1-05 の成果物（2026-09-05 に 1-07 で改訂）。Hono が公開する HTTP API の契約。実装は Phase 2 以降。クライアントは Hono RPC（2-04）で同じ型を使う。

- 状態: 1-05 は **承認済み**（#12 マージ）。**1-07 の改訂（1.1 節）はオーナー承認待ち**。範囲・丸めの数値は [features/alcohol-calculation.md](features/alcohol-calculation.md) を正とする
- 画面との対応は [screen-designs/](screen-designs/README.md) の各要素表
- 列・enum・削除方針の正本: [data-model.md](data-model.md)
- セキュリティ正本: [`.cursor/rules/security.mdc`](../.cursor/rules/security.mdc)
- 公開 `GET /api/health` の個別契約: [features/health.md](features/health.md)

ハンドラ実装・RPC クライアント生成・写真のバイト数確定は対象外（2-03 / 2-04 / 4-04）。

---

## 1. 決定事項

1-05 の「要確認」を、要件・data-model・後続タスクから落として確定する。異議があれば本 PR のレビューで指摘する。

| 項目 | 決定 | 根拠 |
|---|---|---|
| プレフィックス | アプリ API は `/api`。Hono の `basePath` は使わず、各ルートに `/api` を書く | 既存 `GET /api/health` と一致。RPC の型を浅く保つ |
| Auth マウント | Better Auth `basePath` 既定の **`/api/auth`**。`app.all("/api/auth/*", (c) => auth.handler(c.req.raw))` | [公式 Hono 統合](https://www.better-auth.com/docs/integrations/hono)。独自トークンは作らない |
| 公開エンドポイント | **`GET /api/health`** と **`/api/auth/*` のみ** | 2026-09-04 オーナー承認。追加は仕様更新＋再承認 |
| バリデーションエラー | **400** でフィールドエラーを返す。内部パス・Zod コードパスは出さない | フォーム UX。情報漏えい防止 |
| 存在 / 権限 | 存在しない ID と他人の ID は **同じ 404・同じ本文** | IDOR・存在推測防止（security.mdc） |
| ページング | **`limit`（既定 50、最大 100）+ 不透明 `cursor`**。offset は使わない | 個人利用で十分。日付降順と相性が良い |
| 一覧の期間 | 飲酒記録一覧は `date` または `from`+`to`（JST 日）必須。最大 31 日 | 全件取得と TZ ずれ防止（3-05） |
| サマリー | **`GET /api/drink-logs/summary` を必須**。サーバー集計 | 改ざん耐性。計算の正はサーバー |
| 1 タップ記録 | **`POST /api/my-drinks/:id/log` を必須**。サーバーがプリセットをコピー | 3-03。クライアントが量・度数を混ぜない |
| 写真配信 | **認可付き `GET /api/photos/:id/content`（Worker が R2 をストリーム）** | 同一オリジンで Cookie が付く。R2 binding のみ。追加の S3 シークレット不要 |
| 署名 URL | MVP では **作らない** | 上に同じ。必要になったら追記 |
| `/api/me` | `{ id, email, name }`。表示名更新は Better Auth クライアント | 設定画面。独自 PATCH は作らない |
| 週の始まり | **月曜（ISO 8601）** | 3-06 が覆す場合は本ファイルを先に直す |
| 未来日の休肝 | サマリーの未来日は `isFuture: true`、**休肝日に数えない** | 3-06 の提案を採用 |
| JSON の瞬間時刻 | **ISO 8601 UTC**（`...Z`）。DB の Unix ms とはサーバーが変換 | 可読性と TZ 明示 |
| カレンダー日 | **`YYYY-MM-DD`（Asia/Tokyo）** | data-model の `*_on` |
| CORS | **全開放しない**。SPA と API は同一 Worker・同一オリジン | 余計なクロスオリジンを増やさない |
| 未定義 `/api/*` | `{ "error": "not_found" }`（2-03 で統一済み）。**未認証なら 404 より先に 401**（ルートの存在を漏らさない） | 共通エラー形式。health 成功は `{ "ok": true }` のまま |

### 1.1 1-07 改訂（2026-09-05。承認待ち）

| 項目 | 決定 | 根拠 |
|---|---|---|
| 消費 | **`POST /api/bottles/:id/consume`** を追加。ボトルを `consumed` にし、任意で同じトランザクション内に drink-log を 1 件作る | [screen-designs/04-cellar.md](screen-designs/04-cellar.md) 消費ダイアログ |
| 復元 | **`POST /api/bottles/:id/restore`** を追加。`consumed → sealed | opened`。undo と「セラーに戻す」 | 同上 |
| 棚 / 貯蔵庫 | `GET /api/bottles` に **`view=cellar \| archive \| all`**（既定 `cellar`）。`archive` は `consumedAt` 降順 | 棚と貯蔵庫の分離 |
| 本数展開 | `POST /api/bottles` に **`count`（1〜12）**。N 行を作り `{ items: Bottle[] }` を返す。`quantity` フィールドは廃止 | 1 行 = 1 本 |
| 記録とボトル | drink-log に **`bottleId`**（任意）。`GET /api/drink-logs?bottleId=` で絞り込み（期間必須は維持しない: `bottleId` 指定時は期間省略可、最大 100 件） | ボトル詳細の記録節 |
| 写真の紐付け | 作成 API（drink-logs / bottles / tasting-notes）が **`photoIds: string[]`** を受け取り、同一トランザクションで紐付ける。PATCH でも可 | 「使う」直後の先アップロード → 保存で紐付け |
| 記録の写真 | `POST /api/photos` に **`drinkLogId`** を追加。所有者 3 列は最大 1 つ | 写真を撮って記録 |
| 写真枚数 | 記録 1 / ボトル 1 / ノート 6。超過は 400 `validation_error`（`photoIds`） | data-model 5.6 |
| 写真の実体検証 | **magic bytes**、1MB（413）、長辺 1600px（400）、jpeg/png/webp のみ | [screen-designs/07-photo-capture.md](screen-designs/07-photo-capture.md) |
| 未紐付け GC | **Cron Trigger（日次）** で作成 24h 超の未紐付け写真を R2 + D1 から削除。公開エンドポイントではない（Worker の `scheduled` ハンドラ） | 放棄分の掃除 |
| 一覧のサムネ | drink-log 一覧にも `thumbPhotoId` を含める。bottles 一覧は `thumbPhotoKind`（`photo` / `cutout`）も返す | 日別の行サムネ、棚の描き分け |
| 写真の種別 | 写真メタに `kind`（`photo` / `cutout`）。サーバーが WebP の alpha フラグで判定し、クライアント申告は受け取らない | 切り抜き（2026-09-05） |
| ラベル読み取り | **`POST /api/bottles/recognize`** を追加。Workers AI（Vision）で候補を返す。**保存しない**。日次上限 30 回 / ユーザー（429） | オーナー決定（2026-09-05）。プロバイダは差し替え可能に |

---

## 2. 共通契約

### 2.1 プロトコル

| 項目 | 内容 |
|---|---|
| スキーム | HTTPS（ローカル `wrangler dev` は公式どおり） |
| 文字コード | UTF-8 |
| 成功の Content-Type | `application/json`（写真バイナリ配信のみ画像 MIME） |
| 作成・更新の Content-Type | `application/json`（写真アップロードのみ `multipart/form-data`） |
| フィールド名 | **camelCase**（data-model の TS 名と一致） |
| 作成時の `id` | クライアントは送らない。サーバーが UUID v4 を採番 |
| バージョニング | `/v1` は付けない。破壊的変更は新しいフィールドを足すか、仕様を更新してから実装する |

### 2.2 認証

- 認証は **Better Auth のみ**。Bearer / JWT を自作しない
- セッション Cookie: **httpOnly / secure（本番） / sameSite=Lax**（Strict は外部リンク戻りで消える。2-02 と一致）
- 保護ルートは認証ミドルウェアでセッションを解決し、`c.get("user")` の **`user.id` だけ**を所有者キーにする
- リクエストのボディ・クエリ・パスに `userId` を**含めない**（Zod スキーマにも置かない）。送ってきても無視せず、スキーマ不一致で 400
- 未認証の保護ルートは **401** `{ "error": "unauthorized" }`。未定義の `/api/*` も未認証なら 401（認証 MW はルート解決より前に走る）
- 認証 MW は `/api/*` 全体に 1 箇所で掛ける（`src/server/middleware/auth.ts` の `createAuthGuard`）。公開ルートの除外は同ファイルの `PUBLIC_API_ROUTES` だけで判定し、ルート側に認証の分岐を書かない（2-03）
- ログイン試行のレート制限は Better Auth 標準を有効化する（2-02）。アプリ全体のレート制限は Phase 8

### 2.3 公開エンドポイント（オーナー承認対象）

これ以外の `/api/*` は認証必須。公開を増やす場合は本節と [features/](features/) を更新し、オーナー承認を得る。

| 方法 | パス | 認証 | 理由 |
|---|---|---|---|
| GET | `/api/health` | なし | 死活確認。本文に内部情報を出さない |
| * | `/api/auth/*` | なし（Better Auth が各ルートを処理） | サインアップ / ログイン / ログアウト / セッション取得 |

Better Auth 配下のうち、本アプリが使う操作（パスは `basePath` からの相対。公式クライアントを使い、手で組み立てない）:

| 操作 | 公式エンドポイント（相対） | MVP |
|---|---|---|
| サインアップ | `POST /sign-up/email` | 使う |
| ログイン | `POST /sign-in/email` | 使う |
| ログアウト | `POST /sign-out` | 使う |
| セッション取得 | `GET /get-session` | 使う（サーバー MW でも使用） |
| 表示名更新 | Better Auth クライアントの `updateUser` | 設定の任意項目 |
| パスワードリセット | `POST /request-password-reset` 等 | **使わない**（Phase 8-03） |
| OAuth | プロバイダ経路 | **使わない**（Phase 8-04） |

`/api/auth/*` のレスポンス形式は Better Auth の契約に従う。本ドキュメントの `{ "error": "..." }` には包まない。

### 2.4 認可（全データ API）

```text
WHERE id = :id AND user_id = :sessionUserId
```

| 規則 | 内容 |
|---|---|
| スコープ | 一覧・詳細・更新・削除・集計・写真配信はすべてセッションの `user.id` |
| 更新・削除 | 「ID の存在確認」だけにしない。`id + userId` の一致が条件 |
| 他ユーザーの参照 ID | `myDrinkId` / `bottleId` / 写真の紐付け先が他人なら **404**（空配列で存在を漏らさない） |
| JOIN | 他ユーザー行を混ぜない（data-model 原則 3） |
| 写真 | 行の `user_id` で認可。`r2_key` を知っていても API なしでは取れない |

### 2.5 成功レスポンス

| 種類 | 形式 |
|---|---|
| 単一リソース | オブジェクトを直接返す（`{ "data": ... }` で包まない） |
| 一覧 | `{ "items": T[], "nextCursor": string \| null }` |
| 飲酒記録一覧 | 上記に加え、フィルタ全体の `{ "totalCount": number, "totalAlcoholG": number }` |
| 削除 | `{ "ok": true }` |
| health | `{ "ok": true }`（例外。既存契約） |

`nextCursor` は不透明。クライアントは中身を解釈しない。次ページは同じフィルタ + `cursor` + `limit`。

### 2.6 エラーレスポンス

```json
{ "error": "not_found" }
```

バリデーション:

```json
{
  "error": "validation_error",
  "fields": {
    "volumeMl": ["1以上5000以下で入力してください"]
  }
}
```

| HTTP | `error` | 用途 |
|---|---|---|
| 400 | `validation_error` | Zod 失敗。範囲・enum・日付形式・排他条件 |
| 401 | `unauthorized` | セッションなし / 期限切れ |
| 404 | `not_found` | 未定義ルート、存在しない ID、他人の ID、他人の参照 ID |
| 413 | `payload_too_large` | 写真サイズ超過（1MB） |
| 415 | `unsupported_media_type` | 許可外 MIME（SVG / GIF / HEIC 等） |
| 429 | `rate_limited` | ラベル読み取りの日次上限 |
| 502 | `upstream_error` | Workers AI が失敗 / タイムアウト（ラベル読み取りのみ。詳細は出さない） |
| 500 | `internal_error` | それ以外。スタック・SQL・内部パスは出さない |

- `fields` のキーはリクエストのフィールド名（camelCase）。ネストは `.` 区切り（`log.volumeMl`、`photoIds.0`）。リクエスト全体の不備（未知キー、壊れた JSON、Content-Type 不一致）はキー `""`。Zod の内部 path 配列やスキーマファイルパスは出さない
- メッセージは日本語（Zod の `ja` ロケール。`src/shared/zod-config.ts`）。値のエコーは最小（パスワードは絶対に返さない）
- 詳細は Workers Logs のみ（メソッドとパスだけ。クエリ・ヘッダー・ボディは出さない）。Cookie・トークン・パスワードをログらない
- エラーコードの一覧と本文スキーマは `src/shared/api-error.ts`（`API_ERROR_CODES` / `apiErrorBodySchema`）。ハンドラは `src/server/errors.ts` の `ApiError` を投げ、`src/server/middleware/error.ts` が本形式へ変換する（2-03）
- Phase 0 の未定義ルート `{ "ok": false }` と 500 `{ "ok": false }` は **2-03 で本形式へ移行済み**。`GET /api/health` の成功は変えない

存在しないリソースと権限のないリソースは、ステータスも本文も同じにする。**403 は使わない**。

### 2.7 ページング

| クエリ | 型 | 既定 | 制約 |
|---|---|---|---|
| `limit` | 整数 | 50 | 1〜100 |
| `cursor` | 文字列 | なし（先頭） | サーバー発行値のみ。改ざんは 400 |

並び順（特記なき場合）:

| リソース | 順 |
|---|---|
| drink-logs | `drunkAt` 降順、同値は `id` 降順 |
| my-drinks | `sortOrder` 昇順、同値は `id` 昇順 |
| bottles | `createdAt` 降順、同値は `id` 降順 |
| tasting-notes | `tastedOn` 降順、同値は `id` 降順 |

### 2.8 日付とタイムゾーン

| JSON | 意味 | 例 |
|---|---|---|
| 瞬間（`drunkAt`, `createdAt`, `updatedAt`） | UTC の ISO 8601 | `2026-09-04T12:00:00.000Z` |
| カレンダー日（`drunkOn`, `tastedOn`, `purchasedOn`, `openedOn`、クエリの `date` / `from` / `to`） | **Asia/Tokyo** の `YYYY-MM-DD` | `2026-09-04` |

- 保存は data-model どおり（瞬間は Unix ms UTC、日付は JST 文字列）
- `drunkOn` は入力項目ではない。`drunkAt` からサーバーが算出する（data-model 5.2）
- 一覧・サマリー・休肝日は JST カレンダー日。UTC 日付で切らない

### 2.9 計算の正

```
alcohol_g = volume_ml × abv_percent / 100 × 0.8
```

- **クライアントの `alcoholG` は受け取らない**（作成・更新スキーマに含めない）
- サーバーが `src/shared` の同一関数で再計算して保存する
- レスポンスの `alcoholG` はその保存値（小数第 2 位）。表示は保存値を第 1 位に丸める（[alcohol-calculation.md](features/alcohol-calculation.md)）
- クライアントが表示用に同じ関数を呼ぶのは可（信頼境界はサーバー）

### 2.10 CORS・セキュリティヘッダー

- SPA と API は同一オリジン。`Access-Control-Allow-Origin: *` は置かない
- Vite 開発でオリジンが分かれる場合だけ、許可オリジンを明示し `credentials: true` にする（`*` は不可）。Better Auth の `trustedOrigins` と一致させる
- セキュリティヘッダーは配信経路が 2 つあるため 2 箇所で付ける（2-03 で確定）:

| 経路 | 対象 | 付与場所 | CSP |
|---|---|---|---|
| Worker | `/api/*` の JSON・写真バイナリ | `src/server/index.ts` の `hono/secure-headers` | `default-src 'none'; frame-ancestors 'none'`（API 応答にスクリプトは要らない）。加えて `X-Frame-Options: DENY`、nosniff、`Referrer-Policy: no-referrer`、CORP `same-origin` |
| 静的アセット | SPA の HTML / JS / CSS | `public/_headers`（Workers Static Assets が読む。`run_worker_first` は `/api/*` のみなので Worker のヘッダーは届かない） | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |

- `script-src` / `style-src` に `'unsafe-inline'` を入れない。Vite のビルド出力は外部ファイル参照のみで、React の `style` prop は CSSOM 経由なので CSP に当たらない
- Zod v4 は既定で `new Function("")` を試して JIT 可否を判定し、これが CSP 違反として記録される。`z.config({ jitless: true })`（`src/shared/zod-config.ts`）で抑止する。`'unsafe-eval'` は足さない
- 緩める予定があるもの: 4-06 の端末内 WASM 背景除去で `script-src 'wasm-unsafe-eval'`（モデルを CDN から取るなら `connect-src` も）。変更時は本表を先に直す
- Vite 開発サーバー（`pnpm dev`）では `_headers` は適用されない（React Fast Refresh がインラインスクリプトを使うため、適用すると開発が止まる）。CSP の確認は `pnpm build` → `wrangler dev --env dev` で行う

### 2.11 入力検証

- ボディ・クエリ・パスはすべて `@hono/zod-validator` + `src/shared` の Zod
- 検証前の値を DB・レスポンス・R2 キーに使わない
- SQL は Drizzle のみ。`LIKE` の検索語もプレースホルダ。ユーザー入力をパターンに連結するときは `%` / `_` をエスケープ
- enum・範囲は data-model 5.3〜5.6 と [alcohol-calculation.md](features/alcohol-calculation.md)。数値が変わったら shared Zod と data-model を同じ変更で直す

---

## 3. エンドポイント一覧

認可列の「セッション」は、セッションの `user.id` でスコープする。

| 方法 | パス | 認証 | 概要 |
|---|---|---|---|
| GET | `/api/health` | なし | 死活確認 |
| * | `/api/auth/*` | Better Auth | 認証（公式ハンドラ） |
| GET | `/api/me` | 必須 | 自分の id / email / name |
| GET | `/api/drink-logs` | 必須 | 期間内の記録一覧＋合計 |
| GET | `/api/drink-logs/summary` | 必須 | 日 / 週 / 月の集計 |
| POST | `/api/drink-logs` | 必須 | 記録作成 |
| GET | `/api/drink-logs/:id` | 必須 | 記録詳細 |
| PATCH | `/api/drink-logs/:id` | 必須 | 記録の部分更新 |
| DELETE | `/api/drink-logs/:id` | 必須 | 記録削除 |
| GET | `/api/my-drinks` | 必須 | マイドリンク一覧 |
| POST | `/api/my-drinks` | 必須 | マイドリンク作成 |
| GET | `/api/my-drinks/:id` | 必須 | 詳細 |
| PATCH | `/api/my-drinks/:id` | 必須 | 部分更新 |
| DELETE | `/api/my-drinks/:id` | 必須 | 削除 |
| POST | `/api/my-drinks/:id/log` | 必須 | 1 タップ記録 |
| GET | `/api/bottles` | 必須 | 棚 / 貯蔵庫の一覧（`view`、検索・絞り込み） |
| POST | `/api/bottles` | 必須 | ボトル作成（`count` 本を展開） |
| GET | `/api/bottles/:id` | 必須 | 詳細（写真メタ含む） |
| PATCH | `/api/bottles/:id` | 必須 | 部分更新（開栓を含む） |
| DELETE | `/api/bottles/:id` | 必須 | 削除（写真 CASCADE、ノート・記録は残す） |
| POST | `/api/bottles/:id/consume` | 必須 | 消費 → 貯蔵庫。任意で記録 1 件を同時作成 |
| POST | `/api/bottles/:id/restore` | 必須 | 貯蔵庫 → 棚（undo / セラーに戻す） |
| POST | `/api/bottles/recognize` | 必須 | ラベル写真から候補フィールド（Workers AI）。保存しない |
| GET | `/api/tasting-notes` | 必須 | ノート一覧 |
| POST | `/api/tasting-notes` | 必須 | ノート作成 |
| GET | `/api/tasting-notes/:id` | 必須 | 詳細（写真メタ含む） |
| PATCH | `/api/tasting-notes/:id` | 必須 | 部分更新 |
| DELETE | `/api/tasting-notes/:id` | 必須 | 削除（写真 CASCADE） |
| POST | `/api/photos` | 必須 | 画像アップロード |
| GET | `/api/photos/:id` | 必須 | 写真メタ（`r2Key` なし） |
| GET | `/api/photos/:id/content` | 必須 | 画像本体 |
| PATCH | `/api/photos/:id` | 必須 | 紐付け・並び |
| DELETE | `/api/photos/:id` | 必須 | メタと R2 を削除 |

`GET /api/drink-logs/summary` は `GET /api/drink-logs/:id` より**先に登録**する（`summary` を id と誤認しない）。同様に **`POST /api/bottles/recognize` は `/api/bottles/:id/*` より先**に登録する。`consume` / `restore` は `:id` の配下なので順序の問題はない。

Cron（公開エンドポイントではない）: `scheduled` ハンドラで日次に未紐付け写真 GC を実行する。`wrangler.jsonc` の `triggers.crons`（例 `0 18 * * *` = JST 3:00）。

---

## 4. リソース詳細

パスパラメータ `:id` は UUID。不正形式は 400。存在しない / 他人は 404。

作成・更新ボディに `userId` / `id` / `createdAt` / `updatedAt` / `alcoholG` / `drunkOn` / `r2Key` を含めない。

### 4.1 GET /api/health

[features/health.md](features/health.md) どおり。`{ "ok": true }`。認証なし。D1/R2 の接続確認はしない。

### 4.2 GET /api/me

| | |
|---|---|
| 認証 | 必須 |
| 成功 | `{ "id": "<user.id>", "email": "<email>", "name": "<name>" }` |

- Better Auth の `user` から取る。`account.password` は見ない
- `image` は返さない（MVP で使わない）
- 表示名の更新は Better Auth クライアント。本 API に PATCH は置かない

### 4.3 drink-logs

**共通オブジェクト**

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | UUID |
| drunkAt | string | ISO UTC |
| drunkOn | string | JST 日（サーバー算出） |
| drinkType | enum | 7 種（data-model 5.3） |
| drinkName | string \| null | マイドリンク名スナップショット |
| volumeMl | number | 整数 ml |
| abvPercent | number | % |
| alcoholG | number | サーバー計算 |
| memo | string \| null | ≦500 |
| myDrinkId | string \| null | 参照。削除後は null |
| bottleId | string \| null | セラー連携（1-07）。削除後は null |
| thumbPhotoId | string \| null | 記録写真（1 枚）の id |
| createdAt | string | ISO UTC |
| updatedAt | string | ISO UTC |

詳細（`GET /:id`）と作成応答には `photos`（4.7 のメタ配列、最大 1）を含める。

#### GET /api/drink-logs

| クエリ | 必須 | 説明 |
|---|---|---|
| `date` | `from`/`to`/`bottleId` が無いとき必須 | 単一日（JST） |
| `from`, `to` | `date` が無いとき両方必須（`bottleId` 指定時は任意） | 閉区間の JST 日。`from <= to` |
| `bottleId` | 任意 | 自分のボトル。他人・不明は 404。指定時は期間を省略でき、`drunkAt` 降順・最大 100 件 |
| `limit`, `cursor` | 任意 | 2.7 |

`date` と `from`/`to` の同時指定は 400。期間は最大 31 日（`to - from`）。超えたら 400。

```json
{
  "items": [ { "...": "drink-log" } ],
  "nextCursor": null,
  "totalCount": 3,
  "totalAlcoholG": 36.0
}
```

`totalCount` / `totalAlcoholG` は**フィルタ全体**（ページ内ではない）。`totalCount` は杯数（行数）。`totalAlcoholG` は各行の保存値（第 2 位）を合算したあと第 2 位。表示は第 1 位（[alcohol-calculation.md](features/alcohol-calculation.md)）。

#### GET /api/drink-logs/summary

| クエリ | 必須 | 説明 |
|---|---|---|
| `period` | 必須 | `day` \| `week` \| `month` |
| `date` | 必須 | アンカー日（JST）。その日を含む日 / ISO 週（月曜始まり） / 暦月 |

```json
{
  "period": "week",
  "from": "2026-08-31",
  "to": "2026-09-06",
  "timezone": "Asia/Tokyo",
  "totalCount": 12,
  "totalAlcoholG": 86.4,
  "dryDayCount": 3,
  "days": [
    {
      "date": "2026-08-31",
      "count": 0,
      "alcoholG": 0,
      "isDryDay": true,
      "isFuture": false
    }
  ]
}
```

| 規則 | 内容 |
|---|---|
| 休肝日 | その JST 日の記録が 0 件。0g の記録がある日は休肝にしない（[alcohol-calculation.md](features/alcohol-calculation.md)） |
| `dryDayCount` | `isDryDay === true` の日数。`isFuture` の日は含めない |
| `isFuture` | その JST 日が「今日」より後 |
| スコープ | 自分の行だけ。`userId` クエリは無い |

#### POST /api/drink-logs

```json
{
  "drunkAt": "2026-09-04T12:00:00.000Z",
  "drinkType": "wine",
  "volumeMl": 125,
  "abvPercent": 12,
  "memo": null,
  "myDrinkId": null,
  "bottleId": null,
  "photoIds": []
}
```

| フィールド | 必須 | 備考 |
|---|---|---|
| drunkAt | 任意 | 省略時はサーバーの現在時刻。未来は **15 分まで**（時計ズレ）。それ以上は 400。過去は制限なし |
| drinkType | 必須 | 7 種 |
| volumeMl | 必須 | 整数 1〜5000 |
| abvPercent | 必須 | 0〜100、小数第 1 位。**0 は可** |
| memo | 任意 | 空は null |
| myDrinkId | 任意 | 自分の ID のみ。他人・不明は 404。量・度数・種類はリクエストが正。`drinkName` はプリセット名をコピーする。量をサーバーに上書きさせない 1 タップは 4.4 |
| bottleId | 任意 | 自分のボトルのみ（貯蔵庫の本も可）。他人・不明は 404。`drinkName` にボトル名、`drinkType` はボトルの種類で上書き（1-07） |
| photoIds | 任意 | 自分の **未紐付け**写真 id。最大 1。他人・紐付け済み・不明は 404。同一トランザクションで `drink_log_id` をセット（1-07） |

通常の POST で `myDrinkId` を付けるのは「どのプリセットから始めたか」の記録用。1 タップ（サーバーコピー）とは別経路。`myDrinkId` と `bottleId` の同時指定は可（`drinkName` はボトル名が優先）。

成功: 201 と作成オブジェクト。

#### GET /api/drink-logs/:id

200 とオブジェクト。他人は 404。

#### PATCH /api/drink-logs/:id

送ったフィールドだけ更新。`drunkAt` を変えたら `drunkOn` を再計算。`volumeMl` / `abvPercent` を変えたら `alcoholG` を再計算。

`myDrinkId` を後から付けても、量・度数・種類は送られた値（または既存値）が正。プリセットの再コピーはしない。`bottleId` を変えたら `drinkName` を新しいボトル名で上書き、null にしたら `drinkName` は残す。`photoIds` は差し替え（送った id の集合にする。外れた写真は削除 = R2 も消す）。

#### DELETE /api/drink-logs/:id

200 `{ "ok": true }`。物理削除。

### 4.4 my-drinks

**共通オブジェクト:** `id`, `name`, `drinkType`, `volumeMl`, `abvPercent`, `sortOrder`, `createdAt`, `updatedAt`

#### GET /api/my-drinks

`limit` / `cursor`。既定順は `sortOrder`。件数上限 30 なので 1 ページで足りることが多い。

#### POST /api/my-drinks

`name`（1〜40）, `drinkType`, `volumeMl`（1〜5000）, `abvPercent`（0〜100）, 任意 `sortOrder`（省略時は末尾）。量・度数の範囲は記録と同じ（[alcohol-calculation.md](features/alcohol-calculation.md)）。

ユーザーあたり **30 件**を超える作成は 400 `validation_error`（`name` ではなくルートレベルの `fields` キー `""` または `name` 以外の `count`）。キーは `count` とする。

成功: 201。

#### GET / PATCH / DELETE /api/my-drinks/:id

PATCH は部分更新。削除は物理削除。過去ログの `myDrinkId` は SET NULL（data-model 8）。ログの量・度数は変わらない。

#### POST /api/my-drinks/:id/log

1 タップ記録。**サーバーが自分のマイドリンクを読み、値をコピーする。**

```json
{
  "drunkAt": "2026-09-04T12:00:00.000Z",
  "memo": null
}
```

| 入力 | 扱い |
|---|---|
| drunkAt | 任意。4.3 の未来 15 分ルール |
| memo | 任意 |
| volumeMl / abvPercent / drinkType | **受け取らない** |

サーバーがコピーして保存する列: `drinkType`, `volumeMl`, `abvPercent`, `drinkName`（= `my_drinks.name`）, `myDrinkId`。`alcoholG` は再計算。`drunkOn` は `drunkAt` から算出。

- 他人・削除済み ID: 404。ログは作らない
- 成功: 201 と drink-log オブジェクト（`POST /api/drink-logs` と同じ形）
- 二重送信防止はクライアントのボタン disable とトースト undo（1-02）。Idempotency-Key は MVP では持たない

### 4.5 bottles

**共通オブジェクト:** data-model 6.3 の TS 名。`userId` なし。日付は `purchasedOn` / `openedOn` / `consumedOn`（`YYYY-MM-DD` \| null）、`consumedAt`（ISO \| null）。`priceJpy` は整数円または null。`status` は `sealed` \| `opened` \| `consumed`。`quantity` は無い（1 行 = 1 本）。

詳細・作成応答に `photos`（4.7 のメタ配列、最大 1）を含める。一覧は `thumbPhotoId`（無ければ null）と `thumbPhotoKind`（`photo` / `cutout` / null）だけにする。一覧応答にはフィルタ前の在庫数 `totalCount`（`view` 内の総数）と、種類ごと表示用の `countsByType`（`{ wine: 6, whisky: 3, ... }`。`view` 内）を含める（ヘッダーの「12 本」、ゴースト見出しの本数）。

#### GET /api/bottles

| クエリ | 説明 |
|---|---|
| `view` | `cellar`（既定。`sealed` + `opened`、`createdAt` 降順）\| `archive`（`consumed`、`consumedAt` 降順）\| `all`（ピッカー用） |
| `q` | 銘柄名・生産者の部分一致。最大 100 文字。空は未指定と同じ |
| `drinkType` | 7 種のいずれか |
| `status` | `sealed` \| `opened`（`view=cellar` 内の絞り込み。`archive` では無視） |
| `limit`, `cursor` | 2.7 |

ノート・記録のボトルピッカーは `view=all&q=` を使う（貯蔵庫の本も選べる）。

#### POST /api/bottles

必須: `name`, `drinkType`。`status` 省略時は `sealed`。**`count`（1〜12、省略時 1）** の本数だけ同じ属性の行を作る。`photoIds`（最大 1。同じ写真 id を N 行に付けることはできないため、**N ≥ 2 のときサーバーが photo 行を複製**する。R2 オブジェクトは 1 つを共有せず N 個にコピーする — 削除の独立性のため）。

成功: 201 `{ "items": Bottle[] }`（`createdAt` は同一、`id` は個別）。

#### GET / PATCH / DELETE /api/bottles/:id

PATCH は部分更新。`status` に送れるのは **`opened` のみ**（開栓。`openedOn` を省略したら今日）。`consumed` への変更は 4.5.1、戻しは 4.5.2 を使う。`consumedAt` / `consumedOn` は PATCH で受け取らない。`photoIds` は差し替え。

DELETE: ボトル写真は CASCADE（R2 も消す）。ノートの `bottleId` と記録の `bottleId` は SET NULL。本体は残る。貯蔵庫の本も削除できる。

#### 4.5.1 POST /api/bottles/:id/consume

```json
{
  "log": {
    "drunkAt": "2026-09-05T04:05:00.000Z",
    "volumeMl": 125,
    "abvPercent": 12,
    "memo": null
  }
}
```

| 入力 | 扱い |
|---|---|
| `log` | **null で記録なし**。オブジェクトなら drink-log を 1 件作る |
| `log.drunkAt` | 任意。4.3 の未来 15 分ルール。`consumedAt` はこれと同じ瞬間にする（省略時はサーバー現在時刻） |
| `log.volumeMl` / `log.abvPercent` | 必須（記録ありのとき）。範囲は 4.3 |
| `log.memo` | 任意 |

サーバー:

1. 自分のボトルで `status !== "consumed"` を確認。他人・不明・すでに消費済みは 404
2. `status = consumed`、`consumedAt`、`consumedOn`（JST 日）を更新
3. `log` があれば drink-log を作成: `drinkType` = ボトルの種類、`drinkName` = ボトル名、`bottleId` = このボトル、`alcoholG` 再計算
4. 2〜3 は同一トランザクション（D1 batch）

成功: 200 `{ "bottle": Bottle, "drinkLog": DrinkLog | null }`。

#### 4.5.2 POST /api/bottles/:id/restore

ボディなし。自分のボトルで `status === "consumed"` のとき、`openedOn` があれば `opened`、無ければ `sealed` に戻し、`consumedAt` / `consumedOn` を null にする。それ以外は 404。**記録は消さない**（undo で消すかはクライアントが `DELETE /api/drink-logs/:id` を続けて呼ぶ）。

成功: 200 `Bottle`。

#### 4.5.3 POST /api/bottles/recognize

ラベル写真から登録フォームの候補を返す。**DB には何も書かない**（利用回数以外）。画面: [screen-designs/04-cellar.md](screen-designs/04-cellar.md) B2。

`multipart/form-data`。パート `file`（切り抜く前の 2:3 JPEG。≦1MB、magic bytes 検証は 4.7 と同じ）。

```json
{
  "fields": {
    "name":       { "value": "サンプル赤", "confidence": 0.86 },
    "producer":   { "value": "サンプル生産者", "confidence": 0.71 },
    "origin":     { "value": "フランス", "confidence": 0.62 },
    "vintage":    { "value": 2020, "confidence": 0.9 },
    "drinkType":  { "value": "wine", "confidence": 0.95 },
    "abvPercent": { "value": 13.5, "confidence": 0.4 }
  },
  "provider": "workers-ai",
  "remainingToday": 27
}
```

| 規則 | 内容 |
|---|---|
| プロバイダ | **Cloudflare Workers AI**（binding `AI`。Vision 対応の指示追従モデル。導入時点の推奨モデル名は 4-07 で確定し `src/server/services/label-recognizer/` の定数に置く）。実装は `LabelRecognizer` インターフェースにし、将来 Gemini 等を差し替えられるようにする |
| プロンプト | サーバー固定。ユーザー入力を含めない。「JSON のみで返す」指示 + スキーマ例。言語は日本語ラベル・英語ラベル両対応 |
| 出力の扱い | モデル出力は **信頼しない入力**として Zod で検証する。`name` / `producer` / `origin` ≦100 文字、`vintage` 1800〜2100 の整数、`drinkType` 7 種、`abvPercent` 0〜100 小数 1 桁、`confidence` 0〜1。検証に落ちたフィールドは **省く**（全体を失敗にしない）。文字列は制御文字を除去 |
| 欠落 | 読めなかったフィールドは省く。`fields` が空でも 200 |
| 上限 | ユーザーごと **30 回 / 日（JST）**。`ai_usage` を先に加算し、超過は 429 `rate_limited`。失敗（502）は加算しない |
| タイムアウト | 20 秒。超過は 502 `upstream_error` |
| ログ | 件数・所要時間・成否のみ。画像・出力テキストをログに出さない |
| 保存 | 画像も結果も保存しない。写真の保存は別途 4.7 |

成功: 200。クライアントは確度 0.5 未満の候補を捨て、空欄にだけ入れる。

公開エンドポイントではない（認証必須）。外部ベンダーへの送信は無い（Cloudflare 内）。将来 Gemini 等の外部 API を足す場合は、送信先を設定画面の副文とプライバシー表記（Phase 8-01）に明記し、オーナー承認を得る。

### 4.6 tasting-notes

**共通オブジェクト:** data-model 6.4。API の評価は **`ratingX10`**（10〜50、5 刻み）。UI 表示は `/ 10`。`tastedOn` は JST 日。

詳細・作成応答に `photos` メタ配列を含める。一覧は `photoCount` と先頭 1 枚の `thumbPhotoId`。

#### GET /api/tasting-notes

| クエリ | 説明 |
|---|---|
| `bottleId` | 指定時、**自分のボトル**でなければ 404（空配列にしない。5-04） |
| `q` | 銘柄名（スナップショット）の部分一致。最大 100 文字 |
| `drinkType` | 7 種 |
| `ratingX10Min`, `ratingX10Max` | 10〜50、5 刻み。`min <= max` |
| `limit`, `cursor` | 2.7 |

#### POST /api/tasting-notes

| フィールド | 必須 | 備考 |
|---|---|---|
| bottleId | 任意 | 自分のボトルのみ（貯蔵庫の本も可）。他人・不明は 404 |
| drinkName | `bottleId` なしのとき必須 | ボトルありのときは**送っても無視**し、サーバーがボトルからコピー |
| drinkType | `bottleId` なしのとき必須 | 同上 |
| tastedOn | 必須 | JST 日。未来は 400 |
| appearance, aroma, taste, finish | 任意 | 各 ≦2000 |
| ratingX10 | 必須 | 10〜50、5 刻み |
| photoIds | 任意 | 自分の未紐付け写真 id、**最大 6**、配列順が `sortOrder` |

スナップショット方針は data-model 6.4。以降のボトル改名はノートに反映しない。

成功: 201（`photos` を含む）。

#### GET / PATCH / DELETE /api/tasting-notes/:id

PATCH で `bottleId` を付け替える場合、新しいボトルも自分のもの。スナップショット（`drinkName` / `drinkType`）は**新しいボトルから再コピー**する。`bottleId` を null にする場合は `drinkName` と `drinkType` が必須（都度入力に戻す）。`photoIds` は差し替え（配列順 = `sortOrder`。外れた写真は削除）。

DELETE: ノート写真は CASCADE（R2 も消す）。

### 4.7 photos

メタ（レスポンス。**`r2Key` は出さない**）:

| フィールド | 型 |
|---|---|
| id | string |
| contentType | `image/jpeg` \| `image/png` \| `image/webp` |
| byteSize | number |
| width, height | number \| null |
| bottleId | string \| null |
| tastingNoteId | string \| null |
| drinkLogId | string \| null |
| kind | `photo` \| `cutout` |
| sortOrder | number |
| createdAt, updatedAt | string |

所有者 3 列（`bottleId` / `tastingNoteId` / `drinkLogId`）は最大 1 つ（data-model CHECK）。すべて null は未紐付け（先アップロード。24h で GC）。`kind` はサーバー判定（WebP の VP8X alpha フラグ → `cutout`）。

#### POST /api/photos

`multipart/form-data`。**推奨フローは未紐付けで先にアップロードし、作成 API の `photoIds` で紐付ける**（[screen-designs/07-photo-capture.md](screen-designs/07-photo-capture.md)）。

| パート | 必須 | 説明 |
|---|---|---|
| `file` | 必須 | 画像本体。ファイル名はキーに使わない |
| `bottleId` | 任意 | 自分のボトル。他人は 404 |
| `tastingNoteId` | 任意 | 自分のノート。他人は 404 |
| `drinkLogId` | 任意 | 自分の記録。他人は 404 |
| `sortOrder` | 任意 | 整数。省略時 0 |

所有者の 2 つ以上の同時指定は 400。すべて無しは未紐付け。

サーバー:

1. MIME を **magic bytes** で検証する（クライアント申告・拡張子を信用しない）。許可は jpeg / png / webp。SVG / GIF / HEIC は 415
2. **1MB** 超は 413。長辺 **1600px** 超は 400（クライアント出力は 1280）
3. `r2_key` はサーバー生成（例 `{photoId}.jpg`）。`user_id` も元ファイル名もキーに含めない
4. `user_id` はセッションから付与
5. 紐付け先の枚数上限（記録 1 / ボトル 1 / ノート 6）を超えるなら 400

成功: 201 とメタ。

#### GET /api/photos/:id

メタのみ。他人は 404。

#### GET /api/photos/:id/content

認可後、R2 からストリーム。

| ヘッダ | 値 |
|---|---|
| Content-Type | 保存した `contentType` |
| Cache-Control | `private, max-age=300` |
| Content-Disposition | `inline` |

同一オリジンの `<img src>` に Cookie が付く。公開 CDN には載せない。ログにオブジェクト全量を出さない。

他人・不明は 404（403 にしない）。

#### PATCH /api/photos/:id

紐付けと `sortOrder`。未紐付け → ボトル / ノート / 記録。付け替え先も自分のリソース。所有者を 2 つ以上同時にセットしない。紐付け解除（すべて null）は可（24h で GC 対象になる）。

他人の photo id を自分のボトルに付けることはできない（`photos.user_id` 一致が必須）。

#### DELETE /api/photos/:id

メタ削除 + R2 削除。R2 失敗時は日次 GC で再試行。200 `{ "ok": true }`。

#### 未紐付け GC（`scheduled`）

- 対象: `bottle_id` / `tasting_note_id` / `drink_log_id` がすべて NULL かつ `created_at < now - 24h`
- R2 削除 → D1 削除の順。R2 が 404 でも D1 は消す
- 1 回の実行で最大 500 件。ログは件数のみ（キーや `user_id` を出さない）

---

## 5. ルート登録順（Hono / RPC）

ネストを浅くする。リソースごとに `Hono` を分け、`/api` に mount する。

```text
src/server/
  index.ts              # app 組み立て、secure-headers、onError / notFound、AppType の export
  app-env.ts            # Hono Env 型（Variables: auth, user）
  errors.ts             # ApiError と code ↔ status 対応表
  validation.ts         # validate(target, schema): zod-validator 共通ラッパー（失敗は 400 validation_error）
  middleware/auth.ts    # PUBLIC_API_ROUTES（公開パスの唯一のリスト）と createAuthGuard
  middleware/error.ts   # errorHandler / notFoundHandler
  routes/health.ts
  routes/me.ts
  routes/drink-logs.ts  # /summary を /:id より前
  routes/my-drinks.ts
  routes/bottles.ts
  routes/tasting-notes.ts
  routes/photos.ts
  services/             # 複数ルートで共有する業務ロジック
```

```text
1. secure-headers
2. 認証 MW（/api/* 全体。PUBLIC_API_ROUTES = GET /api/health, /api/auth/* は内部で除外）
3. /api/auth/*（Better Auth handler）
4. 業務ルート（/api/health, /api/me, …。固定パスを :id より前）
5. 未定義 /api/* → 404 { "error": "not_found" }（未認証なら 2 で 401）
```

認証 MW は公開ルートを自分で除外するので、登録順に依存せずログインが通る。Auth（Better Auth インスタンス）の組み立ては保護ルートと `/api/auth/*` でだけ行い、`GET /api/health` は D1 に触らない。

`export type AppType = ReturnType<typeof createApp>`（`src/server/index.ts`。2-03 で export 済み。2-04 の `hc<AppType>` が `src/client/lib/api.ts` で型のみ import して使う）。業務ルートは `createApp` 内の `.route()` チェーンに繋いで型に載せる。クライアント側の規約（staleTime・retry・401・hooks の置き場）は [02-tech-stack.md](02-tech-stack.md) 「クライアントのデータ取得（2-04 FIX）」。

---

## 6. `api-conventions` ルール

2-03 で [`.cursor/rules/api-conventions.mdc`](../.cursor/rules/api-conventions.mdc)（globs: `src/server/**`）に落とした。ルール側が実装制約の正本で、以下は要点。

1. ルートはリソース単位。チェーンは浅く、固定パスをパラメータより前に置く
2. 公開パスは一箇所（`/api/health`, `/api/auth/*`）。追加は spec 更新が先
3. ハンドラは `c.get("user").id` のみ使う。Zod に `userId` を置かない
4. 更新・削除は `and(eq(id), eq(userId))`
5. 入力は `src/shared` の Zod + `@hono/zod-validator`
6. エラーは共通ハンドラ。クライアントは `error` コードのみ。スタックはログだけ
7. 他人と未存在は 404 同一本文。403 を使わない
8. `alcoholG` はサーバー再計算。リクエストで受け取らない
9. レスポンス型を明示し `AppType` を export する
10. 写真キーはサーバー生成。`r2Key` を JSON に出さない
11. CORS を全開放しない

---

## 7. 対象外（今作らない）

| 項目 | 時期 |
|---|---|
| 目標設定 API | v1.x |
| 在庫金額サマリー、飲み頃アラート | v1.x |
| ノートと飲酒記録の同時作成 | v1.x（消費 → 記録は 4.5.1 で MVP） |
| 切り抜きと長方形の両方を保存 | v1.x（MVP はどちらか 1 枚） |
| Gemini / OpenAI 等の外部 Vision API | 将来。`LabelRecognizer` の差し替えで対応。外部送信の明記と承認が前提 |
| 記録・ノート写真の AI 推定（種類・度数） | 将来 |
| CSV エクスポート | 将来構想 |
| アカウント削除 API | 将来（FK CASCADE は data-model 済み） |
| パスワードリセットメール | Phase 8-03 |
| OAuth | Phase 8-04 |
| アプリ全体のレート制限 | Phase 8-05 |
| Idempotency-Key | 見送り（ボタン disable + undo） |
| 署名付き URL 発行 | 見送り（Worker GET を正とする） |
| 写真 multipart の確定バイト数・magic bytes | 4-04 |

---

## 8. 画面との対応（参照）

正本は [screens.md](screens.md)。API 側の対応だけ示す。

| 画面 ID | 主に使う API |
|---|---|
| auth-login / auth-signup | `/api/auth/*` |
| home | `GET /api/drink-logs/summary?period=day\|week`、`GET /api/my-drinks`、`POST /api/my-drinks/:id/log` |
| log-day | `GET /api/drink-logs?date=`、`POST /api/my-drinks/:id/log`、DELETE（undo） |
| log-new / log-edit | POST / PATCH `/api/drink-logs`（`photoIds`, `bottleId`）、`POST /api/photos`、`GET /api/bottles?view=all&q=` |
| mydrink-list / mydrink-new | `/api/my-drinks` |
| summary-week / summary-month | `GET /api/drink-logs/summary?period=week\|month` |
| bottle-list（棚） | `GET /api/bottles?view=cellar` |
| bottle-archive（貯蔵庫） | `GET /api/bottles?view=archive` |
| bottle-new / bottle-edit | `POST /api/bottles`（`count`, `photoIds`）、PATCH、`POST /api/photos`、`POST /api/bottles/recognize`（bottle-new のみ） |
| bottle-detail | `GET /api/bottles/:id`、`PATCH`（開栓）、`GET /api/tasting-notes?bottleId=&limit=3`、`GET /api/drink-logs?bottleId=&limit=3`、`POST /api/bottles/:id/restore` |
| bottle-consume | `POST /api/bottles/:id/consume`、undo: `restore` + `DELETE /api/drink-logs/:id` |
| note-list / note-detail / note-new / note-edit | `/api/tasting-notes`（`photoIds`）、`/api/photos`、`GET /api/bottles?view=all&q=` |
| photo-edit | `POST /api/photos`（未紐付け）、`DELETE /api/photos/:id`（破棄） |
| settings | `GET /api/me`、Better Auth ログアウト / 表示名 |

クライアントのルートガードは UX。認可の正は本 API。

---

## 9. 受け入れ（1-05 / 1-07）

- [x] `spec/api-design.md` を作成（1-05 承認済み）
- [x] 全データ API に認可ルール（セッション `userId`、404 統一）がある
- [x] 公開エンドポイントを列挙した（オーナー承認対象。1-07 で追加なし）
- [x] 404 統一（未存在 = 他人）を書いた
- [x] 計算の正はサーバー。クライアントの `alcoholG` を信じない
- [ ] 1-07 改訂（consume / restore / recognize / view / count / photoIds / drinkLogId / kind / GC）のオーナー承認

---

## 10. 関連

- [data-model.md](data-model.md)
- [screens.md](screens.md)
- [features/health.md](features/health.md)
- [features/alcohol-calculation.md](features/alcohol-calculation.md)（計算・範囲・休肝日）
- [01-requirements.md](01-requirements.md) 1.1〜1.4
- [roadmap/phase-01-design/05-api-design.md](../roadmap/phase-01-design/05-api-design.md)
- 実装: [roadmap/phase-02-platform/03-hono-api-structure.md](../roadmap/phase-02-platform/03-hono-api-structure.md)
- Better Auth: [Hono](https://www.better-auth.com/docs/integrations/hono)、[Email & Password](https://www.better-auth.com/docs/authentication/email-password)
