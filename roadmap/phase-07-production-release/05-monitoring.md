# 7-05 監視（Workers Logs・エラー通知）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **未着手** |
| 要件 | 個人利用はベストエフォート。ただしエラーに気づけること |
| ソース | Phase 7「Workers Logsの確認手順、エラー通知（Sentry無料枠 or Cloudflare通知）」 |

## 1. 概要

本番エラーをオーナーが知る経路を 1 つ作る。過剰な APM は不要。

## 2. 前提条件

- 本番デプロイ（7-02）
- ログに秘密を出さない実装（既存規約）

## 3. スコープ

**対象**

- Workers Logs の見方（ダッシュボード手順を operations へ）
- エラー通知の選定と導入
- クライアントの未処理エラーを拾うかは **要確認**（Sentry なら SDK。バンドル増）

**対象外**

- オンコール体制
- SLA
- メトリクスダッシュボードの美化

## 4. 成果物

- 選定結果（Sentry or Cloudflare 通知 or 両方）
- 導入コードまたはダッシュボード設定
- 確認手順（7-09 にリンク）
- 意図的に 500 を一度出して通知が来ること（dev で可）

## 5. 細分化タスク

1. 選択肢比較（無料枠、PII、Workers 対応）
2. オーナー判断
3. 導入
4. 通知テスト
5. PII マスキング（メモ本文を Sentry に送らない）

## 6. 手順

調査してから実装。Sentry を使う場合:

- DSN はクライアントに出る。秘密というよりプロジェクト識別子
- `sendDefaultPii` をオフ
- フォームのメモを breadcrumb に載せない

Cloudflare 通知: Workers の失敗率やログアラートの現行機能をドキュメントで確認。

```powershell
pnpm exec wrangler tail --env production
```

一時的なデバッグ。常時 tail はしない。

## 7. 仕様詳細

**要確認**: Sentry vs Cloudflare のみ。個人アプリなら Cloudflare メール通知 + 週 1 Logs 目視でも DoD は満たしうる。ロードマップは「or」。

エラーレスポンスは引き続き汎用メッセージ。

## 8. 受け入れ条件

- [ ] Logs の確認手順がある
- [ ] エラー通知が 1 経路ある
- [ ] テストで通知を確認した
- [ ] メモ・Cookie が通知に乗らない
- [ ] 依存を足すなら PR に理由

## 9. セキュリティ観点

- スタックをクライアントに出さない（監視 SDK はサーバー送信）
- ソースマップを public に晒すかは **要確認**（private 推奨）

## 10. 関連ファイル / 関連spec

- [09-operations-docs.md](09-operations-docs.md)
- [.cursor/rules/security.mdc](../../.cursor/rules/security.mdc) エラー

## 11. リスク・注意点

- Sentry 無料枠のイベント超過
- wrangler tail に Cookie が出る設定ミス
