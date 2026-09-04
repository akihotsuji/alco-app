# API設計

Phase 1-05 の成果物。Hono が公開する HTTP API の契約。実装は Phase 2 以降。クライアントは Hono RPC（2-04）で同じ型を使う。

- 状態: **承認済み**（#12 マージ）。範囲・丸めの数値は [features/alcohol-calculation.md](features/alcohol-calculation.md) を正とする
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
| 未定義 `/api/*` | Phase 2 で `{ "error": "not_found" }` に統一（現状は `{ "ok": false }`） | 共通エラー形式。health 成功は `{ "ok": true }` のまま |

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
- 未認証の保護ルートは **401** `{ "error": "unauthorized" }`
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
| 413 | `payload_too_large` | 写真サイズ超過（上限数値は 4-04） |
| 415 | `unsupported_media_type` | 許可外 MIME（SVG / GIF / HEIC 等） |
| 500 | `internal_error` | それ以外。スタック・SQL・内部パスは出さない |

- `fields` のキーはリクエストのフィールド名（camelCase）。Zod の内部 path 配列やスキーマファイルパスは出さない
- メッセージは日本語。値のエコーは最小（パスワードは絶対に返さない）
- 詳細は Workers Logs のみ。Cookie・トークン・パスワードをログらない
- Phase 0 の未定義ルート `{ "ok": false }` と 500 `{ "ok": false }` は **2-03 で本形式へ移行**する。`GET /api/health` の成功は変えない

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
- 全レスポンスに `hono/secure-headers`（CSP・X-Content-Type-Options 等）。CSP の詳細は 2-03

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
| GET | `/api/bottles` | 必須 | ボトル一覧（検索・絞り込み） |
| POST | `/api/bottles` | 必須 | ボトル作成 |
| GET | `/api/bottles/:id` | 必須 | 詳細（写真メタ含む） |
| PATCH | `/api/bottles/:id` | 必須 | 部分更新 |
| DELETE | `/api/bottles/:id` | 必須 | 削除（写真 CASCADE、ノートは残す） |
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

`GET /api/drink-logs/summary` は `GET /api/drink-logs/:id` より**先に登録**する（`summary` を id と誤認しない）。

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
| createdAt | string | ISO UTC |
| updatedAt | string | ISO UTC |

#### GET /api/drink-logs

| クエリ | 必須 | 説明 |
|---|---|---|
| `date` | `from`/`to` が無いとき必須 | 単一日（JST） |
| `from`, `to` | `date` が無いとき両方必須 | 閉区間の JST 日。`from <= to` |
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
  "myDrinkId": null
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

通常の POST で `myDrinkId` を付けるのは「どのプリセットから始めたか」の記録用。1 タップ（サーバーコピー）とは別経路。

成功: 201 と作成オブジェクト。

#### GET /api/drink-logs/:id

200 とオブジェクト。他人は 404。

#### PATCH /api/drink-logs/:id

送ったフィールドだけ更新。`drunkAt` を変えたら `drunkOn` を再計算。`volumeMl` / `abvPercent` を変えたら `alcoholG` を再計算。

`myDrinkId` を後から付けても、量・度数・種類は送られた値（または既存値）が正。プリセットの再コピーはしない。

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

**共通オブジェクト:** data-model 6.3 の TS 名。`userId` なし。日付は `purchasedOn` / `openedOn`（`YYYY-MM-DD` \| null）。`priceJpy` は整数円または null。`status` は `sealed` \| `opened` \| `finished`。

詳細・作成応答に `photos`（4.7 のメタ配列、`sortOrder` 昇順）を含める。一覧は `thumbPhotoId`（`sortOrder` 最小の写真 id、無ければ null）だけにする。

#### GET /api/bottles

| クエリ | 説明 |
|---|---|
| `q` | 銘柄名・生産者の部分一致。最大 100 文字。空は未指定と同じ |
| `drinkType` | 7 種のいずれか |
| `status` | `sealed` \| `opened` \| `finished` |
| `limit`, `cursor` | 2.7 |

飲み切りを一覧から外すかはクエリで足りる（デフォルトは全ステータス）。ノート作成ピッカーは `q` を再利用し、`finished` も含めてよい（5-04）。

#### POST /api/bottles

必須: `name`, `drinkType`。`status` 省略時は `sealed`。`quantity` 省略時は 1。その他は data-model どおり任意。

写真は別リクエスト（4.7）。成功: 201。

#### GET / PATCH / DELETE /api/bottles/:id

PATCH は部分更新。`status` と `quantity` は独立（data-model）。開栓ルールの詳細は 4-03。

DELETE: ボトル写真は CASCADE（R2 も消す）。ノートの `bottleId` は SET NULL。ノート本体は残る。

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
| bottleId | 任意 | 自分のボトルのみ。他人・不明は 404 |
| drinkName | `bottleId` なしのとき必須 | ボトルありのときは**送っても無視**し、サーバーがボトルからコピー |
| drinkType | `bottleId` なしのとき必須 | 同上 |
| tastedOn | 必須 | JST 日 |
| appearance, aroma, taste, finish | 任意 | 各 ≦2000 |
| ratingX10 | 必須 | 10〜50、5 刻み |

