# spec — 仕様・設計ドキュメント

酒のしおり（リポジトリ名 alco-app）の仕様・設計に関するドキュメント置き場。
**仕様が先、実装が後**。機能の追加・変更時は必ずここのドキュメントを先に更新する。

## ドキュメント一覧

| ファイル | 内容 | 状態 |
|---|---|---|
| [00-overview.md](00-overview.md) | プロダクト概要・確定した前提条件・スコープ | 作成済み |
| [01-requirements.md](01-requirements.md) | 機能要件（MVP / v1.x）・非機能要件 | 作成済み |
| [02-tech-stack.md](02-tech-stack.md) | 技術選定と理由・リポジトリ構成・TypeScript/Biome・テスト・CI・ブランチ運用・Cloudflare 環境・コスト見積り | 作成済み |
| [03-roadmap.md](03-roadmap.md) | Phase 0〜8 の開発ロードマップ | 作成済み |
| [screens.md](screens.md) | 画面一覧・下部タブ（記録中央）・認証境界・入場経路（Phase 2-05 の正本） | 作成済み（1-01。1-07 で改訂） |
| [screen-designs/](screen-designs/README.md) | **詳細画面設計**（全画面の要素表・状態・遷移・モック。実装はこのとおりに作る） | 承認済み（1-07。2026-09-06。中央タブの挙動は同日 (c) 撮影開始で確定） |
| [character.md](character.md) | キャラクター（マスコット）仕様・ポーズ・写真合成ルール。SVG は [assets/character/](assets/character/) | 承認済み（1-08。2026-09-06） |
| [wireframes.md](wireframes.md) | 主要画面の骨格（1-02）。配置の正本は screen-designs へ移行。質感モックの一覧 | 作成済み（1-02。履歴） |
| [design-system.md](design-system.md) | 配色・タイポグラフィ・コンポーネント方針（ニューモーフィズム、OS追従、キャラクター・陳列・写真トークン） | 作成済み（1-03。1-07/08 で追補） |
| [motion-design.md](motion-design.md) | モーション・マイクロインタラクション（演出 `M-01`〜`M-32`、原則、easing / duration トークン、主ボタン・開栓・記録成功の詳細設計、reduced motion、haptic、体験改善 X1〜X8） | 承認済み（2026-09-06） |
| [data-model.md](data-model.md) | ER図・Drizzleスキーマ設計 | 承認済み（1-04。1-07 改訂は 2026-09-06 承認） |
| [api-design.md](api-design.md) | APIエンドポイント一覧・認可ルール | 承認済み（1-05。1-07 改訂は 2026-09-06 承認） |
| [dev-deploy.md](dev-deploy.md) | dev Workers への手動デプロイ・リモート migrate・ログの見方（3-07。後で operations に統合） | 作成済み（3-07） |
| [secrets.md](secrets.md) | シークレットのキー名と置き場・投入／ローテーション（値は書かない） | 7-03（2026-09-09） |
| features/ | 機能ごとの詳細仕様（画面項目・バリデーション） | 各実装フェーズで作成 |
| [features/health.md](features/health.md) | 公開 `GET /api/health`（認証なし） | 作成済み（0-04） |
| [features/alcohol-calculation.md](features/alcohol-calculation.md) | 純アルコール量計算・グラスプリセット・休肝日 | 承認済み（1-06。2026-09-04） |
| [features/drink-log.md](features/drink-log.md) | 飲酒記録（入力・編集・日別・マイドリンク・週/月サマリー・ホーム）の画面項目・バリデーション・API・エッジケース | 承認済み（3-01。2026-09-06） |
| [features/ai-recognition.md](features/ai-recognition.md) | 酒記録の AI 補完（Gemini 3.7 Flash / プロファイル切替 / 根拠 / 検索） | 実装中（2026-09-09） |
| [features/cellar.md](features/cellar.md) | セラー（棚・貯蔵庫・追加・詳細・開栓・復元・切り抜き・ラベル読み取り）の画面項目・バリデーション・API・エッジケース | 承認済み（4-01） |
| [features/tasting-note.md](features/tasting-note.md) | テイスティングノート（撮って評価と一言・写真グリッド・セラー連携）の画面項目・バリデーション・API・エッジケース | 承認済み（5-01 #46）。5-02 CRUD 実装済み |
| [features/pwa.md](features/pwa.md) | PWA（manifest・スタンドアロン・アイコン生成・SW は API を NetworkOnly） | 6-01（2026-09-08） |
| [features/production-env.md](features/production-env.md) | 本番 wrangler env・D1 / R2 の命名と分離（デプロイは 7-02） | 7-01（2026-09-09） |
| [features/deploy-prod.md](features/deploy-prod.md) | タグ / 承認で `env.production` へデプロイ | 7-02（2026-09-09） |
| [features/d1-backup.md](features/d1-backup.md) | D1 Time Travel 確認と日次 export（非公開 R2。14 日） | 7-04（2026-09-09） |
| [features/monitoring.md](features/monitoring.md) | Workers Logs とエラー通知（ウェブフック + Actions メール） | 7-05（2026-09-09） |
| [legal.md](legal.md) | 利用規約・PP の草案とデータマップ | 8-01（2026-09-09。承認待ち） |
| [features/legal.md](features/legal.md) | 公開ページ・サインアップ同意・`legal_consents` | 8-01 |
| [features/age-verification.md](features/age-verification.md) | 満 20 歳の生年月日確認・`age_verifications`・機能 API の 403 | 8-02 |
| [features/e2e.md](features/e2e.md) | Playwright E2E（記録→サマリー、ボトル→ノート。CI Chromium） | 6-02 |
| [qa-devices.md](qa-devices.md) | iOS Safari / Android Chrome の実機 QA（セーフエリア・PWA 追加・入力ズーム） | 6-05（オーナー実機確認待ち） |
| [security-audit-release.md](security-audit-release.md) | リリース前の全体セキュリティ監査（Critical / High ゼロ。R2 ダッシュボード目視はオーナー） | 7-07（2026-09-09） |
| [release-checklist.md](release-checklist.md) | 本番リリース当日のチェックリスト（初回デプロイ実施はオーナー） | 7-08（2026-09-09） |
| [operations.md](operations.md) | 障害確認・Worker ロールバック・D1 復元 | 7-09（2026-09-09） |
