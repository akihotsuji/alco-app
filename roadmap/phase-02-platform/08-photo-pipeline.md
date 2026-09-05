# 2-08 写真パイプライン基盤（撮影 → 編集 → 合成 → R2）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **未着手** |
| 要件 | 記録・セラー・ノートで共通の写真取り込み・端末内加工・アップロード・認可付き配信・未紐付け GC |
| ソース | [spec/screen-designs/07-photo-capture.md](../../spec/screen-designs/07-photo-capture.md)、[spec/character.md](../../spec/character.md) 5 章、api-design 4.7。2026-09-05 に Phase 4-04 から前倒し |

## 1. 概要

写真は Phase 3（記録）から使うため、基盤を Phase 2 に置く。クライアント側の `photo-edit`（比率切り抜き・リサイズ・色補正・キャラ合成・JPEG 化）と、サーバー側の `photos` ルート（magic bytes 検証・R2 保存・認可付き配信・未紐付け GC）を作る。

## 2. 前提条件

- 2-01（`photos` テーブル。所有者 3 列と CHECK）
- 2-02 / 2-03（認証 MW、エラー形式）
- 2-06（`<Mascot />`。合成に SVG を使う）
- 0-03 の R2 binding `PHOTOS`

## 3. スコープ

**対象**

- `src/client/lib/photo/`: `pickImage()`（`input[type=file] capture`）、`decodeImage()`（EXIF orientation 補正）、`cropResize()`、`applyPreset()`、`composeMascot()`、`toJpegBlob()`。座標計算は純粋関数
- `src/client/components/photo/PhotoEdit.tsx`（全画面オーバーレイ。比率 4:5 / 2:3、ドラッグ・ピンチ、色補正トグル、キャラトグル、使う）
- `src/client/components/photo/PhotoTile.tsx`（撮影前タイル / 撮影後サムネ）
- `POST /api/photos`（multipart、magic bytes、1MB、長辺 1600、所有者 3 列の排他、未紐付け可）
- `GET /api/photos/:id` / `GET /api/photos/:id/content`（認可、`Cache-Control: private`）
- `PATCH` / `DELETE /api/photos/:id`
- `scheduled` ハンドラ: 未紐付け 24h 超を R2 + D1 から削除。`wrangler.jsonc` に `triggers.crons`
- テスト: 座標計算・合成位置、401、他人 404、SVG/GIF 415、1MB 超 413、未紐付け GC

**対象外**

- 作成 API の `photoIds` 紐付け（各機能フェーズ: 3-02 / 4-02 / 5-03）
- 背景除去（4-06。本タスクでは `photo-edit` に切り抜きトグルの差し込み口と、サーバーの `kind` 判定だけ用意する）
- ラベル読み取り（4-07。本タスクでは「切り抜く前の JPEG を呼び出し元へ渡す」経路だけ用意する）
- 複数枚 UI（5-03）

## 4. 成果物

- 上記ファイル群と単体・API テスト
- `wrangler.jsonc` の Cron 設定（値はシークレットではない）
- 設定画面の 2 スイッチが読む `localStorage` キー（`photo.mascot` / `photo.filter`）

## 5. 細分化タスク

1. 純粋関数（`cropResize` の座標、`composeMascot` の位置 = 短辺 22%・余白 4%）とテスト
2. `PhotoEdit` UI（design どおり。タブ非表示、`pushState` 1 段）
3. `photos` ルート（magic bytes: JPEG `FF D8 FF`、PNG `89 50 4E 47`、WebP `52 49 46 46 .... 57 45 42 50`。WebP は VP8X チャンクの alpha ビットで `kind = cutout` を判定）
4. 配信（R2 ストリーム、Content-Type は保存値）
5. Cron GC
6. 実機（iOS Safari / Android Chrome）で撮影 → 編集 → アップロードを確認
7. security-audit（アップロード節）

## 6. 手順

```powershell
git fetch origin main
git checkout -b feature/photo-pipeline origin/main
pnpm test; pnpm lint; pnpm typecheck
```

ローカルの wrangler R2 シミュレータで put / get / delete。Cron は `wrangler dev --test-scheduled` で `/__scheduled` を叩いて確認。

## 7. 仕様詳細

[spec/screen-designs/07-photo-capture.md](../../spec/screen-designs/07-photo-capture.md) を正とする。数値: 長辺 1280、JPEG 0.82、サーバー 1MB / 1600px、キャラ 短辺 22% / 余白 4%、GC 24h。

`ctx.filter` 非対応ブラウザでは色補正をスキップしトグルを無効化する。

## 8. 受け入れ条件

- [ ] 実機で撮影 → `photo-edit` → 未紐付けアップロードが動く
- [ ] 出力 JPEG に EXIF が無い（位置情報が落ちている）
- [ ] 他人の photo id は 404。SVG / GIF は 415。1MB 超は 413
- [ ] 未紐付け 24h 超が Cron で消える（テスト）
- [ ] 座標・合成の純粋関数に単体テスト
- [ ] DoD 5 項

## 9. セキュリティ観点

- security.mdc「ファイルアップロード」全項目。実体検証、サーバー生成キー、非公開バケット、認可付き配信
- ログにバイト列・キー・`user_id` を出さない
- Cron ハンドラは公開エンドポイントではない（`scheduled` のみ。HTTP で叩ける GC は作らない）

## 10. 関連ファイル / 関連spec

- [spec/screen-designs/07-photo-capture.md](../../spec/screen-designs/07-photo-capture.md)
- [spec/character.md](../../spec/character.md)
- [spec/api-design.md](../../spec/api-design.md) 4.7
- [spec/data-model.md](../../spec/data-model.md) 6.5
- 利用側: [../phase-03-drink-log/02-log-input-screen.md](../phase-03-drink-log/02-log-input-screen.md)、[../phase-04-cellar/04-photo-upload-r2.md](../phase-04-cellar/04-photo-upload-r2.md)、[../phase-05-tasting-note/03-multi-photo-attach.md](../phase-05-tasting-note/03-multi-photo-attach.md)

## 11. リスク・注意点

- iOS の `input[capture]` はライブラリ選択を出さない端末がある。`capture` 無しのボタン（「ライブラリから」）を `photo-edit` の「撮り直す」横に置くかは実機で判断し、設計を直してから足す
- 大きな元画像でメモリ不足 → `createImageBitmap` の `resizeWidth` で先に縮める
- `ctx.filter` の Safari 対応差
