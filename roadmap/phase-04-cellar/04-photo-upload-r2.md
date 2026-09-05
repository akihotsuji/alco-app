# 4-04 陳列（棚）と写真加工

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | 写真を加工してセラー風に陳列し、管理できる UI/UX |
| ソース | Phase 4 写真（2026-09-05 に「写真アップロード R2」から改訂。R2 基盤は 2-08 へ前倒し済み）。画面は [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) `bottle-list` |

ファイル名は履歴のまま（リンク維持のため）。

## 1. 概要

`/cellar` を **棚**にする。2:3 に切り `cellar` プリセットを掛けた写真が棚板の上に 3 本ずつ立つ。写真が無いボトルは種類別のシルエット。フィルタ・検索・空状態・追加読み込みも本タスク。

## 2. 前提条件

- 2-08（`photo-edit` の 2:3 / `cellar` プリセット、配信 API）
- 4-02（一覧 API `view=cellar`、詳細）

## 3. スコープ

**対象**

- `Shelf` コンポーネント（段 = 3 本 + 棚板。480px 以上で 4 列）。`archived` モード（減彩・消費日ピル）は 4-03 で使う
- `BottleTile`（写真 100×150、角 8px、下端を棚板に接する。無ければ `BottleSilhouette`）
- 種類別シルエット SVG（7 種。線 `--muted`、塗り地色）
- ヘッダー（「貯蔵庫」ボタン、「セラー N 本」、「+」）
- フィルタ（検索 Chip → Input、種類ダイアログ、未開栓 / 開栓済トグル）
- 空状態（棚板 + `surprised` 96px + 「ボトルを追加」）、フィルタ 0 件
- cursor で 2 段ずつ追加読み込み。`<img loading="lazy">`
- 詳細画面の写真 + 棚板（4-02 で仮置きしたものを共通部品に置換）

**対象外**

- 背景除去（v1.x。[04-cellar.md](../../spec/screen-designs/04-cellar.md) 陳列の写真 表）
- 写真パイプライン本体（2-08）
- 並び替え（`createdAt` 降順固定）

## 4. 成果物

- `src/client/components/cellar/Shelf.tsx` / `BottleTile.tsx` / `BottleSilhouette.tsx`
- `/cellar` ページ
- コンポーネントテスト（列数、空状態、シルエット分岐）

## 5. 細分化タスク

1. 棚板・段のレイアウト（design-system の `--shelf-*`、段間隔 24px）
2. タイルとシルエット 7 種
3. ヘッダー・フィルタ
4. 空状態・0 件・追加読み込み
5. ダーク確認（`--shelf-rail` ダーク値）
6. テストと監査

## 6. 手順

ブランチ: `feature/cellar-shelf`。

390px / 320px / 480px で列数と棚板の見た目を確認。モック [cellar-shelf.png](../../spec/wireframes/mocks/cellar-shelf.png) と並べて比較。

## 7. 仕様詳細

[spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) 「陳列の写真」表を正とする。写真の色補正は保存時に焼き込み済み（2-08）。棚側では `filter` を掛けない（貯蔵庫の減彩だけ CSS）。

## 8. 受け入れ条件

- [ ] `/cellar` が 3 列の棚。写真が棚板の上、名前と年 / 開栓ピル
- [ ] 写真なしは種類別シルエット
- [ ] 空状態・フィルタ 0 件・追加読み込み
- [ ] ライト／ダークで棚板が見える
- [ ] [04-cellar.md](../../spec/screen-designs/04-cellar.md) の受け入れチェックのうち `bottle-list` 項目
- [ ] DoD 5 項

## 9. セキュリティ観点

- 写真 URL は認可付き GET（2-08）。棚に他人の写真が出る経路がない
- 銘柄名はテキスト描画

## 10. 関連ファイル / 関連spec

- [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md)
- [spec/design-system.md](../../spec/design-system.md) 陳列・写真
- [../phase-02-platform/08-photo-pipeline.md](../phase-02-platform/08-photo-pipeline.md)
- Phase 5: [../phase-05-tasting-note/03-multi-photo-attach.md](../phase-05-tasting-note/03-multi-photo-attach.md)

## 11. リスク・注意点

- 2:3 の写真が棚板に「立つ」見え方は、被写体がボトル全体で下端が揃っているほど良い。`photo-edit` の枠にボトルのガイド線を足すかは実機で判断し、設計を直してから
- 6 本 × 300KB の初回読み込み。lazy と cursor で抑える
