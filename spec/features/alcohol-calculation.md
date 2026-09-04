# 純アルコール量計算・標準グラス量プリセット

Phase 1-06 の成果物。記録入力・日次／週次／月次サマリー・マイドリンクの数値ルールの正本。

- 状態: **レビュー待ち**（本 PR のマージをもって承認とする）
- 要件の式とデフォルト表: [01-requirements.md](../01-requirements.md) 1.2（2026-08-13 FIX。式と表の数値は変えない）
- 永続化: [data-model.md](../data-model.md)（`alcohol_g` を保存。クライアント値は信じない）
- API: [api-design.md](../api-design.md)（サーバー再計算、`alcoholG` はリクエストに含めない）
- 実装: Phase 3-04（`src/shared` の純粋関数と単体テスト）

画面項目・最短タップ・undo は [wireframes.md](../wireframes.md) / 3-01。本ファイルは **数式・丸め・範囲・プリセット値・休肝日** だけを扱う。

---

## 1. 決定事項

1-06 の「要確認」を、要件・data-model・1-05 から落として確定する。異議があれば本 PR のレビューで指摘する。

| 項目 | 決定 | 根拠 |
|---|---|---|
| 計算式 | `alcohol_g = volume_ml × abv_percent / 100 × 0.8` | 要件 1.2。密度 0.8 は変えない |
| 単位 | **グラム（g）**。液量アルコール ml ではない | 要件の「純アルコール量（g）」 |
| 保存丸め | 生計算のあと **小数第 2 位・四捨五入** して `alcohol_g` に保存 | IEEE ドリフトを避け、API と DB を一致させる |
| 表示丸め | **保存値**を小数第 1 位に四捨五入して見せる | モバイルのスコア可読性。ワイヤーの「28 g」はダミー |
| 合計 | 各行の **保存値（第 2 位）を合算**し、表示時だけ第 1 位 | 行の表示丸めを足すと誤差が出る（1-05 の `totalAlcoholG` と同じ） |
| 杯数 | **1 行 = 1 杯**。量の大小は問わない | 750ml を 1 記録にしても 1 杯 |
| `volume_ml` | 整数 **1〜5000** | 一升瓶 1800・マグナム 1500・大ジョッキを手入力で賄う。グラフ破綻防止 |
| `abv_percent` | **0.1〜100**、小数第 1 位まで。**0% は不可** | 0% は酒として無意味。0g 記録と休肝日の混同を避ける |
| ボトル丸ごと | **専用 UI は作らない**。量の手入力で足りる | 上限 5000ml 内。チップはグラス量のみ |
| 量チップ | 種類ごとの下表。常に「手入力」あり | 変えるときだけ使う（1-02） |
| 種類変更 | その種類のデフォルト量・度数で **上書き** | 最短タップ。編集中の手入力は捨てる |
| 初期種類 | **ワイン**（125ml / 12%） | 1-02。種類 → 保存の 2 タップ |
| `drunk_at` 未来 | サーバー現在時刻 **+15 分まで**。超過は 400 | 1-05。時計ズレのみ。翌日予約はしない |
| `drunk_at` 過去 | **制限なし**（ISO として妥当なら可） | 1-05。遡及記録を阻まない |
| 日付境界 | 保存は UTC。帰属・集計・休肝は **Asia/Tokyo** | 2026-08-13 FIX |
| 休肝日 | その JST 日の `drink_logs` が **0 件** | 0.00g の行があっても休肝にしない |
| 未来日の休肝 | **数えない**（`isFuture: true`） | 1-05 |
| 週の始まり | **月曜（ISO 8601 / JST）** | 1-05。ホームの週マス（月〜日）と一致 |
| マイドリンク | 1 タップ時は **その時点の値をログへコピー** | 後編集は過去ログを変えない |

---

## 2. 計算式

