# 運用手順（7-09）

オーナーがエージェントなしでも、Logs を見て復元を試みられる手順。値・トークン・SQL 本文・Cookie は書かない。コマンドは **2026-09-09** の wrangler 公式（Workers rollback / D1 Time Travel）に合わせた。バージョンが変わっていたら実行前に `--help` を見る。

- 状態: **作成済み**（2026-09-09）。8-05 で WAF / 誤ブロック解除を追記（2026-09-10）。8-06 で使用量の週次確認を 9 章に追加。10 章で 0010 によるボトル写真消失を追記（2026-09-12）
- 監視の正本: [features/monitoring.md](features/monitoring.md)
- 使用量の正本: [features/usage-monitoring.md](features/usage-monitoring.md)
- バックアップの正本: [features/d1-backup.md](features/d1-backup.md)
- デプロイの正本: [features/deploy-prod.md](features/deploy-prod.md)
- シークレット: [secrets.md](secrets.md)
- リリース当日: [release-checklist.md](release-checklist.md)

連絡先はオーナー自身。24 時間サポートは無い。アプリ内のご意見は設定から受け、Resend で届く（[feedback.md](features/feedback.md)）。返信は任意。

---

## 1. 環境

| | dev | 本番 |
|---|---|---|
| wrangler | `--env dev` | `--env production` |
| Worker | `alco-app-dev` | `alco-app-prod` |
| D1 | `alco-app-dev` | `alco-app-prod` |
| 写真 R2 | `alco-app-photos-dev` | `alco-app-photos-prod` |
| 公開ホスト | `workers.dev`（文書に URL を書かない） | `https://sake-shiori.com` |
| バックアップ R2 | 共通 `alco-app-d1-backups`（Worker に bind しない。キー接頭辞 `dev/` / `prod/` / `prod/pre-migrate/`） | 同左 |

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
| 正規ユーザーがログインできない（確認は通る） | WAF / Rate limiting がブロックしていないか（8 章） | 厳しすぎるルール、全世界ブロック | ルールを無効化またはログモードへ戻す。閾値は緩める |
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

キー例（架空）: `prod/alco-app-prod-2026-09-09T170000Z.sql.gz`（日次）。Deploy prod が未適用 migrate の直前に取った分は `prod/pre-migrate/` 配下。

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

### 5.4 アカウント削除台帳の再適用

退会済みユーザーがバックアップや Time Travel で復活しないようにする。正本は [account-deletion.md](features/account-deletion.md)。アプリ Worker にバックアップ SQL は読ませない。

1. 一時 D1 で中身を確認する。本番をいきなり上書きしない
2. 現行 D1 の `account_deletion_records` で `replicated_at IS NULL` が無いか確認する。未転記があれば、サービス再開前に写真 R2 の `account-deletion-ledger/{userId}` へ回収できるか見る
3. 現行 D1 喪失など、台帳の完全性を確認できないときは復元データを公開しない
4. 復元後、サービス再開前に台帳の `user_id` を再削除する（`user` 削除で CASCADE。旧セッションは使えない）
5. 未転記が残る状態では再開しない

再適用は `reapplyAccountDeletionLedger`（写真 R2 の台帳プレフィックスを列挙し、キーから `userId` を取り `user` を消す）。キーと本文の `userId` が一致しないオブジェクトは使わない。

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

---

## 8. WAF / レート制限（8-05）

数値ルールは **ダッシュボードだけ**。コードと本ファイルに閾値を書かない。Workers 有料の Rate Limiting バインディングは使わない。

### 8.1 場所

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) → 対象ゾーン（本番は `sake-shiori.com`）
2. Security → WAF / Rate limiting rules
3. 対象は `/api/auth*` の POST など。アプリ Worker のコードには出さない

### 8.2 始め方

- **ログ（模擬）モード**から見る。正規ユーザーの誤ブロックを先に確認する
- 全世界ブロックはしない
- バイパス IP を広くしない
- IPv6 / 共有 NAT を想定し、緩めの値から始める

### 8.3 誤ブロックの解除

1. 該当ルールを無効化する、またはログモードへ戻す
2. 閾値を緩める（値はチャットや Issue に残しすぎない）
3. Turnstile キーの片方欠けは、ウィジェットも検証も無効になる（[rate-limit-abuse.md](features/rate-limit-abuse.md)）。両方揃っているかを [secrets.md](secrets.md) で確認する

