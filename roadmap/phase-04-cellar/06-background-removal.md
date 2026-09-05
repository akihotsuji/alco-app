# 4-06 切り抜き（背景除去）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 4 セラー管理 |
| ステータス | **未着手** |
| 要件 | ボトル写真の背景を端末内で除去し、ガラス棚の上に本物のシルエットで立たせる |
| ソース | オーナー決定（2026-09-05）。画面は [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md) 陳列の写真、処理は [07-photo-capture.md](../../spec/screen-designs/07-photo-capture.md) P5b |

## 1. 概要

`photo-edit`（セラー文脈）に「切り抜く」トグルを足し、ブラウザ内 WASM で背景除去 → 透過 WebP（`photos.kind = cutout`）として保存する。失敗・未対応では長方形 JPEG にフォールバックする。棚（4-04）は `kind` で描き分ける。

## 2. 前提条件

- 2-08（`photo-edit`、`/api/photos`）
- 4-04（棚。`kind = photo` の長方形描画が先にある）
- data-model `photos.kind`、api-design 4.7 の `kind` 判定

## 3. スコープ

**対象**

- `src/client/lib/photo/remove-background.ts`（ライブラリを隔離。候補 `@imgly/background-removal`）
- 切り抜き結果を 2:3 透過キャンバスに下端揃えで配置し、足元に楕円の落ち影を焼き込む純粋関数
- `photo-edit` の P5b トグル、処理中 UI、初回モデル DL の進捗、失敗時のフォールバック文言
- モデルの配布先（同一オリジン `/models/` か CDN）。CDN なら CSP `connect-src` 更新
- サーバー: WebP の VP8X alpha フラグで `kind = cutout` を判定（クライアント申告は受けない）
- テスト: 配置・落ち影の座標（純粋関数）、`kind` 判定（alpha あり / なし WebP、JPEG）、フォールバック分岐
- 実機（iOS Safari / Android Chrome）で処理時間・メモリを確認

**対象外**

- 記録・ノート写真の切り抜き
- 切り抜きと長方形の両方保存（v1.x）
- サーバー側の背景除去

## 4. 成果物

- 上記ファイル群とテスト
- 依存追加の理由（ライセンス Apache-2.0、モデルサイズ、代替検討）を PR に明記

## 5. 細分化タスク

1. ライブラリ選定と動作確認（WASM SIMD 要件、モデルサイズ、処理時間）
2. `remove-background.ts` と配置 / 落ち影の純粋関数
3. `photo-edit` トグル・進捗・フォールバック
4. サーバー `kind` 判定
5. 棚・詳細で `cutout` を `object-fit: contain` で描く（4-04 の描き分けを有効化）
6. 実機確認、テスト、監査

## 6. 手順

```powershell
git fetch origin main
git checkout -b feature/bottle-cutout origin/main
pnpm add @imgly/background-removal   # 選定後。理由を PR に
pnpm test; pnpm lint; pnpm typecheck
```

## 7. 仕様詳細

- 出力: 透過 WebP、品質 0.9、2:3、長辺 1280、ボトルの下端がキャンバス下端から 4%（落ち影の分）
- 落ち影: 幅 = ボトル幅 × 0.8、高さ 6px 相当、黒 25%、ボトルの足元中央
- 実行条件: WebAssembly SIMD が使えること。使えない端末はトグル非表示で常に長方形
- モデルは初回だけ DL し Cache API に保存。オフライン時は切り抜き不可 → 長方形
- 処理中は「使う」を無効化。20 秒で諦めてフォールバック

## 8. 受け入れ条件

- [ ] 実機で撮影 → 切り抜き → 棚に透過ボトルが立つ
- [ ] 失敗・未対応・オフラインで長方形にフォールバックし、文言が出る
- [ ] `kind` がサーバー判定で正しく付く（テスト）
- [ ] 初回モデル DL の進捗が見える。2 回目以降は DL しない
- [ ] [04-cellar.md](../../spec/screen-designs/04-cellar.md) / [07-photo-capture.md](../../spec/screen-designs/07-photo-capture.md) の該当受け入れチェック
- [ ] DoD 5 項

## 9. セキュリティ観点

- 処理は端末内。画像は R2 以外に送らない
- モデルを CDN から取る場合は CSP に限定して追加し、`integrity` が使えるなら付ける
- WebP の alpha 判定は magic bytes と同じくヘッダ実体で行う。拡張子・申告を信用しない

## 10. 関連ファイル / 関連spec

- [spec/screen-designs/07-photo-capture.md](../../spec/screen-designs/07-photo-capture.md)
- [spec/screen-designs/04-cellar.md](../../spec/screen-designs/04-cellar.md)
- [spec/data-model.md](../../spec/data-model.md) 6.5 `kind`
- [04-photo-upload-r2.md](04-photo-upload-r2.md)、[../phase-02-platform/08-photo-pipeline.md](../phase-02-platform/08-photo-pipeline.md)

## 11. リスク・注意点

- モデル数十 MB の初回 DL。Wi-Fi でない環境で不快なら「今回は切り抜かない」を選べる（トグル OFF）
- 古い端末で処理が遅い・メモリ不足 → フォールバックで救う。棚は `kind` 混在を前提に描く
- ガラス瓶の透明部分や暗い背景で抜けが甘いことがある。プリセット `cellar` を掛ける前の画像で除去し、除去後に色補正を掛ける順にする