```
alcohol_g = volume_ml × abv_percent / 100 × ETHANOL_DENSITY
ETHANOL_DENSITY = 0.8
```

0.8 はエタノール比重の近似（要件どおり）。温度補正や 0.789 への変更はしない。

- 入力の正は `volume_ml` と `abv_percent` だけ
- **API はクライアントの `alcoholG` を受け取らない**（作成・更新スキーマに置かない）
- サーバーは `src/shared` の同一関数で再計算して保存する
- 入力画面のライブ表示は同じ関数を呼んでよい。信頼境界はサーバー
- 編集で量または度数を変えたら、サーバーが `alcohol_g` を再計算する

---

## 3. 丸め

四捨五入は **正の数を 0 から遠い方へ**（JavaScript の `Math.round` と同じ。本アプリの量は常に正）。

| 段階 | 桁 | 使う場面 |
|---|---|---|
| 生計算 | IEEE number | 関数内部のみ。DB に生値は残さない |
| 保存 | 小数第 2 位 | `drink_logs.alcohol_g`、API レスポンスの行 `alcoholG` |
| 合計（API） | 保存値を合算したあと第 2 位 | `totalAlcoholG` |
| 表示 | 保存値（または合計の保存精度）を第 1 位 | ホームスコア、日別、グラフ軸、トースト |

実装の形（3-04。本タスクではコードを置かない）:

```ts
const ETHANOL_DENSITY = 0.8;

function roundHalfUp(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(Math.abs(value) * factor) / factor * Math.sign(value);
}

function calculateAlcoholGrams(volumeMl: number, abvPercent: number): number {
  const raw = (volumeMl * abvPercent) / 100 * ETHANOL_DENSITY;
  return roundHalfUp(raw, 2);
}

function displayAlcoholGrams(storedGrams: number): number {
  return roundHalfUp(storedGrams, 1);
}

function sumAlcoholGrams(storedGramsList: readonly number[]): number {
  const sum = storedGramsList.reduce((acc, n) => acc + n, 0);
  return roundHalfUp(sum, 2);
}
```

- `calculateAlcoholGrams` は Zod 済みの number だけを受ける。不正入力は throw せず、呼び元の Zod に任せる（3-04）
- `Math.round(x * 100) / 100` 単体は `1.005` 系の IEEE ずれで失敗しうる。実装とテストは **例題の期待値を正** にする
- UI の文字列は第 1 位を出してよい（`12.0 g`）。末尾 `.0` の省略は見た目の自由で、数値の意味は変えない
- 行の表示（9.6 + 9.6）を足して合計に使わない。必ず保存値を合算する

---

## 4. 種類とデフォルト（2026-08-13 確定）

DB 値は [data-model.md](../data-model.md) 5.3。種類選択時に下表を投入する。**保存するのはその記録の値**。種類デフォルトやマイドリンクの後編集は過去ログに影響しない。

| DB 値 | 表示 | デフォルト量 (ml) | 量チップ (ml) | デフォルト度数 (%) | 目安 |
|---|---|---:|---|---:|---|
| `wine` | ワイン | 125 | 125 / 150 | 12 | グラス1杯 |
| `beer` | ビール | 350 | 200 / 350 / 500 | 5 | 缶1本 |
| `whisky` | ウイスキー | 30 | 15 / 30 / 60 | 40 | ショット |
| `sake` | 日本酒 | 180 | 90 / 180 | 15 | 1合 |
| `shochu` | 焼酎 | 60 | 30 / 60 / 90 | 25 | 水割り・ロックの原酒1杯 |
| `cocktail` | カクテル | 120 | 60 / 120 / 200 | 15 | ショートカクテル1杯 |
| `other` | その他 | なし（手入力必須） | なし（手入力のみ） | なし（手入力必須） | デフォルトなし |

