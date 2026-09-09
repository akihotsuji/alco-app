# 運用手順（7-09）

オーナーがエージェントなしでも、Logs を見て復元を試みられる手順。値・トークン・SQL 本文・Cookie は書かない。コマンドは **2026-09-09** の wrangler 公式（Workers rollback / D1 Time Travel）に合わせた。バージョンが変わっていたら実行前に `--help` を見る。

- 状態: **作成済み**（2026-09-09）
- 監視の正本: [features/monitoring.md](features/monitoring.md)
- バックアップの正本: [features/d1-backup.md](features/d1-backup.md)
- デプロイの正本: [features/deploy-prod.md](features/deploy-prod.md)
- シークレット: [secrets.md](secrets.md)
- リリース当日: [release-checklist.md](release-checklist.md)

連絡先はオーナー自身。24 時間サポートは無い。

---

## 1. 環境

| | dev | 本番 |
|---|---|---|
| wrangler | `--env dev` | `--env production` |
| Worker | `alco-app-dev` | `alco-app-prod` |
| D1 | `alco-app-dev` | `alco-app-prod` |
| 写真 R2 | `alco-app-photos-dev` | `alco-app-photos-prod` |
| 公開ホスト | `workers.dev`（文書に URL を書かない） | `https://sake-shiori.com` |
| バックアップ R2 | 共通 `alco-app-d1-backups`（Worker に bind しない。キー接頭辞 `dev/` / `prod/`） | 同左 |

**本番と dev を取り違えない。** コマンドのデータベース名と `--env` を毎回声に出す。無引数の `wrangler deploy` は使わない。

スキーマ変更は **forward（additive）が原則**。破壊的 migrate のあとにコードだけ戻すと、新しい列を読む旧コードまたは旧列を読む新コードで壊れる。

---

## 2. よくある障害

| 症状 | 先に見ること | よくある原因 | 次 |
|---|---|---|---|
| 開けない / 真っ白 | `GET /api/health`、ホストが apex か | 未デプロイ、308 の途中、SW の古い HTML | health が死んでいればデプロイ。HTML だけなら [pwa.md](features/pwa.md) の SW |
| ログインできない | Workers Logs の `/api/auth/`、401 か 500 か | Auth secret 不一致、別オリジンの Cookie、期限切れ | [secrets.md](secrets.md) のローテーション影響。dev ユーザーを本番に使っていないか |
| 全体が 500 | Observability で `$workers.outcome = "exception"` | 未捕捉例外、D1 障害 | 3 章。短時間なら rollback（4 章） |
| 写真 404 | 自分の記録か、他人のを開いていないか | 未紐付け GC、R2 と D1 のズレ、別環境 | 自分の別写真が生きていればデータ。R2 誤削除は 5.3 |
| 認識が 429 / 502 / 503 | 日次上限、Gateway、プロファイル | 上限・上流障害・設定キー誤り | 手入力は止めない。[ai-recognition.md](features/ai-recognition.md) |
| CI / Deploy / Backup が赤い | GitHub の失敗メール | トークン期限、migrate 失敗 | Actions ログ。SQL は出さない実装 |

`wrangler d1 execute` にユーザー入力を連結しない。ログを public Issue に貼らない。

---

## 3. ログ

### 3.1 ダッシュボード

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **本番なら** `alco-app-prod`。dev なら `alco-app-dev`
3. Observability。エラーは `$metadata.error EXISTS` または `$workers.outcome = "exception"`
4. 週 1 で Metrics のエラー有無を目視

### 3.2 wrangler tail

常時は付けない。一時だけ。

```powershell
pnpm exec wrangler tail --env production
pnpm exec wrangler tail --env dev
```

サーバーはメソッドとパスだけを出す。クエリ・ヘッダー・ボディを足して調べない。

通知（任意）は `ALERT_WEBHOOK_URL`。未設定なら Logs のみ。[monitoring.md](features/monitoring.md) 7.3。

---

## 4. アプリコードのロールバック

直近 100 バージョンまで戻せる（公式 2026-09-09）。**D1 は戻らない。** R2 の写真も戻らない。

### 4.1 wrangler（確認日 2026-09-09）

