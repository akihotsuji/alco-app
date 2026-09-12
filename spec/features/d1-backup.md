# D1日次バックアップ（7-04）

実装: Phase 7-04。手順は [04-d1-backup.md](../../roadmap/phase-07-production-release/04-d1-backup.md)。

- 状態: **7-04 ワークフロー済み**（2026-09-09）。バケット `alco-app-d1-backups` 作成済み。初回の手動実行と `mode=rehearse` はオーナー

---

## 1. 目的

削除ミスや誤 migrate で飲酒ログが消えても戻せるようにする。Time Travel だけに頼らず、SQL エクスポートを非公開 R2 に日次で残す。

---

## 2. 対象 / 対象外

**対象**

- Time Travel の現行仕様確認（保持期間・in-place 復元）
- `.github/workflows/backup-d1.yml`（`schedule` + `workflow_dispatch`）
- Deploy prod が未適用 migrate を検知したときの本番 D1 事前バックアップ（[deploy-prod.md](deploy-prod.md)）
- `wrangler d1 export --remote` の成果を gzip して R2 へ置く
- 保持 14 日（R2 lifecycle）
- 復元手順の正本は [operations.md](../operations.md)（本ファイル 7 章は要約）
- 一時 D1 への import リハーサル（本番・dev を上書きしない）

**対象外**

- R2 写真のクロスリージョン複製・バージョン管理（最低限、写真バケットは非公開のまま）
- 有料の外部バックアップ SaaS
- Cloudflare Workflows による export（新しいサービスを増やさない。正は GitHub Actions）
- バックアップファイルの追加暗号化（クライアント側鍵）
- Time Travel restore の自動化（in-place で危険）
- GitHub Actions artifact への SQL アップロード（リポジトリが public）

---

## 3. 確定事項（タスクの「要確認」）

| 項目 | 決定 | 理由 |
|---|---|---|
| 保存先 | 別バケット `alco-app-d1-backups` | 写真バケットと混ぜない。誤 GC と権限の範囲を分ける |
| Worker binding | **付けない** | アプリからバックアップ SQL を読めなくする。`wrangler.jsonc` に名前を書かない |
| 公開 | 無効（r2.dev / カスタムドメインを付けない） | SQL に PII（飲酒ログ・メール）が含まれる |
| 保持 | 14 日 | Time Travel 無料枠は 7 日。それより長く手元に残す |
| 追加暗号化 | しない | R2 の既定 SSE（at rest）に依存。鍵を GitHub Secrets に増やさない |
| 時刻 | `0 17 * * *` UTC（JST 02:00） | export は対象 D1 をブロックする。夜間に実行する |
| 対象 DB | 日次は `alco-app-prod` と `alco-app-dev` | ドッグフードは dev。本番も同じジョブで取る |
| 失敗通知 | Actions の失敗メール。確認手順は [monitoring.md](monitoring.md) | 最低限「失敗したら分かる」 |

---

## 4. Time Travel 確認メモ（2026-09-09）

公式: [Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)（確認日 2026-09-09。ページ更新 2026-04-21）。保持の上限は [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)。

- **常時 ON**。有効化作業は不要。ブックマークは Cloudflare 側が作る
- 復元・履歴に追加課金は無い
- 保持: Workers **Free は 7 日**、Paid は 30 日。分単位で戻せる
- 対象は production ストレージの D1。`wrangler d1 info` / API の `version` が `production` なら使える。`alpha` は旧スナップショット API のみ（使わない）
- **restore は対象 DB をその場で上書きする**。フォーク／クローンは未提供。誤って本番に向けると現在のデータが消える
- 飛行中のクエリはキャンセルされる。undo は restore が返す「直前のブックマーク」へ再度 restore する
- コマンド（値・ブックマークはチャットや PR に貼らない）:

```powershell
pnpm exec wrangler d1 info alco-app-prod
pnpm exec wrangler d1 time-travel info alco-app-prod
pnpm exec wrangler d1 time-travel restore alco-app-prod --bookmark=<BOOKMARK>
```

2026-09-09 の API 確認: `alco-app-prod` と `alco-app-dev` はどちらも `version: production`（Time Travel 対象）。legacy の `wrangler d1 backup` は使わない。

Time Travel は短い窓の誤操作向け。14 日超や「DB ごと消した」場合は export から一時 D1 へ戻す。

---

## 5. 起動条件

| 起動 | 動作 |
|---|---|
| `schedule` `0 17 * * *` UTC | `mode=backup`。prod と dev を順に export → R2 |
| `workflow_dispatch` で `mode=backup` | 同じ。`database` が `both` / `alco-app-prod` / `alco-app-dev` |
| `workflow_dispatch` で `mode=rehearse` | **一時 D1** `alco-app-d1-restore-rehearsal` へ import。prod / dev は上書きしない。既定の export 元は dev |
| `pull_request` / `pull_request_target` | 起動しない |
| `main` への push | 起動しない（デプロイワークフローとは分ける） |
| Deploy prod（未適用 migrate あり） | 本番 D1 だけを export → `prod/pre-migrate/`。失敗したら migrate しない |
| Deploy prod（未適用 0 件） | このバックアップはしない。日次分は残る |

`.github/workflows/ci.yml` は検証のみのまま。バックアップも Cloudflare シークレットも参照しない。

---

## 6. バックアップ手順（CI 内）

