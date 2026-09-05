# デザインシステム

Phase 1-03 の成果物（2026-09-04 改訂、2026-09-05 に 1-07 / 1-08 で追補）。配色・型・余白・部品方針の正本。Phase 2-06（Tailwind トークン + shadcn）はこのファイルを写す。配置は [screen-designs/](screen-designs/README.md)（詳細画面設計）。

**全体方針はニューモーフィズム + 1 体のキャラクター。** 面は地と同色の浮き／沈み、感情はキャラクター（[character.md](character.md)）で出す。Win98 寄りの essences は破棄済み。

アプリ本体（`src/client`）は本タスクでは実装しない。質感確認用の実装参照は [wireframes/mocks/tokens.css](wireframes/mocks/tokens.css) と [wireframes/mocks/preview.html](wireframes/mocks/preview.html)。モックはトークンと同じ CSS 変数で描いている。

---

## 原則

1. **使いやすさ最優先**。最短タップ、本文 16px 以上、タップ領域 44px 以上、本文コントラスト 4.5:1 以上（ライト／ダーク）。
2. **面はニューモーフィズムで統一する。** カード・チップ・入力・タブは、地と同じ色に柔らかい外光／内陰を置く。1px のハードべベルや OS スキンは使わない。
3. **主アクションだけ色を置く。** 灰色の凹凸だけでは「記録する」が埋もれる。primary はワイン系の塗り。選択状態は影だけでなく色または字重でも示す。
4. **ゲーミフィケーションは薄く。** 大きなスコア、休肝ピル、押して凹む、短いトースト。経験値・レベル・ガチャは置かない。
5. **テーマは OS 追従。** ライト／ダーク両方。アプリ内切替は持たない（`prefers-color-scheme`。2026-08-13 確定）。
6. **色と影はトークン経由だけ。** `bg-[#123]` やその場の `shadow` 直書きは禁止（`ui-design`）。
7. **ポップさはキャラクター 1 体と写真で出す。** 面や色数を増やして賑やかにしない。キャラクターの置き場所は [character.md](character.md) と各画面設計に従う。
8. **写真が主役の画面では、面より写真を大きく。** 記録・ノート・セラーの写真は角 `--radius-photo`、影は inset 枠。写真の上に文字を重ねない（キャラクターの合成だけ例外）。

オーナー訂正（2026-09-04）: 全体デザイン方針を **ニューモーフィズム** にする。Win98 / ヴェイパーウェーブは採用しない。  
オーナー指示（2026-09-05）: ニューモーフィズムだけでは簡素なので **キャラクターでポップさを足す**。記録・セラー・ノートは **写真を撮って記録する体験**に寄せる。セラーは **陳列**で見せる。

---

## トーンのキーワード

| 採用 | 捨てる |
|---|---|
| 地と同色の柔らかい浮き／沈み | 1px ハードべベル、Win98 タイトルバー |
| 角の大きい面、余白多め | 罫線だらけの表、デスクトップ壁紙 |
| ワインの主ボタン、大きなスコア | 全面ネオン、XP ゲージ、紙吹雪 |
| 本文は pen のように濃い | 薄いグレー文字、フォーカスリング削除 |
| 押下は inset に切り替わる | Material の長い影、ガラスのぼかし全面 |
| 目だけで驚く 1 体のキャラクター、写真が主役 | 複数キャラ、吹き出し会話、絵文字、スタンプ祭り |
| 木の棚に写真が並ぶセラー | 表形式の在庫リスト、Masonry |

ロードマップの「大人向けの落ち着いたトーン」は、**暖色の紙地 + ワインの一点アクセント + 少しだけ抜けた顔のキャラクター** と読む。

---

## カラー

値は sRGB HEX。影のハイライト／シェードは下表の RGBA。コントラストは WCAG 2.2、本文 **4.5:1**。

ニューモーフィズムでは **`--surface` は `--background` と同じ**（浮きは影だけで出す）。白い別面を重ねない。

### ライト

| トークン | 値 | 用途 |
|---|---|---|
| `--background` | `#E6E0D6` | 地・カード・行・タブ |
| `--surface` | `#E6E0D6` | background と同じ |
| `--foreground` | `#2B261F` | 本文 |
| `--muted` | `#5C564C` | 補助テキスト |
| `--primary` | `#7A3538` | 主ボタン、スコア、選択、リンク |
| `--primary-fg` | `#FFF8F4` | 主ボタン上の文字 |
| `--danger` | `#8B1E1E` | 削除確認のみ |
| `--danger-fg` | `#FFF8F4` | 危険ボタン上の文字 |
| `--rest` | `#2F5D3E` | 休肝ピルの文字 |
| `--score` | `#7A3538` | 杯数・g |
| `--ring` | `#7A3538` | フォーカス |
| `--neu-light` | `#FFFFFF` | 外光 |
| `--neu-dark` | `#C9C2B6` | 外陰 |