- 量チップは UI だけのショートカット。DB 列は作らない
- チップに無い量（ハーフボトル 375、ボトル 750、一升 1800 など）は **手入力**
- 焼酎 60ml は原酒目安。ロック多めは記録時に 90ml へ直せばよい
- 「その他」は量・度数が空。両方入るまで保存不可（1-02）
- `log-new` を開いた初期選択はワイン（125 / 12）。ユーザーはすぐ保存できる
- 種類を変えたら、新しい種類のデフォルト量・度数で上書きする（「その他」へ変えたら両方空）
- 度数にチップは置かない。ステッパーまたは手入力。刻みは **0.1**（バリデーションと同じ）

`src/shared` に定数として置く（名前は実装時に揃えてよい）:

```ts
export const DRINK_TYPE_PRESETS = {
  wine: { volumeMl: 125, abvPercent: 12, volumeChips: [125, 150] },
  beer: { volumeMl: 350, abvPercent: 5, volumeChips: [200, 350, 500] },
  whisky: { volumeMl: 30, abvPercent: 40, volumeChips: [15, 30, 60] },
  sake: { volumeMl: 180, abvPercent: 15, volumeChips: [90, 180] },
  shochu: { volumeMl: 60, abvPercent: 25, volumeChips: [30, 60, 90] },
  cocktail: { volumeMl: 120, abvPercent: 15, volumeChips: [60, 120, 200] },
  other: { volumeMl: null, abvPercent: null, volumeChips: [] },
} as const;
```

---

## 5. 入力範囲（Zod の正）

`drink_logs` と `my_drinks` で同じ範囲。DB CHECK は enum 以外は必須にしない（data-model）。

| 項目 | 範囲 | 備考 |
|---|---|---|
| `volumeMl` | 整数 1〜5000 | 小数は 400 |
| `abvPercent` | 0.1〜100、小数第 1 位 | **0 は 400**。100 は可 |
| `alcoholG` | サーバー計算のみ | 理論上限 4000.00（5000ml × 100%） |
| `drunkAt` | ISO 8601 UTC | 省略時は予定時刻。未来は +15 分まで。過去は制限なし |
| `drunkOn` | 入力しない | `drunkAt` の Asia/Tokyo カレンダー日 |

- `z.number().multipleOf(0.1)` は IEEE で失敗しうる。`min(0.1).max(100)` + refine（第 1 位）にする
- 範囲外は 400 `validation_error`。スタックや内部パスは出さない（1-05）
- マイドリンクの量・度数も同じ。`other` プリセットを作る場合も空は不可（保存時は値が必須）

---

## 6. 日時・日付境界・休肝日

| 規則 | 内容 |
|---|---|
| 保存 | 瞬間は UTC（DB は Unix ms、JSON は ISO `...Z`） |
| 表示 | Asia/Tokyo |
| 日の帰属 | `drunk_on` = `drunk_at` の JST 日付。サーバーが算出・再計算 |
| 休肝日 | その JST 日の記録が **0 件** |
| 0g 記録 | 休肝にしない（1ml × 0.1% は保存 0.00g でも 1 件） |
| 今日 | 記録 0 なら休肝（ホームの休肝ピル） |
| 未来日 | `isFuture: true`。休肝日数に入れない |
| 週 | アンカー日を含む ISO 週（月曜始まり、JST） |
| 月 | アンカー日の暦月（JST） |
| 複数 TZ | 個人利用では扱わない。集計で UTC 日付を使わない |

`drunk_at` を日付境界（JST 0:00）の前後に編集したら、日次合計と休肝判定が付け替わる。

日本は DST なし。`+9 hours` でも動くが、正は `src/shared` の TZ 変換。

---

## 7. マイドリンク

