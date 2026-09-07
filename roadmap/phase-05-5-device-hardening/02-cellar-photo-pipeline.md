# 5.5-02 セラー写真処理の安定化

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 5.5 実機検証・機能安定化 |
| ステータス | 未着手（調査基準は作成済み） |
| 追跡Issue | [#48 セラー登録時の写真処理](https://github.com/akihotsuji/alco-app/issues/48) |
| 調査基準 | `e1056ae`（2026-09-07のmain）。着手時にPhase 5完了後のmainで再確認する |

## 結論

Issue #48の中心となる「重複推論、古い推論の蓄積、一時失敗による設定変更、失敗理由の消失、弱いマスク判定、背景除去後に始まるラベル認識」は現行コードで確認できた。問題設定とCorrectness優先の順序は妥当である。

ただし、1件に確定バグ、計測基盤、並列化、WebGPU、COOP / COEP、モデル・プロンプト変更、50〜100枚の評価まで含めるのは大きすぎる。#48は追跡Issueにし、下記の小さなIssueを依存順に1件ずつ解決する。ランタイム・モデル変更は、P0/P1後の実測で必要性が示された場合だけ行う。

画面仕様にあった「失敗時は自動でOFF」は、今回の編集画面だけの状態を指すものと明確化した。処理失敗では`photo.cutout`を変更せず、ユーザーがトグルを手動操作したときだけ既定値を保存する。

## Investigation Result

### Confirmed

| 仮説 | 現行コードの根拠 | 判定 |
|---|---|---|
| A-1 重複推論 | `PhotoEdit`のプレビューが編集条件ごとに`processPhoto()`を呼び、「使う」でも同じ条件を再度`processPhoto()`する | 通常操作でも原則2回。パン・ズーム・色補正でさらに増える |
| A-2 staleキュー | UIは世代番号で古い結果を捨てるだけ。`remove-background.ts`の`runChain`は全リクエストをFIFOで保持する | 実行・pendingはキャンセルされず、latest-onlyではない |
| A-3 timeout後の継続 | `raceWithTimeout(session.run(...))`は外側Promiseだけをrejectする | `session.run()`は止まらず、直列チェーンが解放された後に次の推論と重なる可能性がある |
| A-4 一時失敗で永続OFF | JPEGフォールバック時に`setCutoutOn(false)`と`setCutoutPref(false)`を両方呼ぶ | 一時失敗が次回の`localStorage`設定へ波及する |
| A-5 失敗理由を消失 | `processPhoto()`が背景除去からWebP化までを`catch {}`でJPEGへフォールバックする | UI・テスト・計測から原因を識別できない |
| B-1 偽成功 | `maskHasSubject()`はalphaが16を超える画素が1%以上あるかだけを見る | 全面foregroundや背景残りも成功になり得る |
| B-2 低alpha背景 | マスクのcleanupがなく、`alphaBoundingBox()`の既定閾値は8 | 薄い背景でbboxが画像全面へ広がり得る |
| C-1 1 thread固定 | `ort.env.wasm.numThreads = 1` | 現状は常に単一スレッド |
| D-1 直列化 | recognition用JPEGは先に生成するが、`processPhoto()`が背景除去を完了して返るまでattachmentが作られず、`BottleForm`の認識リクエストも始まらない | 背景除去とラベル認識は直列。背景除去後は写真アップロードと認識が並行し得る |
| 観測性不足 | 背景除去に工程別計測がなく、ラベル認識はサーバー全体時間だけ | ボトルネックと失敗理由を比較できない |
| 推論結果キャッシュなし | sessionとモデルバイトは再利用するが、同じ画像・同じ編集条件のマスク / 切り抜き結果は再利用しない | プレビュー結果を保存時に使えない |

### Partially confirmed

| 仮説 | 現状 | 判断 |
|---|---|---|
| B-3 ボトル固有品質判定 | foreground比、bbox、中心、端接触、連結成分を評価していない | 追加は妥当。ただし閾値は実画像セットで決め、透明瓶などを一律に失敗させない |
| B-4 U²-Net-Pの精度限界 | 汎用モデルを使用していることは確認できる | 暗色瓶・透明瓶での実際の失敗率は未計測。先に重複・判定・観測性を直す順序が妥当 |
| D-2 recognition用画像 | 切り抜き前の2:3 JPEGを別Blobとして既に生成し、EXIFはCanvas再エンコードで除去する | 責務分離は済み始めているが、長辺1280・品質0.82固定で1MiB以下を保証せず、ラベル領域最適化もない |
| D-3 モデル / prompt | 現行はVision対応のLlama 4 Scout 17B、`max_tokens: 400`。schemaをpromptと`guided_json`の両方に書き、フォームで捨てる`abvPercent`も要求する | 削減余地はあるが「重すぎる」「軽量モデルが速く正確」は実測前に断定しない |
| エラー型 | ラベル側にはタイムアウト型とAPIエラーがある | cutout側は文字列`Error`、ラベル側もクライアントでは失敗帯へ集約され、工程別理由は保持しない |

### Not reproduced / already fixed

| 仮説・要望 | 現状 |
|---|---|
| D-4 provider抽象化がない | `LabelRecognizer`とWorkers AI adapterが既にあり、アプリケーション層はモデル名へ直接依存していない |
| AI出力を無検証でフォームへ入れる | サーバーで各フィールドをZod検証し、クライアントで確度0.5未満と既入力欄への上書きを防いでいる |
| recognitionに透過WebPを送る | 切り抜き前のJPEGを送っている |
| アップロード画像をクライアント申告だけで判定する | サーバーがmagic bytes、サイズ、寸法、WebP alphaを検査している |

## Current processing flow

```text
撮影 / 選択
  → デコード・向き補正
  → crop / resize / filter
  → preview用 processPhoto
      → recognition JPEG生成
      → 背景除去推論
      → mask判定・配置・WebP
  → 編集条件変更ごとに上記previewを再実行
  → 「使う」
      → 同じprocessPhotoを再実行
      → attachment作成
      ├─ 写真アップロード
      └─ BottleFormのeffectからラベル認識
```

## Target flow

```text
撮影 / 選択
  → preparePhoto（編集条件で一意のkey）
  → preview / 保存で共有するlatest-only背景除去
  → 「使う」
      → 編集条件を確定してrecognition JPEG生成
      ├─ 同じkeyのpreview結果を再利用。無ければ背景除去1回 → 写真アップロード
      └─ ラベル認識
  → 結果統合
```

ONNX推論自体を安全に中断できない場合は「実行中1件 + pending最新1件」とし、timeoutした実行が終了するまで次の`session.run()`を開始しない。UIで結果を無視することと、実行・待ち行列を制御することを分ける。

## Issue分割と依存順

### P0

1. **重複推論とunbounded FIFOの解消**
   - 編集条件key、preview結果再利用、実行中1件 + pending最新1件
   - 通常フローの同一条件推論は原則1回
   - timeout後に推論を重ねない
2. **一時失敗とユーザー設定の分離**
   - 処理失敗では画面内だけOFF / JPEGフォールバック
   - `photo.cutout`はユーザーがトグルを操作したときだけ更新
   - [写真編集の画面仕様](../../spec/screen-designs/07-photo-capture.md) と [セラー機能仕様](../../spec/features/cellar.md) の確定済み挙動に合わせる
3. **cutout結果型と失敗理由**
   - download / session / unsupported / timeout / inference / output / mask / encode / unknownを機械可読にする
   - `catch {}`をなくし、JPEGフォールバックを明示的な結果にする

### P1

4. **マスクcleanupとボトル品質検証**
   - 純粋関数として特徴量と判定理由を返す
   - 中央の縦長、全面foreground、微小foreground、薄い背景、端全面接触を人工maskでテスト
   - 実画像で誤検出・見逃しを記録してから閾値を確定
5. **背景除去とラベル認識の独立実行**
   - recognition JPEG生成後に認識を開始し、背景除去を待たない
   - 保存をラベル認識待ちにしない既存UXは維持
   - 撮り直し・画面離脱・保存後のstale結果は反映しない
6. **工程別timing**
   - 画像・ラベル文字・ユーザー情報を含めず、開発時に工程、時間、失敗codeを取得可能にする
   - 恒久的な詳細`console.log`や本番での画像識別子記録はしない

### P2 / P3（P0 / P1後に判断）

7. recognition画像の解像度・品質とprompt / tokenの比較
8. WebGPU → WASM fallbackの実機PoC
9. WASMマルチスレッドとCOOP / COEPの影響調査
10. 50〜100枚のローカル評価セット。必要な場合だけ背景除去 / Visionモデル交換

P2 / P3は1PRへまとめない。新モデルはコードと重みのライセンス、商用利用、再配布、帰属、ネットワークサービス条件を確認する。

## 解決策の妥当性と注意点

- Preview Option B（結果再利用）はUXを維持できるため第一候補。keyとメモリ解放を安全に実装できない場合は、Option A（保存時1回）を仕様変更として先に承認する
- `numThreads = 1`の解除だけではマルチスレッドにならない。ONNX Runtime Webは`crossOriginIsolated`を要求し、COOP / COEPはOAuth popupや外部リソースへ影響するため別Issueで検証する
- WebGPUは`onnxruntime-web/webgpu`、JSEP対応WASM、実行provider fallback、対応演算子、端末差の検証が必要。確定バグ修正へ同梱しない
- ラベルモデルの`max_tokens`は出力schemaの実測に合わせて下げられる可能性があるが、速度・欠落率・JSON妥当性を同じ画像で比較して決める
- `abvPercent`は現行フォームで使わないため、仕様を維持するならAI要求から外す候補。ただしAPI契約も同じPRで更新する
- 画像品質を速度のために無条件で下げない。切り抜き成功率、対象欠け、ラベル精度、ファイル上限を同時に評価する

参考:

- [ONNX Runtime Web: WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)
- [ONNX Runtime Web: env flags / numThreads](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html)
- [MDN: crossOriginIsolated](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)
- [Cloudflare Workers AI: Llama 4 Scout](https://developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/)

## テスト

- scheduler: 同一key再利用、pending最新1件、10回操作しても実行回数が有界、timeout後に重複実行しない
- preference: 処理失敗では永続値不変、ユーザー操作時だけ変更
- result: failure code別、JPEG fallback、WebP encode失敗
- mask: 人工maskのvalid / invalid / cleanupと判定理由
- label: valid / malformed / timeout / provider failure / stale無視。fallback providerを実装しない段階ではlow-confidence fallbackを必須にしない
- 回帰: log / noteのJPEG処理、セラーWebP / JPEGアップロード、BottleForm、写真認可
- 実機: 初回 / キャッシュ済み、連続パン・ズーム、暗色瓶、透明瓶、反射、近似色背景

## 受け入れ条件

- [ ] 着手時のmainで調査表を再確認し、#48へConfirmed / Partially / Not reproducedを記録
- [ ] #48を追跡Issueとして、P0 / P1を1関心事のIssueへ分割
- [ ] 同一写真・同一編集条件の通常フローで背景推論が原則1回
- [ ] 操作を繰り返してもpendingが最新1件を超えず、timeout後に推論が重ならない
- [ ] 一時失敗で`photo.cutout`が変わらず、失敗codeを識別できる
- [ ] 全面foreground等を成功にしない品質判定があり、実画像で誤判定を記録
- [ ] 背景除去を待たずラベル認識を開始でき、保存は認識待ちにならない
- [ ] Before / Afterの推論回数・各工程時間・品質・失敗理由を同一条件で比較
- [ ] log / noteを含む写真回帰、lint / typecheck / test / build、実機再確認が完了
- [ ] P2 / P3の各案が計測根拠付きで実施・延期・不採用のいずれかに分類

## セキュリティ

- 元画像・ラベル内容・認識結果を新たに保存またはログしない
- 写真APIのmagic bytes、1MiB、サーバー生成key、認可付き配信を維持する
- COOP / COEPや外部モデル配信先を変える場合はCSP、OAuth、全静的アセットを別PRで検証する
- 外部AI providerへ変更する場合は送信先をspecへ明記し、オーナー承認を得る
