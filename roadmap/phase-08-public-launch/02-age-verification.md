# 8-02 年齢確認（20歳以上）フロー

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 8 一般公開準備 |
| ステータス | **完了**（2026-09-10） |
| 要件 | 一般公開時に 20 歳以上の年齢確認 |
| ソース | Phase 8 年齢確認。正本は [spec/features/age-verification.md](../../spec/features/age-verification.md) |

## 1. 概要

酒類関連アプリとして、20 歳未満が本機能を使えないようにする。本人確認書類は求めない。強度は生年月日入力と、当日 JST でのサーバー計算。

## 2. 前提条件

- 8-01 の禁止条項と整合
- 認証基盤（Better Auth）。`user` は触らずアプリテーブル `age_verifications` に保存

## 3. スコープ

**対象**

- 登録後・初回アクセス時の確認 UI（`/age`）
- サーバー側フラグ（未確認の機能 API は 403 `age_required`）
- 拒否時の画面（20 歳未満は 403 `age_restricted`。行を作らない）

**対象外**

- eKYC、免許証アップロード（R2 に身分証は置かない）
- 地域ごとの飲酒年齢の自動切替
- 公開（認証なし）の確認 API
- 管理フラグによるスキップ

## 4. 成果物

- 仕様 `spec/features/age-verification.md`
- UI + サーバー強制
- テスト: 未確認で drink-logs が書けない

## 5. 細分化タスク

1. 強度を決める（生年月日。チェックボックスのみは不採用）
2. 生年月日の保持方針（成功時だけ保存。PP を `2026-09-10` に同期）
3. 実装
4. テスト
5. 監査

## 6. 手順

生年月日を入力し、当日 JST で 20 歳以上をサーバー計算する。クライアント判定だけは不可。公開エンドポイントは増やさない（確認 API はセッション必須）。

## 7. 仕様詳細

決定の正本は [age-verification.md](../../spec/features/age-verification.md) 3 章。

- 満 20 歳: 日本の年齢計算（20 歳の誕生日の前日に満了）。`tokyoToday()`
- 一度確認したら `age_verifications` に保存（セッションだけに持たない）
- 既存ユーザーも一度だけ確認。スキップフラグなし

## 8. 受け入れ条件

- [x] 未確認では記録・セラー・ノートが使えない
- [x] サーバー強制がある
- [x] テストがある
- [x] PP と項目が一致
- [x] DoD / 監査

## 9. セキュリティ観点

- 生年月日は要配慮になりうる。ログ禁止。`GET /api/me` にも出さない
- クライアントの `isOver20: true` を信じない
- 身分証を集めない

## 10. 関連ファイル / 関連spec

- [spec/features/age-verification.md](../../spec/features/age-verification.md)
- [spec/01-requirements.md](../../spec/01-requirements.md) 法令
- [01-terms-privacy.md](01-terms-privacy.md)

## 11. リスク・注意点

- 自己申告の生年月日は子供が通りうる。eKYC は対象外
- タイムゾーンは Asia/Tokyo に固定して「前日が誕生日」のずれを防ぐ