- 保存するのは `name` + `drinkType` + `volumeMl` + `abvPercent`（`alcohol_g` は持たない）
- `POST /api/my-drinks/:id/log` はサーバーがプリセットを読み、ログへコピーして `alcohol_g` を計算する
- クライアントが 1 タップ API に量・度数を混ぜることはしない（1-05 / 3-03）
- 通常の `POST /api/drink-logs` で `myDrinkId` を付ける場合、量・度数・種類はリクエストが正（どのプリセットから始めたかの記録）
- プリセットを後から変えても、過去ログの量・度数・`alcohol_g` は不変
- プリセット削除はログの `my_drink_id` を SET NULL。数値は残す

---

## 8. 例題（テストの種）

3-04 の単体テストはここを正とする。期待値は **保存丸め（小数第 2 位）**。

### 8.1 種類デフォルト（要件 1.2）

| 入力 | 生計算 | 保存 `alcohol_g` | 表示 |
|---|---:|---:|---:|
| ワイン 125ml 12% | 12 | 12.00 | 12.0 |
| ビール 350ml 5% | 14 | 14.00 | 14.0 |
| ウイスキー 30ml 40% | 9.6 | 9.60 | 9.6 |
| 日本酒 180ml 15% | 21.6 | 21.60 | 21.6 |
| 焼酎 60ml 25% | 12 | 12.00 | 12.0 |
| カクテル 120ml 15% | 14.4 | 14.40 | 14.4 |

### 8.2 丸め

| 入力 | 生計算 | 保存 | 表示 |
|---|---:|---:|---:|
| 333ml 5% | 13.32 | 13.32 | 13.3 |
| 123ml 7% | 6.888 | 6.89 | 6.9 |
| 100ml 13% | 10.4 | 10.40 | 10.4 |
| 1ml 0.1%（下限） | 0.0008 | 0.00 | 0.0 |
| 5000ml 100%（上限） | 4000 | 4000.00 | 4000.0 |

1ml × 0.1% は表示 0.0g でも **記録 1 件**。その日は休肝日ではない。

### 8.3 合計

保存済み 9.64g が 2 行ある日:

| 誤（表示を足す） | 正（保存を足す） |
|---|---|
| 9.6 + 9.6 = 19.2 | 9.64 + 9.64 = 19.28 → 表示 19.3 |

API の `totalAlcoholG` は 19.28。UI は 19.3g。

---

## 9. セキュリティ

| 規則 | 内容 |
|---|---|
| 改ざん | `alcoholG` をリクエストで受け取らない。サーバー再計算 |
| 範囲 | Zod で量・度数の上下限。極端値でグラフや整数溢れを起こさない |
| 共有関数 | 計算は `src/shared` のみ。サーバーとクライアントで式を複製しない |
| XSS | 本ファイルの対象外。メモはテキスト表示（3-01） |
| 認可 | 集計もセッションの `userId` のみ（1-05） |

---

## 10. 対象外

- 目標設定（週あたり上限、休肝日目標）— v1.x
- チャート実装 — 3-06
- 入力画面・API ハンドラ — 3-02 / 2-03
- 式や密度 0.8 の変更（するなら要件 1.2 を同じ変更で直す）
- ノンアルコール（0%）の記録
- 複数タイムゾーン

---

## 11. 受け入れ（1-06）

- [x] 式がドキュメントにあり要件 1.2 と一致
- [x] 7 種類すべてにデフォルト方針がある（その他は手入力）
- [x] 例題の期待値が書いてある
- [x] 丸めと日付境界が書いてある
- [ ] オーナー承認（本 PR）

---

## 12. 関連

- [01-requirements.md](../01-requirements.md) 1.2
- [data-model.md](../data-model.md) 5.6 / 9
- [api-design.md](../api-design.md) 2.9 / 4.3
- [wireframes.md](../wireframes.md) `log-new`
- [../roadmap/phase-01-design/06-alcohol-calc-presets.md](../../roadmap/phase-01-design/06-alcohol-calc-presets.md)
- 実装: [../roadmap/phase-03-drink-log/04-alcohol-calc-logic.md](../../roadmap/phase-03-drink-log/04-alcohol-calc-logic.md)
