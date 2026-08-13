# 7-09 運用ドキュメント作成

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **未着手** |
| 要件 | 障害時確認、バックアップ復元。ロールバック文書化（Phase 7 DoD） |
| ソース | Phase 7「→ spec/operations.md」 |

## 1. 概要

オーナーが深夜にエージェントなしでも、Logs を見て復元を試みられる手順書。値やトークンは書かない。

## 2. 前提条件

- 7-04 のリハーサル結果
- 7-05 の Logs / 通知
- 7-02 のデプロイ方法

## 3. スコープ

**対象**

- `spec/operations.md`
- 障害時の確認順
- D1 復元
- Worker ロールバック（前バージョンデプロイ）
- R2 誤削除時のできること/できないこと

**対象外**

- 24 時間サポート契約
- ランブック自動化の全部

## 4. 成果物

- `spec/operations.md`
- spec/README 更新
- Phase 7 DoD: ロールバック手順が文書化されている

## 5. 細分化タスク

1. 症状 → 確認コマンドの表
2. デプロイロールバック（Git tag を再デプロイ）
3. D1 restore（Time Travel / import）
4. 連絡先は「オーナー自身」だけでよい
5. 年 1 回復元リハーサルを推奨と書く

## 6. 手順

`spec/operations.md` 構成案:

1. 環境一覧（dev/prod URL は書いてもよい。secret は不可）
2. よくある障害（ログインできない、500、写真 404）
3. Workers Logs / wrangler tail（注意: PII）
4. ロールバック
5. バックアップからの復元（7-04 の実コマンドを一般化）
6. シークレットローテーション（7-03 リンク）

コマンド例はプレースホルダ:

```powershell
pnpm exec wrangler rollback --env production
# 実際のサブコマンドは公式の現行に合わせ、書く前に wrangler rollback --help
```

## 7. 仕様詳細

ロールバックの定義:

- アプリコード: 前の成功 commit を再デプロイ
- DB: 後方互換のない migrate を出した後はコードだけ戻すと壊れる。**migrate は additive を原則** と operations に書く
- 写真: 削除の復元は R2 バージョンが無ければ不可と明記

## 8. 受け入れ条件

- [ ] `spec/operations.md` がある
- [ ] 復元手順がリハーサルと一致
- [ ] ロールバックが書いてある（Phase 7 DoD）
- [ ] 秘密値がない
- [ ] spec/README 更新

## 9. セキュリティ観点

- 障害対応中に `wrangler d1 execute` でユーザー入力を連結しない
- ログの貼り付け先を public issue にしない

## 10. 関連ファイル / 関連spec

- [04-d1-backup.md](04-d1-backup.md)
- [05-monitoring.md](05-monitoring.md)
- [08-release-checklist.md](08-release-checklist.md)

## 11. リスク・注意点

- コマンドが wrangler のバージョンで変わる。ドキュメントに確認日を書く
- 本番 restore を dev 手順と取り違える。見出しで環境を色分け（Markdown の注意書き）
