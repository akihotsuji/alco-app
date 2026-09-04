# デザインシステム

Phase 1-03 の成果物。配色・型・余白・部品方針の正本。Phase 2-06（Tailwind トークン + shadcn）はこのファイルを写す。配置は [wireframes.md](wireframes.md)。

実装コードは本タスクの対象外。トークン名はそのまま CSS 変数にできる形にする。

---

## 原則

1. **使いやすさ最優先**。最短タップ、本文 16px 以上、タップ領域 44px 以上、本文コントラスト 4.5:1 以上（ライト／ダーク）。
2. **Win98 は essences だけ**。外観の引用であり、OS スキンの再現ではない。話題性と愛着は、枠・押下・一覧のメタファーで出す。
3. **ゲーミフィケーションは薄く**。ホームのスコア数字、休肝の点灯、ボタンが凹む、短いトースト。経験値・レベル・ガチャは置かない。
4. **テーマは OS 追従**。ライト／ダーク両方を定義する。アプリ内切替は持たない（`prefers-color-scheme` のみ。2026-08-13 確定）。
5. **色と影はトークン経由だけ**。`bg-[#123]` や適当な `shadow` 直書きは禁止（`ui-design` ルール）。

オーナー方針（2026-09-04）: Win98 寄りでドーパミンをくすぐりたい。過度な適用ではなく、デザインの外観だけ部分的に採用する。Windows のファイル配置の essences（一覧・プロパティ）は 1-02 のワイヤーに書いた。

---

## トーンのキーワード

| 採用 | 捨てる |
|---|---|
| ティールのタイトルバー、銀グレーの面 | 全面壁紙デスクトップ、アイコン散らし |
| 1px ハイライト／シャドウのべベル | ニューモーフィズムの厚いぼかし、ネオン全面 |
| エクスプローラ行、プロパティの縦並び | スタートメニュー、重ねウィンドウ、ファイルツリーナビ |
| 押すと凹むボタン、短い成功トースト | 紙吹雪、毎回の効果音、XP ゲージ |
| 大人の記録アプリの可読性 | ピクセルフォント本文、点滅、純正 Win98 256 色 |

ロードマップ原文の「大人向けの落ち着いたトーン」は、**面と本文は落ち着ける / クロームだけ Win98** と読み替える。

---

## カラー

値は sRGB HEX。実装時は同じ色を OKLCH または HSL の CSS 変数に落としてよい。コントラストは WCAG 2.2 相対輝度で計算し、本文は **4.5:1**、大きいスコア数字は **3:1** 以上。

### ライト

| トークン | HEX | 用途 |
|---|---|---|
| `--background` | `#D4D0C8` | アプリ地（クラシックの button face） |
| `--surface` | `#FFFFFF` | ウィンドウ内面、リスト |
| `--foreground` | `#1A1A1A` | 本文 |
| `--muted` | `#4A4A4A` | 補助テキスト |
| `--border` | `#808080` | 外枠・区切り |
| `--highlight` | `#FFFFFF` | べベルの明るい辺 |
| `--shade` | `#404040` | べベルの暗い辺 |
| `--chrome` | `#0A6B6B` | タイトルバー |
| `--chrome-fg` | `#FFFFFF` | タイトルバー上の文字 |
| `--primary` | `#0A6B6B` | 主ボタン塗り、リンク |
| `--primary-fg` | `#FFFFFF` | 主ボタン上の文字 |
| `--danger` | `#8B1E1E` | 削除確認の危険ボタンのみ |
| `--danger-fg` | `#FFFFFF` | 危険ボタン上の文字 |
| `--score` | `#0A6B6B` | スコア数字（surface 上では primary テキスト） |
| `--rest` | `#1F6B3A` | 休肝バッジの文字または枠 |

### ダーク

| トークン | HEX | 用途 |
|---|---|---|
| `--background` | `#1A2222` | 地 |
| `--surface` | `#2C2C2C` | ウィンドウ内面 |
| `--foreground` | `#F4F1EA` | 本文 |
| `--muted` | `#C4C0B8` | 補助テキスト |
| `--border` | `#6A6A6A` | 外枠 |
| `--highlight` | `#5A5A5A` | べベルの明るい辺（暗面では弱く） |
| `--shade` | `#0A0A0A` | べベルの暗い辺 |
| `--chrome` | `#0E5C56` | タイトルバー（本文白が 4.5:1 を満たす濃さ） |
| `--chrome-fg` | `#F4F1EA` | タイトルバー上の文字 |
| `--primary` | `#2A9A90` | 主ボタン塗り |
| `--primary-fg` | `#0A1212` | 主ボタン上の文字（明るいティールの上は暗い字） |
| `--danger` | `#C94C4C` | 危険ボタン |
| `--danger-fg` | `#FFFFFF` | 危険ボタン上の文字 |
| `--score` | `#2A9A90` | スコア数字 |
| `--rest` | `#7BC98A` | 休肝バッジ |