アプリ側の写真日次上限はユーザー単位（セッション）。IP ヘッダではバイパスできない。

---

## 9. 無料枠の使用量（8-06）

正本は [usage-monitoring.md](features/usage-monitoring.md)。数字のコピーは [02-tech-stack.md](02-tech-stack.md)。確認日を見て古ければ公式を開き直す。

**使用量を `GET /api/health` や `GET /api/config` に出さない。** 課金額・アカウント ID を spec や Issue に書かない。

### 9.1 週次（エラー目視と同じ週）

1. Workers `alco-app-prod` の Metrics（リクエスト/日、CPU 超過、Error 1027 / 1102）
2. D1 `alco-app-prod` の行読取・書込・容量
3. R2 `alco-app-photos-prod` と `alco-app-d1-backups` の保存量（合算が 10 GB 枠）
4. Workers AI の Neurons、AI Gateway の支出
5. Resend の通数、GitHub Actions の artifact

80% を超えたら usage-monitoring 6 章。

### 9.2 新規登録の一時停止

招待制は使わない。`SIGNUPS_CLOSED=1` を対象 env の wrangler `vars` に入れてデプロイする。メール登録と Google 新規だけ止まる。戻すときは `0`。

### 9.3 予算アラート（オーナー）

- Cloudflare: Manage Account → Billing → Billable Usage → Budget alert（情報のみ。使用は止まらない）
- AI Gateway: spend limits（超過は 429。手入力は続く）

Paid（月 5 USD）に進む条件は usage-monitoring 8 章。

---

## 10. ボトル写真がシルエットだけになる（0010 / D1 FK）

症状: ボトル詳細が種類別 SVG だけ。`GET /api/bottles/:id` の `photos` が空。撮影してラベルは読めたが画像が無い、と見える。

原因: 2026-09-11 の本番デプロイで `0010_shared_cellar` が `bottles` を再作成した。D1 は `PRAGMA foreign_keys=OFF` を無視する（[公式](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)）。`DROP TABLE bottles` が `photos.bottle_id` の CASCADE を実行し、ボトル写真行が消えた。同じ DROP で `drink_logs.bottle_id` / `tasting_notes.bottle_id` は SET NULL。ボトル行自体と R2 オブジェクトは残る。ローカルの `node:sqlite` 同一接続では PRAGMA が効くため、既存の migrations テストだけでは検知できなかった。

確認（値・氏名・銘柄は出さない。件数だけ）:

```powershell
pnpm exec wrangler d1 execute alco-app-prod --remote --env production --command "SELECT COUNT(*) AS bottles FROM bottles;"
pnpm exec wrangler d1 execute alco-app-prod --remote --env production --command "SELECT COUNT(*) AS bottle_photos FROM photos WHERE bottle_id IS NOT NULL;"
pnpm exec wrangler d1 execute alco-app-prod --remote --env production --command "SELECT COUNT(*) AS logs_unlinked FROM drink_logs WHERE bottle_id IS NULL;"
```

R2 の実体は `photos` 行が消えても残っていることがある（CASCADE は D1 だけ）。キーはサーバー生成 UUID。バックアップの旧行から戻せる。

復旧（本番をいきなり上書きしない。5 章）:

1. 現行 prod を export して控える
2. 0010 適用前のバックアップを一時 D1 へ。候補: `prod/alco-app-prod-2026-09-10T192922Z.sql.gz`（2026-09-10 19:29 UTC。0010 は 2026-09-11 14:47 UTC）。当時は Deploy prod の migrate 直前バックアップが無かった。ギャップ分は Time Travel（Free は 7 日）。以降の破壊的 migrate は `prod/pre-migrate/` を先に見る
3. 一時 DB で `photos.bottle_id IS NOT NULL` の行を見る。現行 prod に同じ `id` が無ければ、現行 `bottles.cellar_id` を付けて `user_id=NULL` で戻す
4. 記録・ノートはバックアップで `bottle_id` があり現行が NULL、かつそのボトルが残っている行だけ戻す
5. `GET /api/photos/:id/content` で自分の 1 枚だけ確認してから次へ

撮り直しは R2 が無い行だけ。チェックリストや Issue に SQL 本文・Cookie・氏名を貼らない。
