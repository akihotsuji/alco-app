# 4-04 陳列（ガラス棚）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | 地色の上にガラス風の棚板、切り抜きボトルが立つ。種類ごと / 1 本ずつの表示切替 |
| ソース | Phase 4 写真（2026-09-05 に「写真アップロード R2」から改訂。R2 基盤は 2-08 へ前倒し済み）。画面は [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) `bottle-list` |

ファイル名は履歴のまま（リンク維持のため）。

## 1. 概要

`/cellar` を **ガラス棚**にする。`kind = cutout` の透過ボトルは棚板の上に立ち、`kind = photo` は 2:3 の長方形として載る（切り抜き自体は 4-06。本タスク時点は長方形が主）。「種類ごと」（ゴースト見出し + 横スクロール 1 段）と「1 本ずつ」（3 列）の切替、写真が無いボトルの種類別シルエット、フィルタ・検索・空状態・追加読み込みも本タスク。

## 2. 前提条件

- 2-08（`photo-edit` の 2:3 / `cellar` プリセット、配信 API）
- 4-02（一覧 API `view=cellar`、詳細）

## 3. スコープ

**対象**

- `Shelf` コンポーネント（段 = 3 本 + ガラス棚板 `--shelf-glass*`。480px 以上で 4 列）。`archived` モード（減彩・消費日ピル）は 4-03 で使う。`byType` モード（1 種類 = 1 段、横スクロール、ゴースト見出し、棚板は本数分の幅）
- `BottleTile`（`cutout` は `object-fit: contain` で下端を棚板に、`photo` は 100×150 角 8px。無ければ `BottleSilhouette`）
- 種類別シルエット SVG（7 種。線 `--muted`、inset-sm 枠）
- ヘッダー（「貯蔵庫」ボタン、「セラー N 本」、「+」）
- 表示切替の 2 択セグメント（URL `?view=` + `localStorage`）
- フィルタ（検索 Chip → Input、種類ダイアログ（種類ごと表示では非表示）、未開栓 / 開栓済トグル）
- 一覧 API の `countsByType` を見出しに使う
- 空状態（棚板 + `surprised` 96px + 「ボトルを追加」）、フィルタ 0 件
- cursor で 2 段ずつ追加読み込み。`<img loading="lazy">`
- 詳細画面の写真 + 棚板（4-02 で仮置きしたものを共通部品に置換）

**対象外**

- 背景除去の処理そのもの（4-06。本タスクは `kind` の描き分けまで）
- 写真パイプライン本体（2-08）
- 並び替え（`createdAt` 降順固定）

## 4. 成果物

- `src/client/components/cellar/Shelf.tsx` / `BottleTile.tsx` / `BottleSilhouette.tsx`
- `/cellar` ページ
- コンポーネントテスト（列数、空状態、シルエット分岐）

## 5. 細分化タスク

1. ガラス棚板・段のレイアウト（design-system の `--shelf-glass*`、`--shelf-h`、段間隔 24px）
2. タイル（`cutout` / `photo`）とシルエット 7 種
3. 表示切替（種類ごと / 1 本ずつ）とゴースト見出し
4. ヘッダー・フィルタ
5. 空状態・0 件・追加読み込み（1 本ずつは 2 段ずつ、種類ごとは段の右端で）
6. ダーク確認（`--shelf-glass` ダーク値）
7. テストと監査

## 6. 手順

ブランチ: `feature/cellar-shelf`。

390px / 320px / 480px で列数と棚板の見た目を確認。モック [cellar-shelf.png](../../spec/wireframes/mocks/cellar-shelf.png) と並べて比較。

## 7. 仕様詳細

[spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) 「陳列の写真」表を正とする。写真の色補正・落ち影は保存時に焼き込み済み（2-08 / 4-06）。棚側では `filter` を掛けない（貯蔵庫の減彩だけ CSS）。透過画像の背後に白を敷かない（地色のまま）。

## 8. 受け入れ条件

- [ ] `/cellar` がガラス棚。1 本ずつ = 3 列、種類ごと = ゴースト見出し + 横スクロール 1 段。切替が URL と `localStorage` に残る
- [ ] `cutout` は棚板に立ち、`photo` は角 8px の長方形、写真なしは種類別シルエット
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

- 長方形（`photo`）と切り抜き（`cutout`）が同じ段に混在すると高さが揃わない。長方形は 150px、切り抜きは `contain` で 150px 以内に収め、下端を揃える
- 6 本 × 300KB の初回読み込み。lazy と cursor で抑える
- `backdrop-filter` 非対応ブラウザでは棚板の透け感が落ちる。塗りと上辺の線だけでも成立するようにする
