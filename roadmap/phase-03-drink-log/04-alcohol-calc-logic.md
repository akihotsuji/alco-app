# 3-04 純アルコール量計算ロジック

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 3 飲酒記録 |
| ステータス | **未着手** |
| 要件 | 式と単体テスト必須（coding-standards、ロードマップ） |
| ソース | Phase 3「純アルコール量計算ロジック（単体テスト必須）」 |

## 1. 概要

`src/shared` に純粋関数を置き、サーバーもクライアントもこれを使う。要件の式以外を実装しない。

## 2. 前提条件

- 1-06 の丸め・範囲が承認済み
- Vitest が動く

## 3. スコープ

**対象**

- `calculateAlcoholGrams(volumeMl, abvPercent): number`
- （任意）日次合計、休肝判定の純粋関数
- 境界値テスト

**対象外**

- UI、API
- 式の変更（するなら requirements と 1-06 を先に）

## 4. 成果物

- `src/shared/alcohol.ts`（名前は任意）
- `src/shared/alcohol.test.ts`
- drink-log spec からのリンク確認

## 5. 細分化タスク

1. 関数と JSDoc（式をコメントせず spec へリンク。意図だけ）
2. 1-06 の例題をテストにする
3. 境界: 0、上限、小数
4. 不正入力は throw せず、呼び元 Zod に任せるか、関数内ガードか。**推奨: Zod 済みの number だけ受け、関数は純粋計算**

## 6. 手順

```powershell
git checkout -b feature/alcohol-calc
pnpm test
```

3-02 より先にマージすると入力画面が楽。

例題（1-06 と同じ。丸め仕様に合わせて expect を書く）:

- 125, 12 → 12
- 350, 5 → 14
- 30, 40 → 9.6
- 180, 15 → 21.6
- 60, 25 → 12
- 120, 15 → 14.4

## 7. 仕様詳細

```
alcohol_g = volume_ml * abv_percent / 100 * 0.8
```

合計関数を足す場合: 配列を足してから表示丸め。

密度 0.8 を定数 `ETHANOL_DENSITY = 0.8` にする。マジックナンバー散在禁止。

## 8. 受け入れ条件

- [ ] 単体テストが境界値を含む
- [ ] クライアントとサーバーが同じ関数を import
- [ ] CI グリーン
- [ ] 式が spec と一致

## 9. セキュリティ観点

- クライアント計算を API が信じない（サーバーでも同じ関数）
- NaN を DB に入れない（Zod）

## 10. 関連ファイル / 関連spec

- [../phase-01-design/06-alcohol-calc-presets.md](../phase-01-design/06-alcohol-calc-presets.md)
- [.cursor/rules/coding-standards.mdc](../../.cursor/rules/coding-standards.mdc)

## 11. リスク・注意点

- IEEE 小数で 9.6000000001。テストは `toBeCloseTo`
- 整数 ml × 整数% でも 0.8 で小数になる
