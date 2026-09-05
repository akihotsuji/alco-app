# spec — 仕様・設計ドキュメント

alco-app（お酒の記録アプリ）の仕様・設計に関するドキュメント置き場。
**仕様が先、実装が後**。機能の追加・変更時は必ずここのドキュメントを先に更新する。

## ドキュメント一覧

| ファイル | 内容 | 状態 |
|---|---|---|
| [00-overview.md](00-overview.md) | プロダクト概要・確定した前提条件・スコープ | 作成済み |
| [01-requirements.md](01-requirements.md) | 機能要件（MVP / v1.x）・非機能要件 | 作成済み |
| [02-tech-stack.md](02-tech-stack.md) | 技術選定と理由・リポジトリ構成・TypeScript/Biome・テスト・CI・ブランチ運用・Cloudflare 環境・コスト見積り | 作成済み |
| [03-roadmap.md](03-roadmap.md) | Phase 0〜8 の開発ロードマップ | 作成済み |
| [screens.md](screens.md) | 画面一覧・下部タブ（記録中央）・認証境界・入場経路（Phase 2-05 の正本） | 作成済み（1-01。1-07 で改訂） |
| [screen-designs/](screen-designs/README.md) | **詳細画面設計**（全画面の要素表・状態・遷移・モック。実装はこのとおりに作る） | 作成済み（1-07。承認待ち） |
| [character.md](character.md) | キャラクター（マスコット）仕様・ポーズ・写真合成ルール。SVG は [assets/character/](assets/character/) | 作成済み（1-08。承認待ち） |
| [wireframes.md](wireframes.md) | 主要画面の骨格（1-02）。配置の正本は screen-designs へ移行。質感モックの一覧 | 作成済み（1-02。履歴） |
| [design-system.md](design-system.md) | 配色・タイポグラフィ・コンポーネント方針（ニューモーフィズム、OS追従、キャラクター・陳列・写真トークン） | 作成済み（1-03。1-07/08 で追補） |
| [data-model.md](data-model.md) | ER図・Drizzleスキーマ設計 | 作成済み（1-04。1-07 改訂は承認待ち） |
| [api-design.md](api-design.md) | APIエンドポイント一覧・認可ルール | 作成済み（1-05。1-07 改訂は承認待ち） |
| features/ | 機能ごとの詳細仕様（画面項目・バリデーション） | 各実装フェーズで作成 |
| [features/health.md](features/health.md) | 公開 `GET /api/health`（認証なし） | 作成済み（0-04） |
| [features/alcohol-calculation.md](features/alcohol-calculation.md) | 純アルコール量計算・グラスプリセット・休肝日 | 承認済み（1-06。2026-09-04） |
| release-checklist.md | リリース前チェックリスト | Phase 7で作成 |
| operations.md | 運用手順（バックアップ復元・障害対応） | Phase 7で作成 |
