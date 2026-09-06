# Phase 3: 飲酒記録（MVPコア）

| 項目 | 内容 |
|---|---|
| 目安 | 1〜1.5週間 |
| 状態 | 進行中（3-01 承認済み。3-04 / 3-02 完了。次は 3-03 → 3-05） |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 3 |

## 目的

毎日使うコア機能を最初に完成させ、オーナーのドッグフーディングを開始する。UX 最重要要件は **最短タップ数で記録できること**（[spec/01-requirements.md](../../spec/01-requirements.md) 1.2）。

## 依存

- Phase 2 完了（認証済みユーザー、空ホーム、Hono RPC、共通レイアウト、**写真パイプライン 2-08**）
- 画面は [spec/screen-designs/02-home.md](../../spec/screen-designs/02-home.md) / [03-log.md](../../spec/screen-designs/03-log.md) のとおりに作る（受け入れチェックを PR に貼る）
- Phase 1 の計算・プリセット仕様は [spec/features/alcohol-calculation.md](../../spec/features/alcohol-calculation.md) が正本（要件 1.2 の式とデフォルト表は 2026-08-13 確定）。日付境界は Asia/Tokyo
- 実装前に本フェーズ最初のタスクで `spec/features/drink-log.md` を書き、オーナー承認を得る

## ゴール（フェーズ DoD）

- オーナーが実機で毎日の記録を運用できる
- 計算ロジック・API・主要コンポーネントにテストがあり、CI がグリーン
- dev 環境にデプロイ済み

## タスク一覧

| # | ファイル | 要点 |
|---|---|---|
| 01 | [機能仕様](01-spec-drink-log.md) | `spec/features/drink-log.md`（**承認済み** 2026-09-06） |
| 02 | [記録入力画面](02-log-input-screen.md) | 種類→量・度数プリセット→保存。写真タイル（任意）、ボトル紐付け、`?camera=1`。**モーション共通基盤**（トークン・`data-state`・`useReducedMotion`・`haptic`・`Mascot pour`。[spec/motion-design.md](../../spec/motion-design.md)） |
| 03 | [マイドリンク](03-my-drinks.md) | プリセット登録と 1 タップ記録（ホーム・日別）、ホームのキャラクター。1 タップの演出（M-07〜M-09 / M-17 / M-18）、週マス → 日別（X6） |
| 04 | [純アルコール計算](04-alcohol-calc-logic.md) | **完了**（`src/shared/alcohol.ts`。単体テスト済み） |
| 05 | [日別ビュー](05-daily-view.md) | 中央タブの着地。最上部に記録・カメラ・マイドリンク。当日一覧（写真サムネ）・合計・編集・削除・`?highlight=`（行の挿入 `useHighlightRow` M-14〜M-16、X1〜X3、X7） |
| 06 | [週/月サマリー](06-weekly-monthly-summary.md) | グラフ（初回 1 回だけ伸びる M-19）、休肝日 |
| 07 | [dev デプロイ](07-dev-deploy-dogfood.md) | 日常利用開始。設定「操作」節（触感フィードバック・動きを減らす。06-settings S8 / S9） |

推奨順: 01（承認）→ 04（計算を shared に）→ 02 と 03 → 05 → 06 → 07。04 を 02 より前にすると入力画面が計算結果をすぐ表示できる。

## スコープ外（このフェーズ）

- 目標設定（週あたり上限、休肝日目標）は v1.x
- セラー連携のうち「ボトル」行のピッカーは `bottles` API が無いと動かないため、Phase 4 まで **行を非表示**にしてよい（設計は 03-log.md N8。Phase 4-02 で有効化）
- 写真パイプライン本体（2-08）。本フェーズは `photoIds` の紐付けと UI 配置のみ
- オフライン記録は対象外

## 終了後にできること

実利用しながら Phase 4 セラーに進む。ドッグフード中の改善は小さな PR で戻す。
