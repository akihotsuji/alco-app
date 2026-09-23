# 写真パイプライン

実装: Phase 2-08。画面は [screen-designs/07-photo-capture.md](../screen-designs/07-photo-capture.md)。API は [api-design.md](../api-design.md) 4.7。合成数値は [character.md](../character.md) 5 章。

## 方針

- 取り込みは 2 経路。基本は撮影（`accept="image/*"` + `capture="environment"`）。保存済み写真は別ボタン（`capture` なし）。記録・セラー・ノートのフォームは「写真を撮る / 選ぶ」を同じ大きさで並べ、明示タップだけ。ホームに撮影開始のボタンは置かない。セラー追加のアプリ内導線は `?camera=1` を付けない。記録・ノートは `?camera=1` でも自動起動しない。`getUserMedia` は使わない
- 切り抜き・キャラ合成・JPEG 化はすべて端末内 Canvas。色補正はしない。サーバーは検証と保存だけ
- 「使う」直後に **未紐付け** で `POST /api/photos`。フォーム保存時の `photoIds` 紐付けは各機能フェーズ
- 背景除去の実体は 4-06（`onnxruntime-web` 1.21.0 + U2-Net-P。同一オリジン `/models/`。WASM 用 `.mjs` / `.wasm` と WebGPU/JSEP 用 `.jsep.mjs` / `.jsep.wasm` を `/models/ort/` へ明示）。本番既定の実行経路は WASM。WebGPU は経路として実装し、adapter・セッション・probe の成功と開発切替があるときだけ使う。GPU 障害は WASM へ最大 1 回。2-08 はトグル差し込み口と、WebP VP8X alpha / PNG IHDR color type 4・6 → `kind=cutout` のサーバー判定

## クライアント

| 関数 | 役割 |
|---|---|
| `pickImage` / `pickImages` | `source: "camera" \| "library"`。撮影は `capture=environment`、ライブラリは `capture` なし。ライブラリは `multiple` 可（まとめて追加）。キャンセルなら overlay を開かない。iOS は復帰後の `change` 遅れを focus ポーリングで待つ |
| `processCellarFile` | まとめて追加のライブラリ複数選択用。photo-edit を挟まず中央・拡縮 1 でセラー処理する。受け付けた行は先に一覧へ載せ、変換は 1 件ずつ、アップロードは同時最大 2 件 |
| `decodeImage` | `createImageBitmap` + EXIF orientation。長辺 2560 超は先に縮小。HEIC とデコード失敗は `<img>` 経路 |
| `computeCoverCrop` / `cropResize` | 4:5 / 2:3、拡縮 1.0〜3.0、長辺 1280 |
| `processLogFile` / `processLogPhoto` | 酒記録。全体リサイズ、認識用 JPEG、設定どおりキャラ合成。`photo-edit` を挟まない |
| `composeMascot` | 右下、短辺 22%、余白 4%、**グローなし**。線色 `#2B261F`。`pickMascotPose()` で 4 ポーズから抽選 |
| `toJpegBlob` / `toJpegBlobWithinLimit` / `toWebpBlob` / `toPngBlob` | JPEG 0.82 / 切り抜き WebP 0.9 / 切り抜き PNG。Canvas 再エンコードで EXIF なし。保存用 JPEG は品質を下げ、収まらなければ解像度も段階縮小し、**最終 `blob.size` を再検査**して 1MB 超なら送らない（最後の品質で書き出しただけでは上限内としない）。切り抜き OFF・非対応・失敗後の JPEG も同じ |
| `encodeCutoutBlob` | 切り抜きキャンバスを保存用にする。WebP を優先。iOS Safari のように `toBlob("image/webp")` が PNG を返す／失敗するときは **切り抜き済み PNG** を使う。切り抜き前 JPEG には落とさない。1MB 超は縮小。透過は維持。MIME と拡張子を一致させる |
| `preparePhoto` / `prepareRecognitionImage` | 比率・位置・拡縮の確定と、切り抜く前の 2:3 JPEG（ラベル読み取り用。色補正なし）。切り抜き ON の推論入力とは分離する |
| `computeInferenceRoi` / `workImageSize` | セラー切り抜き ON の推論領域。初期は元写真全体。拡大時だけ 2:3 窓を含む元縦横比の窓。作業画像は長辺 1600・総画素制限。stretch で 320×320 へ（letterbox なし） |
| `segmentBottle` / `composeBottleCutout` | セラーのみ。U2-Net-P を 1 本ずつ実行（WASM 既定、WebGPU は切替）。編集プレビューは実行中 1 + pending 最新 1。保存・バッチの別写真は FIFO（`superseded` で捨てない）。ORT 資産は同一オリジン `/models/ort/`。マスクは cleanup・品質判定を通し、画像・ROI・モデル・前処理版で再利用（角度・棚位置はキーに入れない）。傾きは元縦横比のマスクから推定し、安全なときだけ ±20° 以内を自動補正。失敗は `CutoutError`（理由付き） |
| `previewCutout` / `processPhoto` | 編集画面のプレビューと「使う」。同じマスクを共有し、角度変更は合成だけ。`processPhoto` は `cutout` に成否・理由・工程時間・provider を返す。失敗・未対応は JPEG 長方形（容量保証付き）。記録・ノートはキャラ合成前の JPEG を `recognizeJpeg` として返す。角度調整では認識 JPEG を作り直して入力を消さない |
| `cleanupMask` / `validateBottleMask` | 純粋関数。薄い alpha と小成分の除去、全面 foreground・左右端接触の判定 |

