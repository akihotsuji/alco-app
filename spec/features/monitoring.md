# 監視（7-05）

実装: Phase 7-05。手順は [05-monitoring.md](../../roadmap/phase-07-production-release/05-monitoring.md)。確認手順の正本は本ファイル。運用時の見方は [operations.md](../operations.md) 3 章。

- 状態: **7-05 済み**（2026-09-09）。Workers Logs は wrangler で有効。実行時エラーの通知は任意の `ALERT_WEBHOOK_URL`。ジョブ失敗は GitHub Actions のメール。ウェブフック投入と ntfy 購読はオーナー

---

## 1. 目的

本番（と dev）のエラーにオーナーが気づける経路を 1 つ以上持つ。過剰な APM は置かない。個人利用のベストエフォート。

---

## 2. 対象 / 対象外

**対象**

- Workers Logs / Traces の有効化（`wrangler.jsonc` の `observability`）
- ダッシュボードと `wrangler tail` での確認手順
- 実行時の未捕捉エラーを HTTPS ウェブフックへ送る（任意 secret）
- GitHub Actions（CI / Deploy / Backup D1）失敗のメール
- 通知ペイロードからメモ・Cookie・SQL・スタックを除外する

**対象外**

- Sentry SDK / Sentry プロジェクト（今は作らない）
- クライアントの未処理エラー収集（バンドル増。フォームのメモが混入しやすい）
- オンコール・SLA・メトリクスダッシュボードの美化
- Tail Workers（Workers Paid）
- Cloudflare Notifications の HTTP エラー率アラート（Enterprise）
- ソースマップの公開アップロード
- Slack / Discord 向けの本文変換

---

## 3. 選定

ロードマップは「Sentry 無料枠 or Cloudflare 通知」。2026-09-09 に公式を確認して次で確定する。

| 選択肢 | 無料枠 | PII | Workers | 依存 | 判定 |
|---|---|---|---|---|---|
| Sentry SDK / OTEL | イベント上限あり | メモ・フォームが入りやすい。DSN はクライアントに出る | 公式の OTEL 送信先はある | npm またはダッシュボード設定 + アカウント | **不採用** |
| Cloudflare Notifications のエラー率 | Workers 専用のメールは Free に無い。HTTP エラー率は Enterprise | ダッシュボード内 | メトリクスは見える | なし | ログ閲覧の補完にはする。**通知の本線には不足** |
| Tail Workers | Paid | 自分で制御 | あり | 別 Worker | **不採用** |
| HTTPS ウェブフック（推奨 ntfy.sh） | 先方の無料枠 | メソッド / パス / エラー名だけ | `fetch` | **なし** | **実行時エラーの本線** |
| GitHub Actions の失敗メール | GitHub Free | ジョブ名。SQL 本文は出さない（[d1-backup.md](d1-backup.md)） | CI / デプロイ / バックアップ | なし | **ジョブ失敗の本線** |

クライアント SDK は足さない。ソースマップを public に置かない（Sentry 不採用なので該当作業なし）。

---

## 4. Workers Logs

`wrangler.jsonc` のトップレベルと `env.dev` / `env.production` に同じ設定を置く（名前付き env は明示しないと乗らないことがある）。

```jsonc
"observability": {
  "enabled": true,
  "head_sampling_rate": 1,
  "logs": {
    "invocation_logs": true,
    "head_sampling_rate": 1
  },
  "traces": {
    "enabled": true,
    "head_sampling_rate": 1
  }
}
```

- 個人利用なのでサンプリングは 100%。無料枠は Workers Free で 20 万ログ/日・保持 3 日（[Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)）
- デプロイ後に有効になる。本設定のマージだけでは既存 Worker は変わらない
- invocation log にリクエスト URL が出ることがある。アプリはクエリに秘密を載せない。ダッシュボードのログを public Issue / PR に貼らない

---

## 5. 実行時エラー通知

未捕捉の 500（Hono の想定外例外、`handleFetch` の例外、日次 GC の例外）だけ送る。`ApiError` / Zod / 通常の 4xx は送らない。

