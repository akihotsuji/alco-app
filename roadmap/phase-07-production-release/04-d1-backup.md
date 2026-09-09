# 7-04 D1日次バックアップ

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **ワークフロー済み**（2026-09-09。バケット作成済み。初回手動実行と `mode=rehearse` はオーナー） |
| 要件 | データ消失防止が最優先。日次バックアップ |
| ソース | Phase 7「Time Travel確認＋定期エクスポートをGitHub Actionsで実行」 |

## 1. 概要

D1 の Time Travel が使えることを確認し、それに加えエクスポートを定期実行する。復元リハーサルは本タスクまたは 7-09 で一度やる。

## 2. 前提条件

- 本番 D1（7-01）
- GitHub Actions から D1 を読めるトークン
- バックアップ保存先（別バケット `alco-app-d1-backups`。Worker に bind しない）

## 3. スコープ

**対象**

- Time Travel の保持と復元コマンドの確認（公式の現行仕様）
- cron 相当の Actions（`schedule`）で `wrangler d1 export`
- 保存先と保持世代（別バケット `alco-app-d1-backups`、14 日。正本は [d1-backup.md](../../spec/features/d1-backup.md)）
- 一度の復元リハーサル（dev DB で可）

**対象外**

- R2 写真のクロスリージョン複製（R2 は別途バージョン管理 **要確認**。最低でもバケット削除保護）
- 有料の外部バックアップ SaaS

## 4. 成果物

- workflow `backup-d1.yml`
- 仕様 [d1-backup.md](../../spec/features/d1-backup.md)（Time Travel メモ・復元下書き・リハーサル記録）
- 復元手順の下書き（7-09 に統合）

## 5. 細分化タスク

1. 公式ドキュメントで Time Travel の retention を確認する
2. export コマンドを dev で試す
3. 成果物を R2 に置くか GitHub artifact か。artifact は短期。**推奨 R2**
4. schedule: `0 17 * * *` UTC = JST 02:00（確定）
5. 失敗したら分かる（7-05 連携）
6. リハーサル: 空の一時 D1 に import

## 6. 手順

ローカル検証（データベース名は環境に合わせる）:

```powershell
pnpm exec wrangler d1 time-travel info DB
pnpm exec wrangler d1 export alco-app-prod --output backup.sql
```

出力ファイルをコミットしない。`.gitignore` に `*.sql.bak` 等。

Actions は `workflow_dispatch` も付けて手動実行できるようにする。

## 7. 仕様詳細

- 個人利用でも削除ミスが最大リスク。Time Travel だけに頼らず export を持つ（ロードマップ明示）
- バックアップファイルに PII（飲酒ログ）が含まれる。保存先 ACL を非公開
- 暗号化 at rest は R2 既定に依存。追加暗号化はしない（鍵を増やさない）

## 8. 受け入れ条件

- [x] Time Travel の確認メモがある（[d1-backup.md](../../spec/features/d1-backup.md)）
- [ ] 定期 export が Actions で動く（手動一回成功でも開始可。翌日の schedule を見る）
- [ ] 復元リハーサル済み（Phase 7 DoD。Actions の `mode=rehearse`。マージ後）
- [x] バックアップが git に無い（`/backups/` は gitignore）
- [x] 本番をリハーサルで上書きしていない（復元先は一時 D1 のみ）

## 9. セキュリティ観点

- export を public artifact にしない
- トークン権限を D1 読み取り + バックアップバケット書き込みに近づける
- ログに SQL の行内容を出さない

## 10. 関連ファイル / 関連spec

- [spec/01-requirements.md](../../spec/01-requirements.md) 可用性
- [09-operations-docs.md](09-operations-docs.md)

## 11. リスク・注意点

- Time Travel の仕様変更
- 無料 Actions の cron 遅延
- 写真は D1 に無いので、R2 誤削除は別災害。バケット名の確認
