# spec — 仕様・設計ドキュメント

alco-app（お酒の記録アプリ）の仕様・設計に関するドキュメント置き場。
**仕様が先、実装が後**。機能の追加・変更時は必ずここのドキュメントを先に更新する。

## ドキュメント一覧

| ファイル | 内容 | 状態 |
|---|---|---|
| [00-overview.md](00-overview.md) | プロダクト概要・確定した前提条件・スコープ | 作成済み |
| [01-requirements.md](01-requirements.md) | 機能要件（MVP / v1.x）・非機能要件 | 作成済み |
| [02-tech-stack.md](02-tech-stack.md) | 技術選定と理由・リポジトリ構成・TypeScript/Biome・ブランチ運用・Cloudflare 環境・コスト見積り | 作成済み |
| [03-roadmap.md](03-roadmap.md) | Phase 0〜8 の開発ロードマップ | 作成済み |
| design-system.md | 配色・タイポグラフィ・コンポーネント方針 | Phase 1で作成 |
| data-model.md | ER図・Drizzleスキーマ設計 | Phase 1で作成 |
| api-design.md | APIエンドポイント一覧・認可ルール | Phase 1で作成 |
| features/ | 機能ごとの詳細仕様（画面項目・バリデーション） | 各実装フェーズで作成 |
| [features/health.md](features/health.md) | 公開 `GET /api/health`（認証なし） | 作成済み（0-04） |
| release-checklist.md | リリース前チェックリスト | Phase 7で作成 |
| operations.md | 運用手順（バックアップ復元・障害対応） | Phase 7で作成 |
