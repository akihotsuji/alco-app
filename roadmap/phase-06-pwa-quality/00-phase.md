# Phase 6: PWA・品質仕上げ

| 項目 | 内容 |
|---|---|
| 目安 | 3〜5日 |
| 状態 | 未着手 |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 6 |

## 目的

「アプリらしさ」と品質を本番レベルに引き上げる。機能追加はせず、既存 3 機能の体験と自動テストを固める。

## 依存

- Phase 5 完了（MVP 3 機能が実機で動く）
- Phase 3-07 の dev デプロイがあると実機確認が楽

## ゴール（フェーズ DoD）

- ホーム画面に追加するとスタンドアロンで起動する（iOS / Android 両方）
- E2E が CI で安定してパスする
- Lighthouse（モバイル）Performance / Best Practices / a11y が目安 80 点以上

## タスク一覧

| # | ファイル | 要点 |
|---|---|---|
| 01 | [vite-plugin-pwa](01-vite-plugin-pwa.md) | manifest、アイコン、テーマカラー |
| 02 | [Playwright E2E](02-playwright-e2e.md) | 主要導線を CI へ |
| 03 | [パフォーマンス](03-performance.md) | バンドル、コード分割、画像遅延 |
| 04 | [アクセシビリティ](04-accessibility.md) | タップ領域、コントラスト、ラベル |
| 05 | [実機 QA](05-device-qa.md) | iOS Safari / Android Chrome |

推奨順: 01 と 04 は並行可。02 は機能が固まってから。03 は計測してから直す。05 は 01 の後（PWA 追加を実機で見る）。

## このフェーズで整備する skills

- skill: `e2e-testing` — 書き方・実行・デバッグ手順

## スコープ外

- オフラインでの記録（[spec/00-overview.md](../../spec/00-overview.md)）
- アプリストア申請

## 終了後にできること

Phase 7 の本番環境分離とリリース作業に進む。
