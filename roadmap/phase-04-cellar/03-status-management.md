# 4-03 開栓・貯蔵庫・復元（ステータス管理）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **完了** |
| 要件 | 追加と開栓の 2 操作。開栓で貯蔵庫へ移る。記録は作らない。undo。復元 |
| ソース | Phase 4 ステータス管理（2026-09-06 に開栓＝貯蔵庫へ改訂）。画面は [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) `bottle-detail` / `bottle-archive` |

## 1. 概要

ボトル状態の遷移をすべて実装する。中心は **開栓する**（確認なし → 棚へ戻り → トースト undo）と **貯蔵庫**画面。

```
sealed ──開栓──► consumed（貯蔵庫）──復元──► sealed
```

## 2. 前提条件

- 4-02（詳細画面・API）、4-04（棚。貯蔵庫は棚を減彩で再利用）
- Phase 3（トースト）

## 3. スコープ

**対象**

- `POST /api/bottles/:id/consume`（api-design 4.5.1。ボトルを `consumed` にするだけ。記録は作らない）
- `POST /api/bottles/:id/restore`（4.5.2。常に `sealed`）
- 詳細の主「開栓する」（確認なし）。押下 M-01 / M-02、送信中は「開栓中」+ 水位線（M-04）、2xx で即 `/cellar` へ（M-05）。`haptic("success")`
- 成功後の遷移とトースト「開栓しました 取り消す」（undo = restore のみ。`cheer` の水面 M-25）。到着した `/cellar` では見出しの本数がカウントダウンし、抜けた本があった段の棚板に明帯が 1 回走る（M-10。[spec/motion-design.md](../../spec/motion-design.md) 9 章「少し凝った」段階）。対象は `history.state` で渡す
- 取り消し / 「セラーに戻す」で本が棚に戻るとき、そのタイルが上 6px から置かれるように現れ（M-11）、段の棚板に明帯（M-32）。見出しの本数はカウントアップ
- `bottle-archive`（`/cellar/archive`。月見出し、減彩、開栓日ピル）
- 貯蔵庫の詳細（主「ノートを書く」、「セラーに戻す」）
- テスト: consume の認可・状態不一致 404、restore の戻り先、undo

**対象外**

- 開栓時の記録同時作成（廃止。1 杯は記録画面）
- 棚に残す `opened`（廃止）
- 自動で消費にするロジック（無い。1 行 = 1 本で不要）
- 通知

## 4. 成果物

- consume / restore ルートとサービス
- 貯蔵庫画面・詳細の状態分岐
- テスト

## 5. 細分化タスク

1. consume / restore の Zod・サービス
2. 詳細の「開栓する」と遷移
3. 貯蔵庫画面（棚コンポーネントに `archived` モード）
4. 詳細の貯蔵庫表示
5. トースト undo
6. テストと監査、cellar.md に遷移図を同期

## 6. 手順

ブランチ: `feature/bottle-open`。

```powershell
pnpm test; pnpm lint; pnpm typecheck
```

手動: 棚 → 詳細 → 開栓 → 棚から消える → 取り消す → 棚に戻る。記録は増えない。

## 7. 仕様詳細

- `consumedAt` = サーバー現在時刻。`consumedOn` はその JST 日
- 復元は常に `sealed`
- PATCH で `status` は受け取らない

## 8. 受け入れ条件

- [x] 開栓 → 貯蔵庫 → 棚へ戻り → undo で棚に戻る（実機）。記録は作られない
- [x] 復元ができ、他人・不在・状態不一致は 404
- [x] 貯蔵庫が月見出し・減彩・開栓日ピル
- [x] [04-cellar.md](../../spec/screen-designs/04-cellar.md) の受け入れチェックのうち開栓・貯蔵庫・詳細（貯蔵庫）項目
- [x] DoD 5 項

## 9. セキュリティ観点

- status を文字列自由入力にしない（enum）。PATCH で `status` / `consumed` を受け取らない
- consume / restore は `id + user_id`。存在しない・他人・状態不一致を同じ 404 に
- フィルタで他ユーザー行が混ざらない

## 10. 関連ファイル / 関連spec

- [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md)
- [spec/api-design.md](../../spec/api-design.md) 4.5.1 / 4.5.2
- [spec/data-model.md](../../spec/data-model.md) 5.4
- [02-bottle-crud.md](02-bottle-crud.md)、[04-photo-upload-r2.md](04-photo-upload-r2.md)

## 11. リスク・注意点

- 確認なしなので誤タップはトースト undo で救う。5 秒で割り切る
