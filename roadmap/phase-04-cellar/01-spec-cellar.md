# 4-01 spec/features/cellar.md 作成

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | [spec/01-requirements.md](../../spec/01-requirements.md) 1.3 |
| ソース | Phase 4 先頭。feature-dev Step 1 |

## 1. 概要

セラー（ボトル在庫）の画面項目・バリデーション・写真方針を仕様化し、承認後に実装する。コード変更なし。**画面は [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) で確定済み**なので、本タスクはそれを `spec/features/cellar.md` の形式（項目表・バリデーション・API 対応・エッジケース）に写し、未決を潰す。

## 2. 前提条件

- Phase 1 の data-model / api-design（1-07 改訂: `consumed`、`quantity` 廃止、consume / restore）/ screen-designs
- Phase 2 基盤（写真は 2-08）

## 3. スコープ

**対象**

- ボトルのフィールド一式（要件 1.3。`quantity` は無い。登録時の `count` で N 行）
- ステータス 3 種（`sealed` / `opened` / `consumed`）と遷移（開栓・消費・復元）
- 棚（陳列）の並び・列数・フィルタ・検索、貯蔵庫の月見出し
- 消費ダイアログの記録同時作成（量・度数の初期値、undo の手順）
- 写真 1 枚（2:3、`cellar` プリセット、キャラ合成なし）

**対象外**

- 飲み頃アラート、在庫金額サマリー（v1.x）
- バーコード
- 実装

## 4. 成果物

- `spec/features/cellar.md`
- spec/README 更新

## 5. 細分化タスク

1. 要件の列を画面項目表にする（必須/任意）
2. 検索・フィルタ仕様
3. ステータス遷移図
4. 写真の枚数・リサイズ後解像度（4-04 と重複しないよう「詳細は photo 節」）
5. 承認 PR `docs: セラー機能仕様を追加`

## 6. 手順

feature-dev Step 1。実装タスク 4-02 を同じ PR に混ぜない。

未決を残すなら表にして承認をブロックする。

## 7. 仕様詳細

必須: 銘柄名、種類、ステータス（既定 `sealed`）。

任意: 生産者、産地、ヴィンテージ（整数 or NULL = NV）、購入日、価格（整数円）、場所、保管場所、メモ、写真 1 枚。登録時の本数 `count`（1〜12）。

種類は飲酒記録の 7 種と同じ（data-model 5.3 確定）。

検索: 銘柄名・生産者の部分一致。SQLite `LIKE` は Drizzle でプレースホルダ、`%` `_` をエスケープ。大文字小文字は SQLite 既定（ASCII のみ不区別）で可。

消費: [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) `bottle-consume` と api-design 4.5.1 / 4.5.2 を写す。undo は `restore` → `DELETE drink-log` の順。

## 8. 受け入れ条件

- [ ] 画面・バリデーション・API 対応・エッジケースがある
- [ ] オーナー承認
- [ ] v1.x が混ざっていない
- [ ] 写真の認可方針が security と矛盾しない

## 9. セキュリティ観点

- メモ・銘柄の XSS
- 価格は他人に見えない（全部プライベート）
- アップロードはサーバー検証（詳細 4-04）

## 10. 関連ファイル / 関連spec

- [spec/01-requirements.md](../../spec/01-requirements.md) 1.3
- [../phase-01-design/04-er-drizzle-schema.md](../phase-01-design/04-er-drizzle-schema.md)

## 11. リスク・注意点

- フィールドが多く入力が長い。詳細は折りたたみ（設計済み）
- N 行展開と写真の複製（api-design 4.5 POST）。R2 オブジェクトも N 個
