# 公開エンドポイント: GET /api/health

オーナー承認済み（2026-09-04）。Phase 0（0-04）で追加した公開 API。死活確認の契約は本パスのみ（`{ "ok": true }`）。8-05 で第二の公開 API `GET /api/config` を追加した（サイトキーだけ。[rate-limit-abuse.md](rate-limit-abuse.md)）。認証は付けない。Better Auth の `/api/auth/*` はログイン前に必要な別枠。

## 目的

デプロイとローカル起動の死活確認。本文に内部情報を出さない。

## 契約

| 方法 | パス | 認証 | レスポンス |
|---|---|---|---|
| GET | `/api/health` | なし | `{ "ok": true }` |

- スタックトレース、アカウント ID、シークレット、バインディング内部名は返さない
- 未定義の `/api/*` は共通エラー形式 `{ "error": "not_found" }` の 404（2-03 で `{ "ok": false }` から移行済み。存在推測を避けるため詳細は出さない）。未認証なら 404 より先に 401 になる
- 認証ミドルウェアの公開判定は `GET /api/health` と `GET /api/config` の完全一致、および `/api/auth/` 接頭辞（`HEAD` は Hono が GET として処理）。`POST /api/health` や `/api/health/…` は保護ルート扱い
- 本エンドポイントは Better Auth（D1）に触らない。死活確認が DB 障害に巻き込まれないようにする
- 成功契約 `{ "ok": true }` は変えない。キーは `ok` だけ。使用量・枠残・課金・内部メトリクスは出さない（8-06。[usage-monitoring.md](usage-monitoring.md)）

契約は `src/server/index.test.ts` で Hono の `app.request()` により固定する（0-06）。公開エンドポイントの一覧と認可の正本は [api-design.md](../api-design.md)。

## 対象外

- 認証付き API。公開 API の追加は [api-design.md](../api-design.md) 2.3 とオーナー承認が先（8-05 の `GET /api/config` 以外は増やさない）
- 詳細な readiness（D1/R2 接続確認はここではしない）
- 使用量ダッシュボードの代替（8-06。ダッシュボードで見る）