OS がダークならダークパレット。`html` に `.dark` を固定しない。

### コントラスト（検証済み）

| 前景 | 背景 | 比 | 用途 |
|---|---|---|---|
| `#1A1A1A` | `#FFFFFF` | 17.40 | ライト本文 / surface |
| `#1A1A1A` | `#D4D0C8` | 11.32 | ライト本文 / background |
| `#4A4A4A` | `#FFFFFF` | 8.86 | ライト muted / surface |
| `#4A4A4A` | `#D4D0C8` | 5.76 | ライト muted / background |
| `#FFFFFF` | `#0A6B6B` | 6.31 | ライト chrome / primary ボタン |
| `#0A6B6B` | `#FFFFFF` | 6.31 | ライト primary テキスト / surface |
| `#FFFFFF` | `#8B1E1E` | 9.12 | ライト danger |
| `#F4F1EA` | `#1A2222` | 14.37 | ダーク本文 / background |
| `#F4F1EA` | `#2C2C2C` | 12.38 | ダーク本文 / surface |
| `#C4C0B8` | `#1A2222` | 8.94 | ダーク muted / background |
| `#C4C0B8` | `#2C2C2C` | 7.70 | ダーク muted / surface |
| `#F4F1EA` | `#0E5C56` | 6.94 | ダーク chrome |
| `#0A1212` | `#2A9A90` | 5.53 | ダーク primary ボタン |
| `#FFFFFF` | `#C94C4C` | 4.54 | ダーク danger |

**使わない組み合わせ**: ライトで `--primary` `#0A6B6B` を `--background` `#D4D0C8` の上に小さく置かない（比 4.10。ボタン塗りか surface 上のテキストに限る）。

フォーカスリングは消さない。色は `--primary`、幅 2px、オフセット 2px。

---

## タイポグラフィ

**MVP はシステムフォントのみ。** Web フォントを入れない（PWA 初回 3 秒、CSP、ライセンスを増やさない）。

```text
font-family: system-ui, "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN",
  "Noto Sans JP", sans-serif;
```

ピクセルフォント・MS 社の資産を同梱しない。Win98 感はべベルと字間で出す。

| トークン | サイズ | 行間 | 用途 |
|---|---|---|---|
| `--text-caption` | 12px | 1.3 | タブラベル、バッジ。本文には使わない |
| `--text-body` | 16px | 1.5 | 本文・入力。**これ未満の本文禁止**（iOS ズーム防止） |
| `--text-title` | 18px | 1.3 | タイトルバー、セクション |
| `--text-score` | 32px | 1.1 | ホームの杯数・g だけ |

字重: 本文 400、タイトル 600、スコア 700。イタリックは使わない。

---

## スペーシング・半径・影

4px グリッド。

| トークン | 値 | 用途 |
|---|---|---|
| `--space-1` … `--space-8` | 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 px | 余白 |
| `--tap-min` | 44px | ボタン・タブ・行の最小高さ |
| `--radius` | 2px | 入力・小さなチップ |
| `--radius-window` | 0px | タイトルバー、ウィンドウ外枠 |
| `--header-h` | 48px | タイトルバー |
| `--tab-h` | 56px | 下部タブ（safe-area は別途足す） |

べベル（Material のぼかし影は使わない）:

| トークン | イメージ |
|---|---|
| `--shadow-outset` | 上左 `--highlight`、下右 `--shade` の 1px inset 相当 |
| `--shadow-inset` | 押下時・入力欄。`--shadow-outset` の反転 |
| `--shadow-window` | ウィンドウ外枠 1px `--border` + ごく薄い `--shade` |

実装は `box-shadow` をトークン化した utility（例: `shadow-outset`）に閉じる。値のマジックナンバー直書きは禁止。

---

## モーション（ドーパミン）