### ダーク

| トークン | 値 | 用途 |
|---|---|---|
| `--background` | `#2C2926` | 地・カード・行・タブ |
| `--surface` | `#2C2926` | background と同じ |
| `--foreground` | `#F4EDE4` | 本文 |
| `--muted` | `#C9BDB0` | 補助 |
| `--primary` | `#C47878` | 主ボタン塗り |
| `--primary-fg` | `#2A1818` | 主ボタン上の文字 |
| `--danger` | `#E07070` | 削除 |
| `--danger-fg` | `#2A1818` | 危険ボタン上 |
| `--rest` | `#8FCB9E` | 休肝 |
| `--score` | `#C47878` | スコア |
| `--ring` | `#C47878` | フォーカス |
| `--neu-light` | `#3A3632` | 外光（暗い面のハイライト） |
| `--neu-dark` | `#1A1816` | 外陰 |

実装では `:root` にライト、`@media (prefers-color-scheme: dark)` にダーク。`html` に `.dark` を固定しない。質感モックだけクラス切替を使う。

### コントラスト（検証済み）

| 前景 | 背景 | 比 | 用途 |
|---|---|---|---|
| `#2B261F` | `#E6E0D6` | 11.43 | ライト本文 |
| `#5C564C` | `#E6E0D6` | 5.53 | ライト muted |
| `#FFF8F4` | `#7A3538` | 8.35 | ライト主ボタン |
| `#7A3538` | `#E6E0D6` | 6.68 | ライト primary テキスト |
| `#2F5D3E` | `#E6E0D6` | 5.80 | ライト休肝 |
| `#FFF8F4` | `#8B1E1E` | 8.68 | ライト danger |
| `#F4EDE4` | `#2C2926` | 12.45 | ダーク本文 |
| `#C9BDB0` | `#2C2926` | 7.84 | ダーク muted |
| `#2A1818` | `#C47878` | 5.08 | ダーク主ボタン |
| `#2A1818` | `#E07070` | 5.41 | ダーク danger |
| `#8FCB9E` | `#2C2926` | 7.71 | ダーク休肝 |

フォーカスリングは消さない。`2px solid var(--ring)`、オフセット 2px。

**禁止**: 影だけを手がかりにした選択。`--muted` を本文に使わない。カードを白 `#FFF` にして地と切らない。

---

## タイポグラフィ

**MVP はシステムフォントのみ。** Web フォント CDN は使わない。

```text
font-family: system-ui, "Hiragino Sans", "Hiragino Kaku Gothic ProN",
  "Segoe UI", "Noto Sans JP", sans-serif;
```

| トークン | サイズ | 行間 | 用途 |
|---|---|---|---|
| `--text-caption` | 12px | 1.3 | タブラベルのみ。本文禁止 |
| `--text-body` | 16px | 1.5 | 本文・入力・チップ |
| `--text-title` | 20px | 1.3 | 画面タイトル |
| `--text-score` | 40px | 1.0 | 杯数・g のみ |

字重: 本文 400、タイトル 600、スコア 650。イタリックなし。字間は広げすぎない。

---

## スペーシング・半径・影

4px グリッド。角は大きめ（ニューモーフィズムの前提）。

| トークン | 値 | 用途 |
|---|---|---|
| `--space-1` … `--space-8` | 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 px | 余白 |
| `--tap-min` | 44px | 最小タップ |
| `--radius` | 16px | ボタン、入力、行 |
| `--radius-card` | 24px | スコアカード、ログインカード |
| `--radius-pill` | 999px | チップ、休肝 |
| `--header-h` | 56px | ヘッダー |
| `--tab-h` | 72px | 下部タブ＋余白（2026-09-05: 中央タブが浮くため 64 → 72） |
| `--tab-center-size` | 60px | 中央「記録」タブの円 |
| `--radius-photo` | 20px | 写真・写真タイル |

影（値をそのまま `box-shadow` に入れる）:

| トークン | ライト | ダーク |
|---|---|---|
| `--shadow-outset` | `8px 8px 16px #C9C2B6, -8px -8px 16px #FFFFFF` | `8px 8px 16px #1A1816, -6px -6px 14px #3A3632` |
| `--shadow-inset` | `inset 6px 6px 12px #C9C2B6, inset -6px -6px 12px #F7F3EC` | `inset 6px 6px 12px #1A1816, inset -4px -4px 10px #3A3632` |
| `--shadow-primary` | `6px 10px 18px rgba(122, 53, 56, 0.28)` | `6px 10px 18px rgba(0, 0, 0, 0.45)` |

押下・選択中のチップ／週マスは `--shadow-inset`。入力も inset。カード・行・非選択チップは `--shadow-outset`。主ボタンは塗り + `--shadow-primary`。押下で `--shadow-inset` かつ少し暗くする。

Material の `0 10px 40px` 一方向ドロップや、1px ハイライトべベルは使わない。

---

## モーション

| 対象 | 時間 | 内容 |
|---|---|---|
| 押下 | 120ms ease | outset → inset。拡大しない |
| スコア | 150ms 以内 | 数字が変わる |
| トースト | 5 秒（1-02） | 下から。自動で消える |
| それ以外 | なし | 紙吹雪、ループ、パララックス禁止 |

効果音・バイブは MVP では入れない。

---

## コンポーネント方針（shadcn）

- スタイル: **Default**
- ベース: **Stone**（暖色。Zinc は冷たいので使わない）
- 生成物をトークンで上書きする。`border` はほぼ透明。見た目の境界は影

| 部品 | 方針 |
|---|---|
| Button 主 | `--primary` 塗り、角 `--radius`、高さ 52px、`--shadow-primary` |
| Button 副 | 地色 + `--shadow-outset`。押下 inset |
| Input | 地色 + `--shadow-inset`。枠線なし。ラベル 16px |
| Card | 地色 + `--shadow-outset`、角 `--radius-card`。色帯ヘッダーは置かない |
| Tabs | 下部。アクティブは inset + primary 色のアイコン |
| Dialog | 地色カード。タイトルはテキストのみ |
| Sheet | 使わない |
| Toast | 地色 + outset。undo は primary テキスト。保存成功時は左端に `cheer` 32px |
| 行 | 地色 + outset。左 48px サムネ、高さ 64px 以上 |
| 中央タブ（記録） | 直径 `--tab-center-size` の円。`--primary` 塗り + `--shadow-primary`、タブバー上端から 12px 浮く。アイコンはグラス。他 4 タブは従来どおり |
| 写真タイル（撮影前） | 地色 + inset、角 `--radius-photo`、中央にカメラアイコン + 「写真を撮る」。右下に `surprised` 48px |
| 写真（撮影後） | 角 `--radius-photo`、inset 枠。比率は文脈で固定（記録・ノート 4:5、セラー 2:3） |
| 棚（セラー） | 横一杯の棚板 `--shelf-rail` 高さ 14px + 下に `--shadow-outset`。ボトルは棚板の上に 3 本／段（390px）。棚板は 2:3 の写真の下端に接する |
| 貯蔵庫（アーカイブ）のボトル | 同じ棚。写真に `filter: saturate(0.6) brightness(0.92)`。右上に消費日ピル |
| 空状態 | 説明 1 行 + 主ボタン。上にキャラクター 96px（ポーズは character.md） |

アイコン: **lucide-react**、ストローク 2、絵文字禁止。

ヘッダーは色帯にしない。戻るは円形の outset ボタン。

---

## キャラクター（1-08 追補）

正本は [character.md](character.md)。ここではトークンだけ。

| トークン | ライト | ダーク | 用途 |
|---|---|---|---|
| `--mascot-wine` | `#8E2F3C` | `#8E2F3C` | キャラのワイン（テーマで変えない） |
| `--mascot-wine-light` | `#B34A5A` | `#B34A5A` | 水面ハイライト |
| `--mascot-ink` | `#1F1B17` | `#1F1B17` | 黒目・閉じた目（テーマで変えない） |
| `--mascot-line` | `var(--foreground)` | `var(--foreground)` | 輪郭（`currentColor` で継承） |
| `--mascot-glow` | `rgba(255,255,255,0.6)` | 同じ | 写真合成時の背後グロー |

サイズは `size` プロップ（px）。トークンにしない。

---

## 陳列・写真（1-07 追補）