| 項目 | 内容 |
|---|---|
| キー | `ALERT_WEBHOOK_URL` |
| 置き場 | wrangler secret（`env.dev` / `env.production`）。ローカルは `.dev.vars`（任意） |
| 未設定 | 送らない。Logs だけが残る |
| URL | `https:` のみ。userinfo（`user:pass@`）は拒否 |
| 本文 | JSON。`source` / `worker` / `kind` / `method` / `path` / `errorName` のみ |
| 冷却 | 同一 isolate で同じキーを 5 分に 1 回 |
| 失敗 | ウェブフック失敗は握りつぶす。リクエストの 500 本文は従来どおり `{ "error": "internal_error" }` |

`worker` は `CANONICAL_ORIGIN` があれば `alco-app-prod`、なければ `alco-app-dev`。

`kind` は `unhandled_error` / `scheduled_error` / `probe`。

推奨先は ntfy.sh。トピック名は `openssl rand -hex 16` で作り、チャットや git に貼らない。アプリは ntfy 専用ヘッダーを付けない（汎用 JSON POST）。

公開の 500 エンドポイントは作らない。確認は単体テストと `pnpm probe:alert`（`kind=probe`）。

---

## 6. ジョブ失敗

次が失敗すると GitHub がウォッチ設定に従ってメールする。追加の SaaS は置かない。

- `CI`
- `Deploy dev`
- `Deploy prod`
- `Backup D1`

オーナー作業: GitHub → Settings → Notifications で Actions の失敗が届くこと。リポジトリを Watch する。

---

## 7. 確認手順（運用時は [operations.md](../operations.md) 3 章も見る）

### 7.1 ダッシュボード

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) を開く
2. `alco-app-prod` または `alco-app-dev` を選ぶ
3. **Observability**
4. エラーだけ見るときは `$metadata.error EXISTS` または `$workers.outcome = "exception"`
5. 週 1 で Metrics のエラー有無を目視する

値・Cookie・SQL が出ていてもチャットに貼らない。

### 7.2 wrangler tail

一時デバッグだけ。常時は付けない。

```powershell
pnpm exec wrangler tail --env dev
pnpm exec wrangler tail --env production
```

サーバー実装はメソッドとパスだけを自前ログに出す。クエリ・ヘッダー・ボディを足して調べない。

### 7.3 ウェブフック投入（オーナー）

```powershell
pnpm exec wrangler secret put ALERT_WEBHOOK_URL --env dev
pnpm exec wrangler secret put ALERT_WEBHOOK_URL --env production
```

投入後に対象 env をデプロイする（secret put だけではコードは変わらない。既存 secret はデプロイで消えない）。

確認（値はシェルの環境変数だけに置き、チャットに出さない）:

```powershell
pnpm probe:alert
```

---

## 8. 通知テスト記録

| 項目 | 結果 |
|---|---|
| 日付 | 2026-09-09 |
| 単体 | 想定外 500 でウェブフックが 1 回飛び、本文に Cookie / メモ / SQL / スタックが無い |
| ライブ 500 | 公開プローブ API は作らない。`probe` は同じ送信関数。ウェブフック投入後の実送信はオーナー |
| Actions メール | 既存の失敗通知。追加コードなし |

---

## 9. テスト

- `src/server/services/error-alert.test.ts`: URL 検証、本文のキー、PII 除外、未設定スキップ、冷却、fetch 失敗でも投げない
- `src/server/middleware/error.test.ts`: 想定外 500 だけ送る
- `src/server/index.test.ts`: GC 失敗で `scheduled_error` を送る
- `src/ci/wrangler-env.test.ts`: 両 env で observability が有効
- `src/ci/secrets-inventory.test.ts`: `ALERT_WEBHOOK_URL` をインベントリに含める

---

## 関連

- [d1-backup.md](d1-backup.md)（ジョブ失敗のメール）
- [secrets.md](../secrets.md)
- [dev-deploy.md](../dev-deploy.md)
- [production-env.md](production-env.md)
- [05-monitoring.md](../../roadmap/phase-07-production-release/05-monitoring.md)
- [09-operations-docs.md](../../roadmap/phase-07-production-release/09-operations-docs.md)