```powershell
pnpm exec wrangler deployments list --env production
pnpm exec wrangler rollback --env production --message "revert to previous version"
```

特定バージョン:

```powershell
pnpm exec wrangler rollback <VERSION_ID> --env production --message "revert to named version"
```

`--message` を付けると確認プロンプトを飛ばせる。VERSION_ID とメッセージをチャットに残さない方がよい。

ダッシュボード: Worker `alco-app-prod` → Deployments → 戻したい版の Rollback。

### 4.2 前のタグを再デプロイ

タグ `vX.Y.Z` が残っていれば、そのタグで Deploy prod を承認する（[deploy-prod.md](features/deploy-prod.md)）。migrate は forward のみ。すでに新しい migrate が本番に当たっているときは、コードを戻す前に 1 章の additive 原則を読む。

バインディング先の D1 / R2 を消した版へは rollback できない（公式の制限）。

---

## 5. バックアップからの復元

**本番 D1 をいきなり上書きしない。** 7-04 の下書きと同じ。リハーサルは一時 DB `alco-app-d1-restore-rehearsal` だけ。

年 1 回は `mode=rehearse` を回す（prod / dev は触らない）。

### 5.1 Time Travel（Free は 7 日）

対象は **その名前の D1 をその場で上書き**する。

**本番**

```powershell
pnpm exec wrangler d1 info alco-app-prod
pnpm exec wrangler d1 time-travel info alco-app-prod
# いまのブックマークを控える（貼らない）
# 先に export を 1 本取ると安全（5.2）
pnpm exec wrangler d1 time-travel restore alco-app-prod --bookmark=<BOOKMARK>
```

**dev**（ドッグフード用。本番コマンドと混ぜない）

```powershell
pnpm exec wrangler d1 time-travel info alco-app-dev
pnpm exec wrangler d1 time-travel restore alco-app-dev --bookmark=<BOOKMARK>
```

undo は restore が返す「直前のブックマーク」へ再度 restore する。

### 5.2 export → 一時 D1（R2 に 14 日）

キー例（架空）: `prod/alco-app-prod-2026-09-09T170000Z.sql.gz`

```powershell
pnpm exec wrangler r2 object get alco-app-d1-backups/<key> --file=backups/restore.sql.gz --remote
# backups/ は gitignore。展開した .sql もコミットしない
pnpm exec wrangler d1 create alco-app-d1-restore-rehearsal
# wrangler.jsonc には足さない
pnpm exec wrangler d1 execute alco-app-d1-restore-rehearsal --remote --yes --file=backups/restore.sql
pnpm exec wrangler d1 execute alco-app-d1-restore-rehearsal --remote --command "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name;"
```

テーブル名だけ見る。行は出さない。終わったら消す。

```powershell
pnpm exec wrangler d1 delete alco-app-d1-restore-rehearsal --skip-confirmation
```

Actions の `mode=rehearse` はこれを自動化する。復元先が `alco-app-d1-restore-rehearsal` 以外なら失敗する。

本番へ載せる判断はオーナー。載せるファイルは一時 DB で確認したものだけ。その前に現行 prod を export する。

```powershell
pnpm exec wrangler d1 export alco-app-prod --remote --env production --output=backups/prod-before-restore.sql --skip-confirmation
```

### 5.3 写真 R2

オブジェクトバージョンは有効にしていない。誤削除・GC 済みの実体は **戻せない**。メタだけ残って 404 なら、ユーザーに撮り直し。バケットごと消した場合はバックアップが無い。

---

## 6. シークレットのローテーション

手順の正本は [secrets.md](secrets.md) 5〜6 章。

- Auth secret を回すとその環境のセッションが切れる
- **env 単位**。dev を回しても本番は変えない
- 誤コミットしたら先に無効化。`main` の force push はしない

---

## 7. リハーサルとの対応

[d1-backup.md](features/d1-backup.md) 8 章（2026-09-09）:

- 両 D1 は Time Travel 対象（`version: production`）
- バックアップバケット作成済み。Worker には bind していない
- リモート export → 一時 import の実実行は Actions `mode=rehearse`（オーナー）
- 本番上書きはしていない

本ファイルの 5.1 / 5.2 はその記録と同じコマンドである。
