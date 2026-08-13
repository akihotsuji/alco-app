# 6-03 パフォーマンス改善

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 6 PWA・品質 |
| ステータス | **未着手** |
| 要件 | 初回表示 3 秒以内（4G）、記録操作 1 秒以内。Lighthouse モバイル Performance 目安 80 |
| ソース | Phase 6「バンドルサイズ、コード分割、画像遅延読み込み」 |

## 1. 概要

計測してから直す。推測でライブラリを足さない。

## 2. 前提条件

- 本番相当ビルド（`pnpm build`）
- チャート・shadcn・PWA 導入済み
- Lighthouse は Chrome モバイルエミュレーション

## 3. スコープ

**対象**

- バンドル分析
- ルート単位の code split（React.lazy または Router lazy）
- 画像 `loading=lazy`、適切な寸法
- Lighthouse Performance / Best Practices 80+
- 記録保存の体感（Optimistic は **要確認**。誤記録リスク）

**対象外**

- インフラの有料プラン
- 画像 CDN 新規契約

## 4. 成果物

- 計測結果のメモ（`spec/` か PR 本文。点数は変動するので日付付き）
- コード分割と lazy
- 明らかな重量依存の削減または dynamic import

## 5. 細分化タスク

1. `pnpm build` の chunk サイズを記録
2. Lighthouse モバイル 3 回平均
3. ボトルネック分類（JS、画像、フォント、メインスレッド）
4. 修正 PR は 1 関心ずつでも可。本タスクは 80 点到達まで
5. Best Practices（console、HTTPS、画像アスペクト）

## 6. 手順

```powershell
pnpm build
# rollup-plugin-visualizer を足すなら PR に理由。一時的なら devDep
```

Lighthouse: 認証壁があるため、ログイン後 URL を計測する方法を決める（一時的に計測用ルートは作らない。手動ログイン後に実行が現実的）。

記録操作 1 秒: ローカル wrangler と dev デプロイの両方。D1 往復を減らす（不要な refetch）。

## 7. 仕様詳細

- チャート lib をサマリールートだけ load
- アイコン SVG スプライトまたは lucide の個別 import
- フォントを自己ホストまたはシステム

**要確認**: 計測を CI の Lighthouse CI までやるか（無料枠・フレーク）。MVP は手動 + 記録で可。

## 8. 受け入れ条件

- [ ] Lighthouse モバイル Performance / Best Practices が目安 80+（Phase 6 DoD）
- [ ] 画像遅延読み込みがある
- [ ] 主要ルートが分割されている
- [ ] 点数の根拠が PR か spec に残る
- [ ] lint / typecheck / test

## 9. セキュリティ観点

- Best Practices と CSP の兼ね合い。性能のために CSP を外さない
- 計測拡張を本番バンドルに残さない

## 10. 関連ファイル / 関連spec

- [spec/01-requirements.md](../../spec/01-requirements.md) 非機能パフォーマンス
- [04-accessibility.md](04-accessibility.md) a11y 80 は別タスクだが同時計測可

## 11. リスク・注意点

- 開発モードで Lighthouse を回して点数を信じない
- 認証後画面が計測できないとホームのログイン画面だけ 80 点で欺瞞
