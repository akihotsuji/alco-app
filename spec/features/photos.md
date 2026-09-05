# 写真パイプライン

実装: Phase 2-08。画面は [screen-designs/07-photo-capture.md](../screen-designs/07-photo-capture.md)。API は [api-design.md](../api-design.md) 4.7。合成数値は [character.md](../character.md) 5 章。

## 方針

- 取り込みは `<input type="file" accept="image/*" capture="environment">`。`getUserMedia` は使わない
- 切り抜き・色補正・キャラ合成・JPEG 化はすべて端末内 Canvas。サーバーは検証と保存だけ
- 「使う」直後に **未紐付け** で `POST /api/photos`。フォーム保存時の `photoIds` 紐付けは各機能フェーズ
- 背景除去の実体は 4-06。2-08 はトグル差し込み口と、WebP VP8X alpha → `kind=cutout` のサーバー判定

## クライアント

| 関数 | 役割 |
|---|---|
| `pickImage` | `input[capture]`。キャンセルなら overlay を開かない |
| `decodeImage` | `createImageBitmap` + EXIF orientation。長辺 2560 超は先に縮小 |
| `computeCoverCrop` / `cropResize` | 4:5 / 2:3、拡縮 1.0〜3.0、長辺 1280 |
| `applyPreset` | `table` / `cellar` / `none`。`ctx.filter` 未対応ならスキップ |
| `composeMascot` | 右下、短辺 22%、余白 4%、背後グロー。線色 `#2B261F` |
| `toJpegBlob` | `image/jpeg` 品質 0.82。Canvas 再エンコードで EXIF なし |

`localStorage`: `photo.mascot` / `photo.filter` / `photo.cutout` / `cellar.recognize`（設定画面と同じ）。

## サーバー

| 検証 | 結果 |
|---|---|
| 未認証 | 401 |
| magic bytes 以外（SVG / GIF / HEIC 含む） | 415 |
| 1MB 超 | 413 |
| 長辺 1600 超 | 400 |
| 他人の photo / 紐付け先 | 404 |
| 所有者 2 つ以上 | 400 |

- `r2_key` は `{photoId}.jpg` 等。ファイル名・`user_id` を含めない
- レスポンスに `r2Key` / `userId` を出さない
- 配信: `Cache-Control: private, max-age=300`
- Cron（`0 18 * * *`）: 未紐付け 24h 超を最大 500 件、R2 → D1。件数だけログ。HTTP の GC は無い

## 対象外（後続）

- 作成 API の `photoIds`（3-02 / 4-02 / 5-03）
- WASM 背景除去（4-06）
- ラベル読み取り（4-07）