| トークン | ライト | ダーク | 用途 |
|---|---|---|---|
| `--shelf-rail` | `#B99A78` | `#5A4634` | 棚板の塗り |
| `--shelf-rail-edge` | `#8F7458` | `#3E2F22` | 棚板の前面下辺 2px |
| `--radius-photo` | 20px | 20px | 写真の角 |
| `--photo-ratio-log` | 4 / 5 | 同じ | 記録・ノート写真 |
| `--photo-ratio-bottle` | 2 / 3 | 同じ | セラー写真 |
| `--tab-center-size` | 60px | 同じ | 中央タブ円 |
| `--tab-h` | **72px**（64 → 72 に改訂） | 同じ | 中央タブが浮く余白を確保 |

写真の色補正プリセット（Canvas `filter`。数値は正本、変えるなら本表を直す）:

| プリセット | filter | 用途 |
|---|---|---|
| `table` | `saturate(1.08) contrast(1.04)` | 記録・ノート（食卓の一杯） |
| `cellar` | `saturate(1.05) contrast(1.06) brightness(0.97) sepia(0.10)` + 周辺減光（半径 0.75、濃度 0.25） | セラー陳列 |
| `none` | なし | ユーザーが OFF にしたとき |

棚板の上に載る写真は **2:3 縦**。切り抜き（背景除去）は MVP では行わない（[screen-designs/04-cellar.md](screen-designs/04-cellar.md) の v1.x 注記）。

---

## Do / Don't

**Do**

- 地と部品を同色にし、影で階層を出す
- 本文は濃い色。選択は inset + 色
- ライトとダークで同じ部品構造
- 銘柄名はテキストとして出す

**Don't**

- Win98 タイトルバー、スタート、1px べベル
- 白いカードを紙地の上に乗せる（ニューモルが壊れる）
- 薄いグレー本文、フォーカス削除
- 他ユーザーの発見 UI
- 画面ごとに別トーン
- `dangerouslySetInnerHTML`
- キャラクターを 2 体以上、吹き出しで話させる、飲酒を促す文言に添える
- 写真の上に銘柄名や数値を重ねる（キャラ合成だけ例外）

---

## トークン一覧（実装コピー用）

```text
--background --surface --foreground --muted
--primary --primary-fg --danger --danger-fg
--rest --score --ring
--neu-light --neu-dark
--text-caption --text-body --text-title --text-score
--space-1 … --space-8 --tap-min
--radius --radius-card --radius-pill --radius-photo --header-h --tab-h --tab-center-size
--shadow-outset --shadow-inset --shadow-primary
--mascot-wine --mascot-wine-light --mascot-ink --mascot-line --mascot-glow
--shelf-rail --shelf-rail-edge --photo-ratio-log --photo-ratio-bottle
```

shadcn: `background`/`card` → `--background`、`primary` → `--primary`、`destructive` → `--danger`、`muted-foreground` → `--muted`、`radius` → `--radius`。`border` は `transparent` 相当。

参照実装: [wireframes/mocks/tokens.css](wireframes/mocks/tokens.css)

---

## セキュリティ・フォント

- 外部フォント CDN は使わない
- ユーザー指定色は無い
- エラー文は汎用

---

## 受け入れ（1-03）

- [x] 本ファイルがある。方針はニューモーフィズム
- [x] トークン名がコピーできる
- [x] ライト／ダークと OS 追従
- [x] 本文 4.5:1 を表で示した
- [x] `ui-design` を方針に合わせて更新
- [x] フォントはシステムスタック
- [x] オーナー承認（2026-09-04。画面の細部は後から直してよい）
- [ ] 1-07 / 1-08 追補（キャラクター・陳列・写真・中央タブのトークン）のオーナー承認

---

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-09-04 | ニューモーフィズムへ方針変更。セラー風陳列は「将来」とした |
| 2026-09-05 | オーナー指示により **陳列を MVP へ繰り上げ**。キャラクター・写真・中央タブのトークンを追補。`--tab-h` 64 → 72 |

---

## 関連

- [screen-designs/](screen-designs/README.md)（詳細画面設計。配置の正本）
- [character.md](character.md)
- [wireframes.md](wireframes.md)（1-02 の骨格。履歴）
- [screens.md](screens.md)
- 手順: [roadmap/phase-01-design/03-design-system.md](../roadmap/phase-01-design/03-design-system.md)
- 実装: [roadmap/phase-02-platform/06-design-tokens-shadcn.md](../roadmap/phase-02-platform/06-design-tokens-shadcn.md)
- ルール: [../.cursor/rules/ui-design.mdc](../.cursor/rules/ui-design.mdc)
