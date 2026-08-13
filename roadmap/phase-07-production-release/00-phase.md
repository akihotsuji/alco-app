# Phase 7: 本番リリース

| 項目 | 内容 |
|---|---|
| 目安 | 3〜5日 |
| 状態 | 未着手 |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 7 |

## 目的

dev と分離した本番環境を構築し、安全に個人利用の本番運用を開始する。

## 依存

- Phase 6 完了（PWA、E2E、実機確認）
- Cloudflare アカウントで追加の D1 / R2 / Worker 環境を作れること
- GitHub Secrets と `wrangler secret` をオーナーが投入できること（値はチャットやドキュメントに貼らない）

## ゴール（フェーズ DoD）

- 本番 URL でアプリが稼働し、dev と完全に分離されている
- バックアップが自動取得され、復元手順が一度リハーサル済み
- ロールバック手順が文書化されている

## タスク一覧

| # | ファイル | 成果物 |
|---|---|---|
| 01 | [本番リソース](01-prod-resources.md) | wrangler env、本番 D1/R2 |
| 02 | [デプロイパイプライン](02-deploy-pipeline.md) | main→dev、タグ/承認→本番 |
| 03 | [シークレット管理](03-secret-management.md) | 手順の整理（値は書かない） |
| 04 | [D1 バックアップ](04-d1-backup.md) | Time Travel 確認 + 定期 export |
| 05 | [監視](05-monitoring.md) | Logs、エラー通知 |
| 06 | [独自ドメイン](06-custom-domain.md) | 任意。`*.workers.dev` でも可 |
| 07 | [全体セキュリティ監査](07-security-audit.md) | `security-audit` をコードベース全体へ |
| 08 | [リリースチェックリスト](08-release-checklist.md) | `spec/release-checklist.md` |
| 09 | [運用ドキュメント](09-operations-docs.md) | `spec/operations.md` |

推奨順: 01 → 03（シークレット投入）→ 02 → 04 → 05。06 は任意でいつでも可。07 → 08 実施 → 09 は 04 のリハーサル結果を含む。

## このフェーズで整備する skills

- skill: `release` — チェックリスト実行→本番デプロイ→動作確認→ロールバック

## 終了後にできること

個人利用の本番運用。Phase 8 は安定後の任意。
