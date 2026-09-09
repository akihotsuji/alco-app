# 7-05 監視（Workers Logs・エラー通知）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **完了**（2026-09-09。ウェブフック投入と ntfy 購読はオーナー） |
| 要件 | 個人利用はベストエフォート。ただしエラーに気づけること |
| ソース | Phase 7「Workers Logsの確認手順、エラー通知（Sentry無料枠 or Cloudflare通知）」 |

## 1. 概要

本番エラーをオーナーが知る経路を 1 つ作る。過剰な APM は不要。正本は [monitoring.md](../../spec/features/monitoring.md)。

## 2. 前提条件

- 本番デプロイ（7-02）
- ログに秘密を出さない実装（既存規約）

## 3. スコープ

**対象**

- Workers Logs の見方（ダッシュボード手順。7-09 で operations へ）
- エラー通知の選定と導入（Sentry 不採用。ウェブフック + Actions メール）
- クライアントの未処理エラーは拾わない（SDK でバンドル増）

**対象外**

- オンコール体制
- SLA
- メトリクスダッシュボードの美化

## 4. 成果物

- 選定結果（[monitoring.md](../../spec/features/monitoring.md)）
- `wrangler.jsonc` の `observability`
- `ALERT_WEBHOOK_URL`（任意 secret）と `src/server/services/error-alert.ts`
- 確認手順（7-09 にリンク）
- 想定外 500 の単体テスト。ライブ投入はオーナー

## 5. 細分化タスク

1. 選択肢比較（無料枠、PII、Workers 対応）
2. オーナー判断（本タスクで選定を確定）
3. 導入
4. 通知テスト（単体。実ウェブフックは投入後）
5. PII マスキング（メモ本文を通知に送らない）

## 6. 手順

```powershell
pnpm exec wrangler tail --env production
```

一時的なデバッグ。常時 tail はしない。

## 7. 仕様詳細

Sentry は依存と PII のため不採用。Cloudflare Notifications に Workers 専用の Free メールは無い。実行時は HTTPS ウェブフック、ジョブ失敗は Actions メール。

エラーレスポンスは引き続き汎用メッセージ。

## 8. 受け入れ条件

- [x] Logs の確認手順がある
- [x] エラー通知が 1 経路ある（ウェブフック + Actions メール）
- [x] テストで通知を確認した（想定外 500 → ウェブフック。ライブ投入はオーナー）
- [x] メモ・Cookie が通知に乗らない
- [x] 依存を足すなら PR に理由（足していない）

## 9. セキュリティ観点

- スタックをクライアントに出さない（監視 SDK は入れない）
- ソースマップを public に晒さない

## 10. 関連ファイル / 関連spec

- [monitoring.md](../../spec/features/monitoring.md)
- [09-operations-docs.md](09-operations-docs.md)
- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc) エラー

## 11. リスク・注意点

- ウェブフック未投入だと実行時は Logs 目視だけになる
- wrangler tail に Cookie が出る設定ミス
