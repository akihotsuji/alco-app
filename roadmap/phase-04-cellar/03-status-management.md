# 4-03 消費・貯蔵庫・開栓・復元（ステータス管理）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | 追加と消費の 2 操作。消費で貯蔵庫へ移り、その日の記録に 1 杯を追加して日別へ。undo。開栓・復元 |
| ソース | Phase 4 ステータス管理（2026-09-05 に消費・貯蔵庫へ改訂）。画面は [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) `bottle-consume` / `bottle-archive` |

## 1. 概要

ボトル状態の遷移をすべて実装する。中心は **消費ダイアログ**（記録 1 杯の同時作成 → `log-day?highlight=` へ遷移 → トースト undo）と **貯蔵庫**画面。

```
sealed ──開栓──► opened
  │                │
  └────消費────────┴──► consumed（貯蔵庫）──復元──► sealed | opened
```

## 2. 前提条件

- 4-02（詳細画面・API）、4-04（棚。貯蔵庫は棚を減彩で再利用）
- Phase 3（drink-log 作成、`log-day?highlight=`、トースト）

## 3. スコープ

**対象**

- `POST /api/bottles/:id/consume`（api-design 4.5.1。ボトル更新 + drink-log 作成を D1 batch で）
- `POST /api/bottles/:id/restore`（4.5.2）
- `PATCH { status: "opened" }`（開栓。`openedOn` 既定今日）
- `bottle-consume` ダイアログ（記録チェック既定 ON、量チップ + ボトル量、度数、日時）
- 成功後の遷移とトースト「貯蔵庫へ移しました 取り消す」（undo = restore → DELETE log）
- `bottle-archive`（`/cellar/archive`。月見出し、減彩、消費日ピル）
- 貯蔵庫の詳細（主「ノートを書く」、「セラーに戻す」、「この日の記録 ›」）
- テスト: consume の認可・状態不一致 404・トランザクション（log 失敗でボトルが変わらない）、restore の戻り先、undo 手順

**対象外**

- 自動で消費にするロジック（無い。1 行 = 1 本で不要）
- 通知

## 4. 成果物

- consume / restore ルートとサービス
- ダイアログ・貯蔵庫画面・詳細の状態分岐
- テスト

## 5. 細分化タスク

1. consume / restore の Zod・サービス（batch）
2. 開栓 PATCH の制限（`status` は `opened` のみ）
3. ダイアログ UI と遷移
4. 貯蔵庫画面（棚コンポーネントに `archived` モード）
5. 詳細の貯蔵庫表示
6. トースト undo（2 API の順序と失敗時の再取得）
7. テストと監査、cellar.md に遷移図を同期

## 6. 手順

ブランチ: `feature/bottle-consume`。

```powershell
pnpm test; pnpm lint; pnpm typecheck
```

手動: 棚 → 詳細 → 消費 → 日別に行がハイライト → 取り消す → 棚に戻り記録が消える。

## 7. 仕様詳細

- 消費ダイアログの量・度数初期値は種類デフォルト（[alcohol-calculation.md](../../spec/features/alcohol-calculation.md)）。ボトル量チップ 375 / 750 / 1500 も出す
- 記録の `drinkName` = ボトル名、`drinkType` = ボトルの種類、`bottleId` = このボトル
- `consumedAt` = `log.drunkAt`（記録なしのときはサーバー現在時刻）
- 復元は `openedOn` の有無で `opened` / `sealed`
- 記録チェックの最後の選択を `localStorage` に記憶

## 8. 受け入れ条件

- [ ] 消費 → 貯蔵庫 → 日別へ遷移 → undo で両方戻る（実機）
- [ ] 開栓・復元ができ、他人・不在・状態不一致は 404
- [ ] 貯蔵庫が月見出し・減彩・消費日ピル
- [ ] [04-cellar.md](../../spec/screen-designs/04-cellar.md) の受け入れチェックのうち消費・貯蔵庫・詳細（貯蔵庫）項目
- [ ] DoD 5 項

## 9. セキュリティ観点

- status を文字列自由入力にしない（enum）。PATCH で `consumed` を受け取らない
- consume / restore は `id + user_id`。存在しない・他人・状態不一致を同じ 404 に
- フィルタで他ユーザー行が混ざらない

## 10. 関連ファイル / 関連spec

- [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md)
- [spec/api-design.md](../../spec/api-design.md) 4.5.1 / 4.5.2
- [spec/data-model.md](../../spec/data-model.md) 5.4
- [02-bottle-crud.md](02-bottle-crud.md)、[04-photo-upload-r2.md](04-photo-upload-r2.md)

## 11. リスク・注意点

- undo が 2 API のため片方失敗が起きる。失敗時は汎用エラー + 再取得で状態を見せる（設計済み）
- 日別遷移後にトーストが消える前にタブを切り替えると undo できない。5 秒で割り切る
