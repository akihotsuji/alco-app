# 1-08 キャラクター（マスコット）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 1 設計 |
| ステータス | **レビュー待ち**（成果物: [spec/character.md](../../spec/character.md)、[spec/assets/character/](../../spec/assets/character/)。2026-09-05 オーナー指示で追加） |
| 要件 | ニューモーフィズムだけでは簡素なので、キャラクターを置いて少しポップに。赤ワインの入ったワイングラスに「Nani!?」風の目。写真の右下に置いてグラスに驚いている加工 |
| ソース | オーナー指示（2026-09-05） |

## 1. 概要

1 体のマスコットを定義し、ポーズ・サイズ・置き場所・写真合成・禁止事項を仕様化する。実装は 2-06（`<Mascot />`）と 2-08（合成）。

## 2. 前提条件

- 1-03 デザインシステム（線色はテーマ追従、ワイン色は固定）
- 1-07 と並行（モックに載せる）

## 3. スコープ

**対象**

- 造形（viewBox、線、色、最小サイズ）
- 4 ポーズ SVG（default / surprised / rest / cheer）
- 画面ごとの配置表
- 写真合成の数値（位置・大きさ・グロー・線色）
- モーション上限、禁止事項（飲酒助長禁止を含む）

**対象外**

- 名前の確定（仮称。UI に出さない）
- アプリアイコンの PNG 生成（6-01）
- 2 体目・表情追加

## 4. 成果物

- `spec/character.md`
- `spec/assets/character/mascot-{default,surprised,rest,cheer}.svg`
- design-system のキャラクタートークン節

## 5. 細分化タスク

1. 参考画像（Nani!? の目）から目の作法を決める
2. SVG を 4 ポーズ描く。ライト／ダーク両方で黒目が見えることを確認
3. 配置表と写真合成の数値を決める
4. 禁止事項（飲酒助長・会話・複数体）
5. オーナー承認

## 6. 手順

1-07 と同じ PR。SVG は `spec/assets/character/` に置き、`preview.html` にはインラインで埋め込む（`display:none` の sprite 内の `clipPath` は効かないので、sprite は `width:0;height:0` で隠す）。

## 7. 仕様詳細

[spec/character.md](../../spec/character.md) を正とする。要点:

- 黒目は固定 `#1F1B17`（ダークで `currentColor` にすると白目に溶ける）
- 写真合成は右下、短辺 22%、余白 4%、`surprised` のみ、線色は常にライト
- セラー写真には合成しない
- 待機アニメなし。反応は ≦300ms

## 8. 受け入れ条件

- [x] 4 ポーズの SVG がある
- [x] 配置・合成・禁止が数値で書いてある
- [x] 飲酒を促す文言に添えないと明記
- [ ] オーナー承認（モチーフ・ポーズ数・仮称）

## 9. セキュリティ観点

- SVG はリポジトリ内の静的アセット。ユーザーアップロードの SVG とは無関係（アップロード側は SVG 拒否）
- React ではインライン SVG コンポーネントとして描く。`dangerouslySetInnerHTML` で文字列を流し込まない

## 10. 関連ファイル / 関連spec

- 正本: [spec/character.md](../../spec/character.md)
- [07-detailed-screen-design.md](07-detailed-screen-design.md)
- [spec/design-system.md](../../spec/design-system.md) キャラクター節
- 実装: [../phase-02-platform/06-design-tokens-shadcn.md](../phase-02-platform/06-design-tokens-shadcn.md)、[../phase-02-platform/08-photo-pipeline.md](../phase-02-platform/08-photo-pipeline.md)

## 11. リスク・注意点

- キャラクターが「喋る」UI に育つとゲーミフィケーション薄めの方針と衝突する。会話禁止を守る
- 32px 未満で目が潰れる。トーストの 32px が下限