| 対象 | 時間 | 内容 |
|---|---|---|
| ボタン押下 | 80–120ms | `--shadow-inset` に切り替え。移動や拡大はしない |
| スコア更新 | 150ms 以内 | 数字が変わるだけ。カウントアップ演出は任意・1 回短い |
| トースト | 表示 5 秒（1-02） | 下から出す。自動で消える |
| それ以外 | 原則なし | 紙吹雪、バウンスループ、ページめくり禁止 |

効果音・バイブは MVP では入れない（端末差と「毎日うるさい」を避ける）。

---

## コンポーネント方針（shadcn）

- スタイル: **Default**（New York よりタップ領域を取りやすい）
- ベースカラー: **Stone**（銀グレー・暖色。Zinc の冷たいフラットを避ける）
- 生成物を土台に、上記トークンとべベルで上書きする。独自のコンポーネントライブラリは作らない

| 部品 | 方針 |
|---|---|
| Button | 主は `--primary` 塗り + `--shadow-outset`。押下で inset。高さ `--tap-min` |
| Input / Label | 面は `--surface`、枠は inset。ラベルは 16px |
| Card | ウィンドウ。上に `--chrome` 帯を付けてよい（ホームの「今日」、ログイン）。角 `--radius-window` |
| Tabs | 下部タブは shadcn Tabs を見た目だけ借りるか、独自バー。クラシックな上タブにはしない |
| Dialog | 削除確認など。中央の小さいウィンドウ。タイトルバーあり。ボタンは はい / キャンセル |
| Sheet | 使わない（1-02 で入力はフルスクリーン） |
| Toast | 成功・失敗の短文。undo アクション可。生の例外文は出さない |
| 行（リスト） | エクスプローラ。左アイコンまたはサムネ 48px、中央タイトル、右メタ。高さ 56px 以上 |

アイコン: **lucide-react**（shadcn 標準）。絵文字禁止。ピクセルアイコンセットは追加しない（依存を増やさない）。フォルダ／ファイルの意味は **配置** で出す。ストロークは 2。

---

## Do / Don't

**Do**

- 一覧は行、詳細はプロパティの縦積み
- 主アクションは画面内の大きな outset ボタン
- ライトとダークで同じ部品・同じ階層（色だけ変える）
- ユーザーが付けた銘柄名はテキストとして出す

**Don't**

- デスクトップ壁紙にショートカットを散らす、スタートボタンを置く
- 本文を 12px やピクセルフォントにする
- コントラスト不足のグレー文字、フォーカスリング削除
- 他ユーザーのボトルや「発見」
- 画面ごとのトーン分断（ホームだけヴェイパー、設定だけフラット、など）
- `dangerouslySetInnerHTML` で装飾 HTML を足す

---

## トークン一覧（実装コピー用）

```text
--background --surface --foreground --muted
--border --highlight --shade
--chrome --chrome-fg
--primary --primary-fg
--danger --danger-fg
--score --rest
--text-caption --text-body --text-title --text-score
--space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --space-7 --space-8
--tap-min --radius --radius-window --header-h --tab-h
--shadow-outset --shadow-inset --shadow-window
```

shadcn 標準名との対応: `background`→`--background`、`card`→`--surface`、`primary`→`--primary`、`destructive`→`--danger`、`muted-foreground`→`--muted`、`border`→`--border`、`radius`→`--radius`。`--chrome` とべベルは標準に無いので追加変数にする。

---

## セキュリティ・フォント

- 外部フォント CDN は使わない（CSP と供給元依存を増やさない）
- ユーザー指定色は無い
- エラー文は汎用。トークン名をユーザーに見せない

---

## 受け入れ（1-03）

- [x] 本ファイルがある。トークン名がコピーできる
- [x] ライト／ダーク両方と OS 追従を書いた
- [x] 本文コントラスト 4.5:1 を表で示した
- [x] `ui-design` ルールを追加する（同 PR）
- [x] フォントはシステムスタック（追加ライセンスなし）
- [ ] オーナー承認（Phase 1 DoD。この PR で取る）

---

## 関連

- [wireframes.md](wireframes.md)
- [screens.md](screens.md)
- 手順: [roadmap/phase-01-design/03-design-system.md](../roadmap/phase-01-design/03-design-system.md)
- 実装: [roadmap/phase-02-platform/06-design-tokens-shadcn.md](../roadmap/phase-02-platform/06-design-tokens-shadcn.md)
- ルール: [../.cursor/rules/ui-design.mdc](../.cursor/rules/ui-design.mdc)