`localStorage`: `photo.mascot` / `photo.cutout` / `cellar.recognize`（設定画面と同じ）。旧 `photo.filter` は読まない。

認識用 JPEG の pending はフォームセッション（kind / sessionId / 世代）付き。破棄・保存完了・写真削除・画面離脱では削除 API 完了を待たず失効する。別フォームや別レコードの編集へ残存結果を適用しない。

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
- 配信: `GET /api/photos/:id/content`
  - クエリ `variant=thumb` は長辺 400px の派生（棚 100×150・ノートカード 160×200 の 2x）。`kind=photo` は JPEG、`kind=cutout` は PNG（アルファを残す）。省略時は保存原本。不正な `variant` は 400
  - 一覧（棚タイル・日別行・ボトルピッカー・ノートカード）だけ `?variant=thumb`。詳細ヒーロー・ライトボックス・編集・複製（`copy-owned-photo`）は原本
  - `Cache-Control: private, no-cache`。端末保存は可。表示のたびに認可後再検証する。削除・権限喪失のあと本文を再検証なしで出さない。1 年 immutable には戻さない。既存レスポンスへの遡及はしない
  - ETag は原本 `"{photoId}"`、サムネ `"{photoId}:thumb"`。`If-None-Match` が一致すれば **認可の後に** 304（本文なし。R2 を読まない）。他人・不明は一致しても 404
  - 派生の R2 キーは `{photoId}.thumb.jpg` / `{photoId}.thumb.png`。**端末が作って `POST /api/photos` の `thumb` パートで原本と一緒に送る**（`uploadPhoto` → `makeUploadThumb`。Canvas で長辺 400、`photo` は JPEG 0.75、`cutout` は透過 PNG）。Worker は magic bytes と寸法ヘッダだけ見て保存し、画像をデコードしない（無料枠の CPU 10ms/起動を超えるとアップロードが 503 になるため。2026-09-23）。派生が無い写真（旧クライアント・検査に通らない）は `thumb` でも原本を返す。複製（`duplicatePhotoObject`）は派生も R2 でコピーする。有料の画像 CDN / Cloudflare Images は使わない
  - 削除・未紐付け GC・アカウント削除は原本と派生を消す
- R2 put の前に `photo_object_reservations`（`r2_key` + `user_id`、lease。user CASCADE は付けない）へ予約する。put 直前にユーザー存在と lease を確認する。ユーザー削除後の遅延 put は予約が取れなければ書かない
- Cron（`0 18 * * *`）: 未紐付け 24h 超を最大 500 件、R2 → D1。R2 のタイムアウト・5xx・権限障害では D1 行を消さない（オブジェクト無しは成功）。件数だけログ。HTTP の GC は無い。同じ cron がアカウント削除の写真タスクと台帳転記も再実行する（[account-deletion.md](account-deletion.md)）
- 日次上限は `photos.uploaded_by`（なければ個人 `user_id`）をユーザー単位で数える。R2 書き込み前に判定する。詳細は [rate-limit-abuse.md](rate-limit-abuse.md)
- ボトル写真はセラー所有（`cellar_id`）。ノート・記録・未紐付けは個人所有。共有ボトル写真の GET はメンバー認可。退会者の共有写真は回収しない（[shared-cellar.md](shared-cellar.md) / [account-deletion.md](account-deletion.md)）

## 対象外（後続）

- 認識モデルの切替は [ai-recognition.md](ai-recognition.md)。記録・セラー・ノートの既定は同じ Gemini 3.7 Flash。セラー・ノートは単段（照合なし）