認証は GitHub Secrets の名前だけを使う。値はログに出さない。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

トークン権限は [dev-deploy-ci.md](dev-deploy-ci.md) と同じ（D1 Edit、Workers R2 Storage Edit）。Account 全権限は付けない。

1. バケット `alco-app-d1-backups` が無ければ作成する（`--update-config` は付けない）
2. lifecycle を `src/ci/d1-backup-lifecycle.json` で 14 日期限に揃える（`-y`）
3. 対象ごとに `wrangler d1 export <name> --remote --output=... --env <dev|production> --skip-confirmation`
4. gzip（`-n`）。ローカル SQL は残さない
5. `wrangler r2 object put alco-app-d1-backups/<key> --file=... --remote`
6. ログには **バイト数と sha256 だけ**。SQL 本文・`INSERT`・メール・**すべての http(s) URL** は出さない（`wrangler d1 export` は約1時間有効の presigned URL を stdout に出す）
7. 作業ファイルを消す

オブジェクトキー（日次）: `{prod|dev}/{database}-{YYYY-MM-DDThhmmss}Z.sql.gz`  
例（架空）: `prod/alco-app-prod-2026-09-09T170000Z.sql.gz`

オブジェクトキー（Deploy prod の migrate 直前）: `{prod|dev}/pre-migrate/{database}-{YYYY-MM-DDThhmmss}Z.sql.gz`  
例（架空）: `prod/pre-migrate/alco-app-prod-2026-09-11T144700Z.sql.gz`

`actions/upload-artifact` は使わない。`contents: write` も付けない。

---

## 7. 復元手順（要約。正本は [operations.md](../operations.md) 5 章）

**本番 D1 を直接上書きしない。** 先に一時 DB で中身を確認する。

### 7.1 Time Travel（直近 7 日・Free）

1. `wrangler d1 time-travel info alco-app-prod` でいまのブックマークを控える（チャットに貼らない）
2. 戻したい時刻の `--timestamp` または `--bookmark` を確認する
3. **本当にその DB でよいか**名前を読み直す。`alco-app-prod` と `alco-app-dev` を取り違えない
4. `wrangler d1 time-travel restore <その DB> --bookmark=...` は in-place。実行前に export を 1 本取ると安全

### 7.2 export から一時 D1 へ（14 日以内の R2）

```powershell
pnpm exec wrangler r2 object get alco-app-d1-backups/<key> --file=backups/restore.sql.gz --remote
# backups/ は gitignore 済み。展開した .sql もコミットしない
```

```powershell
pnpm exec wrangler d1 create alco-app-d1-restore-rehearsal
# wrangler.jsonc には足さない
pnpm exec wrangler d1 execute alco-app-d1-restore-rehearsal --remote --yes --file=backups/restore.sql
pnpm exec wrangler d1 execute alco-app-d1-restore-rehearsal --remote --command "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name;"
```

テーブル名だけ見て、行内容は出さない。問題なければ一時 DB を消す。

```powershell
pnpm exec wrangler d1 delete alco-app-d1-restore-rehearsal --skip-confirmation
```

本番へ載せる判断はオーナー。載せるときも一時 DB で確認したファイルだけを使い、先に現行 prod を export する。

Actions の `mode=rehearse` は 7.2 を自動化する。復元先名が `alco-app-d1-restore-rehearsal` 以外なら失敗する。

復元後のサービス再開前に、アカウント削除台帳を再適用する。手順の正本は [operations.md](../operations.md) 5.4 と [account-deletion.md](account-deletion.md)。未転記の outbox がある、または台帳の完全性を確認できないときは復元データを公開しない。アプリ Worker にバックアップ SQL は読ませない。

---

## 8. リハーサル記録

| 項目 | 結果 |
|---|---|
| 日付 | 2026-09-09 |
| Time Travel 対象 | 両 D1 とも `version: production`（API。ブックマーク値は残していない） |
| バックアップバケット | `alco-app-d1-backups` を非公開で作成。Worker には bind していない |
| リモート export → 一時 import | エージェント環境は `wrangler login` 不可。マージ後に Actions の `mode=rehearse` で実施する |
| 本番上書き | していない。restore / execute --file を prod / dev に向けていない |
| データ中身 | 記録していない（SQL をチャット・PR に貼っていない） |

---

## 9. テスト

- `src/ci/d1-backup.test.ts`: 対象の解釈、オブジェクトキー（日次 / pre-migrate）、未適用 migrate 判定、14 日 lifecycle、復元先の拒否、ログから SQL / メール / 署名付き URL を消す、ファイル要約が本文を返さない
- `src/ci/backup-d1-workflow.test.ts`: schedule、artifact 禁止、prod 上書き禁止、公開ログ対策
- `src/ci/deploy-prod-workflow.test.ts`: migrate 前の本番 D1 export と `prod/pre-migrate/` キー
- `src/ci/wrangler-env.test.ts`: バックアップバケットを Worker に bind しない

---

## 関連

- [production-env.md](production-env.md)
- [deploy-prod.md](deploy-prod.md)
- [dev-deploy-ci.md](dev-deploy-ci.md)
- [secrets.md](../secrets.md)
- [04-d1-backup.md](../../roadmap/phase-07-production-release/04-d1-backup.md)
- [09-operations-docs.md](../../roadmap/phase-07-production-release/09-operations-docs.md)
