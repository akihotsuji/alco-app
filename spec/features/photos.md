# 写真パイプライン

実装: Phase 2-08。画面は [screen-designs/07-photo-capture.md](../screen-designs/07-photo-capture.md)。API は [api-design.md](../api-design.md) 4.7。合成数値は [character.md](../character.md) 5 章。

## 方針

- 取り込みは 2 経路。基本は撮影（`accept="image/*"` + `capture="environment"`）。保存済み写真は別ボタン（`capture` なし）。記録・セラー・ノートのフォームは「写真を撮る / 選ぶ」を同じ大きさで並べ、明示タップだけ。ホームに撮影開始のボタンは置かない。セラー追加のアプリ内導線は `?camera=1` を付けない。記録・ノートは `?camera=1` でも自動起動しない。`getUserMedia` は使わない
- 切り抜き・キャラ合成・JPEG 化はすべて端末内 Canvas。色補正はしない。サーバーは検証と保存だけ
- 「使う」直後に **未紐付け** で `POST /api/photos`。フォーム保存時の `photoIds` 紐付けは各機能フェーズ
- 背景除去の実体は 4-06（`onnxruntime-web` + U2-Net-P。同一オリジン `/models/`。ORT の glue `.mjs` と `.wasm` を同じディレクトリへ明示）。2-08 はトグル差し込み口と、WebP VP8X alpha → `kind=cutout` のサーバー判定

## クライアント

| 関数 | 役割 |
|---|---|
| `pickImage` / `pickImages` | `source: "camera" \| "library"`。撮影は `capture=environment`、ライブラリは `capture` なし。ライブラリは `multiple` 可（まとめて追加）。キャンセルなら overlay を開かない |
| `processCellarFile` | まとめて追加のライブラリ複数選択用。photo-edit を挟まず中央・拡縮 1 でセラー処理する |
| `decodeImage` | `createImageBitmap` + EXIF orientation。長辺 2560 超は先に縮小 |
| `computeCoverCrop` / `cropResize` | 4:5 / 2:3、拡縮 1.0〜3.0、長辺 1280 |
| `processLogFile` / `processLogPhoto` | 酒記録。全体リサイズ、認識用 JPEG、設定どおりキャラ合成。`photo-edit` を挟まない |
| `composeMascot` | 右下、短辺 22%、余白 4%、**グローなし**。線色 `#2B261F`。`pickMascotPose()` で 4 ポーズから抽選 |
| `toJpegBlob` / `toWebpBlob` | JPEG 0.82 / 切り抜き WebP 0.9。Canvas 再エンコードで EXIF なし |
| `preparePhoto` / `prepareRecognitionImage` | 比率・位置・拡縮の確定と、切り抜く前の 2:3 JPEG（ラベル読み取り用。色補正なし） |
| `segmentBottle` / `composeBottleCutout` | セラーのみ。WASM SIMD で U2-Net-P を 1 本ずつ実行（実行中 1 + pending 最新 1）。ORT の `.mjs` / `.wasm` は同一オリジン `/models/ort/` を明示。マスクは cleanup・品質判定を通し、同一条件では再利用。失敗は `CutoutError`（理由付き） |
| `previewCutout` / `processPhoto` | 編集画面のプレビューと「使う」。同じマスクを共有し、`processPhoto` は `cutout` に成否・理由・工程時間を返す。失敗・未対応は JPEG 長方形。記録・ノートはキャラ合成前の JPEG を `recognizeJpeg` として返す |
| `cleanupMask` / `validateBottleMask` | 純粋関数。薄い alpha と小成分の除去、全面 foreground・左右端接触の判定 |

`localStorage`: `photo.mascot` / `photo.cutout` / `cellar.recognize`（設定画面と同じ）。旧 `photo.filter` は読まない。

## サーバー

| 検証 | 結果 |
|---|---|
| 未認証 | 401 |
| magic bytes 以外（SVG / GIF / HEIC 含む） | 415 |
| 1MB 超 | 413 |
| 長辺 1600 超 | 400 |
| 他人の photo / 紐付け先 | 404 |
| 所有者 2 つ以上 | 400 |
| 同一ユーザーの JST 当日枚数が上限 | 429 `rate_limited`（8-05。数値は UI / PP に出さない） |

- `r2_key` は `{photoId}.jpg` 等。ファイル名・`user_id` を含めない
- レスポンスに `r2Key` / `userId` を出さない
- 配信: `Cache-Control: private, max-age=300`
- Cron（`0 18 * * *`）: 未紐付け 24h 超を最大 500 件、R2 → D1。件数だけログ。HTTP の GC は無い
- 日次上限は `photos.created_at` をユーザー単位で数える。R2 書き込み前に判定する。詳細は [rate-limit-abuse.md](rate-limit-abuse.md)

## 対象外（後続）

- 酒記録の外部モデル切替は [ai-recognition.md](ai-recognition.md)。セラー・ノートは Workers AI のまま