スナップショット方針は data-model 6.4。以降のボトル改名はノートに反映しない。

成功: 201。写真は作成後に 4.7 で添付。

#### GET / PATCH / DELETE /api/tasting-notes/:id

PATCH で `bottleId` を付け替える場合、新しいボトルも自分のもの。スナップショット（`drinkName` / `drinkType`）は**新しいボトルから再コピー**する。`bottleId` を null にする場合は `drinkName` と `drinkType` が必須（都度入力に戻す）。

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
| sortOrder | number |
| createdAt, updatedAt | string |

`bottleId` と `tastingNoteId` の同時セットは禁止（data-model CHECK）。両方 null は未紐付け（先アップロード）。

#### POST /api/photos

`multipart/form-data`。

| パート | 必須 | 説明 |
|---|---|---|
| `file` | 必須 | 画像本体。ファイル名はキーに使わない |
| `bottleId` | 任意 | 自分のボトル。他人は 404 |
| `tastingNoteId` | 任意 | 自分のノート。他人は 404 |
| `sortOrder` | 任意 | 整数。省略時 0 |

`bottleId` と `tastingNoteId` の同時指定は 400。どちらも無しは未紐付け。

サーバー:

1. MIME とサイズを**実体**で検証する（クライアント申告を信用しない）。許可は jpeg / png / webp。SVG / GIF / HEIC は 415
2. 上限バイトは 4-04（骨格のみ。実装まで仮に超えたら 413）
3. `r2_key` はサーバー生成（例 `{photoId}.jpg`）。`user_id` も元ファイル名もキーに含めない
4. `user_id` はセッションから付与

ノートあたり枚数は提案 **6**（5-01 で確定）。超過は 400。ボトルはスキーマ 1:N、MVP UI は 1 枚（4-01）。

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

紐付けと `sortOrder`。未紐付け → ボトル / ノート。付け替え先も自分のリソース。両方の ID を同時にセットしない。紐付け解除（両方 null）は可。

他人の photo id を自分のボトルに付けることはできない（`photos.user_id` 一致が必須）。

#### DELETE /api/photos/:id

メタ削除 + R2 削除。R2 失敗時の孤立掃除は 4-04。200 `{ "ok": true }`。

---

## 5. ルート登録順（Hono / RPC）

ネストを浅くする。リソースごとに `Hono` を分け、`/api` に mount する。

```text
src/server/
  index.ts              # app 組み立て、secure-headers、onError
  middleware/auth.ts    # 公開パス以外
  middleware/error.ts
  routes/health.ts
  routes/me.ts
  routes/drink-logs.ts  # /summary を /:id より前
  routes/my-drinks.ts
  routes/bottles.ts
  routes/tasting-notes.ts
  routes/photos.ts
```

```text
1. secure-headers
2. /api/health
3. /api/auth/*
4. 認証 MW（上記以外の /api/*）
5. 業務ルート（固定パスを :id より前）
6. 未定義 /api/* → 404 { "error": "not_found" }
```

Auth を MW で保護するとログイン不能になる。catch-all より前に Auth を置く。

`export type AppType = typeof app`（または route 合成型）を 2-03 / 2-04 で出す。

---

## 6. Phase 2 の `api-conventions` 草案

2-03 で `.cursor/rules/api-conventions.mdc`（globs: `src/server/**`）へ落とす項目。

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
| ノートと飲酒記録の同時作成 | v1.x |
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
| home | `GET /api/drink-logs/summary?period=day`、`GET /api/my-drinks`、`POST /api/my-drinks/:id/log` |
| log-day | `GET /api/drink-logs?date=`、PATCH / DELETE |
| log-new / log-edit | POST / PATCH `/api/drink-logs` |
| mydrink-list / mydrink-new | `/api/my-drinks` |
| summary-week / summary-month | `GET /api/drink-logs/summary?period=week\|month` |
| bottle-list / bottle-detail / bottle-new / bottle-edit | `/api/bottles`、`/api/photos`、`GET /api/tasting-notes?bottleId=` |
| note-list / note-detail / note-new / note-edit | `/api/tasting-notes`、`/api/photos`、`GET /api/bottles?q=` |
| settings | `GET /api/me`、Better Auth ログアウト / 表示名 |

クライアントのルートガードは UX。認可の正は本 API。

---

## 9. 受け入れ（1-05）

- [x] `spec/api-design.md` を作成（承認は本 PR）
- [x] 全データ API に認可ルール（セッション `userId`、404 統一）がある
- [x] 公開エンドポイントを列挙した（オーナー承認対象）
- [x] 404 統一（未存在 = 他人）を書いた
- [x] 計算の正はサーバー。クライアントの `alcoholG` を信じない

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
