# 5-03 写真複数枚添付

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 5 テイスティングノート |
| ステータス | **未着手** |
| 要件 | 写真（複数枚、最大 6）、2-08 基盤再利用 |
| ソース | Phase 5 写真複数枚添付。画面は [spec/screen-designs/05-notes.md](../../spec/screen-designs/05-notes.md) `note-new` N1 / `note-detail` V1 |

## 1. 概要

2-08 の `photo-edit`・`/api/photos`・認可を使い、1 ノートに最大 6 枚を付ける。新しいストレージ方式を発明しない。

## 2. 前提条件

- 2-08 完了（`photo-edit` 4:5 / `table` / キャラ合成トグル）
- 5-02 のノート
- 枚数上限 6（data-model 5.6 確定）

## 3. スコープ

**対象**

- 作成 / 編集の写真ストリップ（「撮る」タイル + サムネ 96×120）。順序は `photoIds` の配列順 = `sortOrder`。「先頭にする」メニュー
- 詳細のカルーセル（4:5、`scroll-snap`、ドット）
- 追加・削除（未保存の削除は即 `DELETE /api/photos/:id`）
- テスト: 7 枚目 400、他人の photo id を紐付け 404、`photoIds` 差し替えで外れた写真が消える

**対象外**

- 画像編集フィルタ
- 動画

## 4. 成果物

- photos.tasting_note_id または中間テーブル（data-model どおり）
- UI
- テスト

## 5. 細分化タスク

1. データモデルどおり関連を実装（2-01 で済んでいるはず）
2. 2-08 の upload API を再利用。**先に未紐付けで作り、ノート保存時に `photoIds`**（api-design 確定）。他人の id 混入を拒否
3. UI: 写真ストリップ、カルーセル
4. 遅延読み込みは Phase 6-03 でも可。今は `loading=lazy`
5. テストと監査

## 6. 手順

ブランチ: `feature/note-photos`

新しい `/api/upload-public` を作らない。4-04 のルートを拡張するだけ。

```powershell
pnpm test
```

## 7. 仕様詳細

- 上限 6 枚。7 枚目で 400
- 並び順 column `sort_order`（`photoIds` の配列順）
- ボトル・ノート・記録の写真は同じ photos テーブルで所有者 3 列が排他

## 8. 受け入れ条件

- [ ] 複数枚を付けて詳細で見られる
- [ ] 基盤の再利用（重複実装なし）
- [ ] 他人の写真 ID を紐付けできないテスト
- [ ] DoD 5 項

## 9. セキュリティ観点

- 紐付け時も photo.user_id === session
- MIME 再検証はアップロード時で足りるが、紐付けだけ別ユーザーは不可
- ギャラリーの URL も認可付き

## 10. 関連ファイル / 関連spec

- [../phase-02-platform/08-photo-pipeline.md](../phase-02-platform/08-photo-pipeline.md)
- [spec/screen-designs/05-notes.md](../../spec/screen-designs/05-notes.md)
- [spec/features/tasting-note.md](../../spec/features/tasting-note.md)

## 11. リスク・注意点

- 同時アップロードで上限レース。サーバーで count + transaction 相当（SQLite）
- 大きな HEIC 複数で Workers CPU 時間
