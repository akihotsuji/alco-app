# 実機 QA（iOS Safari / Android Chrome）

実装: Phase 6-05。要件は [01-requirements.md](01-requirements.md) 非機能「対応デバイス」「PWA」。手順は [roadmap/phase-06-pwa-quality/05-device-qa.md](../roadmap/phase-06-pwa-quality/05-device-qa.md)。PWA 契約は [features/pwa.md](features/pwa.md)。ホーム追加の操作手順は [README](../README.md)。

飲酒記録・セラー・ノートの探索的な機能 QA は [Phase 5.5](../roadmap/phase-05-5-device-hardening/00-phase.md) が担当する。本ファイルは **表示・PWA・端末差** だけを扱う。

- 状態: **エージェント作業済み**（2026-09-09。チェックリスト・先回り修正・README 手順）。**オーナー実機確認は未実施**
- エージェントは実機を持てない。コードで潰せる崩れを先に直し、実施と記録はオーナーが行う

---

## 1. 目的

エミュレータでは分からないセーフエリア、PWA ホーム追加、入力ズーム、`100vh` 問題を潰す。Phase 6 DoD の「iOS / Android の両方でホーム追加するとスタンドアロン起動する」を確認する。

---

## 2. 方針（6-05 の確定）

| 項目 | 決定 | 理由 |
|---|---|---|
| サポート最小 | **iOS 17+ Safari** / **Android Chrome（最新および直前のメジャー）** | タスクの例を採用。`dvh`・`viewport-fit`・PWA スタンドアロンが揃う。定数は `src/shared/supported-devices.ts` |
| 古い OS | 対象外 | タスク「古い OS 全部」は見ない |
| 折りたたみ | 対象外 | 特殊ケース |
| PC | 崩れない程度。完全最適化はしない | モバイル第一 |
| スプラッシュ画像 | **`apple-touch-startup-image` の全解像度は作らない** | マニフェストの `background_color` + アイコンで足りる。真っ白が気になる場合は別 Issue |
| セッション | **30 日のまま延長しない** | 既存 [features/auth.md](features/auth.md)。ITP でログインが飛ぶ実測が出たら別 PR |
| インストール UI | **カスタムバナーは作らない** | 画面設計に無い。Android は Chrome 標準、iOS は共有メニュー |
| 機能不良 | コア機能の回帰は Phase 5.5 の Issue 運用 | 本タスクは PWA・表示・端末差 |

---

## 3. コード側で先に潰すもの

実装は `src/client/styles.css` の `--safe-*` / `--page-pad-x` と `src/client/lib/device-chrome.ts`。

| 項目 | 対応 |
|---|---|
| ノッチ / Dynamic Island | ヘッダー・`photo-edit` 上バー・ホーム（ヘッダーなし）・ログインに `safe-area-inset-top` |
| ホームバー | タブ・FAB・トースト・保存バー・ダイアログに `safe-area-inset-bottom`（既存をトークン化） |
| 横向きのノッチ | 左右に `safe-area-inset-left` / `right` |
| `100vh` | `100dvh` だけ使う（iOS 17+ / 現行 Chrome。Biome が同一プロパティの二重指定を禁止するため `100vh` フォールバックは置かない） |
| 入力ズーム | `input` / `textarea` / `select` を `max(16px, 1em)`。本文は既に 16px |
| 文字の自動拡大 | `html` に `text-size-adjust: 100%` |
| 横スクロール | `html` / `body` に `overflow-x: clip` |
| ラバーバンド | `overscroll-behavior-y: none`（`html` / `body`）。一覧は `contain`。引っ張り更新後の空画面は CSS 抑制だけでは直さない（[features/pwa.md](features/pwa.md)） |
| 短い横向き | 高さ 500px 以下で `photo-edit` と空状態の余白だけ詰める。タブ高さは変えない |

`viewport-fit=cover` と `interactive-widget=resizes-content` は `index.html` 既存。

---

## 4. オーナー実施チェックリスト

実施日と端末は機種名程度。実飲酒ログ・メール・顔が写った写真は PR に載せない（ぼかすかテストデータにする）。

URL は [dev-deploy.md](dev-deploy.md) の workers.dev（ドキュメントに書かない）。`pnpm dev` よりデプロイ URL の方が楽。

### 4.1 共通（両 OS）

- [ ] ログインできる
- [ ] 記録保存が 1 秒体感
- [ ] 下部タブがホームバーと重ならない
- [ ] キーボードで保存ボタンが使える（隠れない）
- [ ] 写真ピッカーが開く（撮る / 選ぶ）
- [ ] standalone でブラウザ UI が消える（アプリの下部タブだけ）
- [ ] 100 件でも一覧がスクロールできる
- [ ] ヘッダーやホーム見出しがノッチ / Dynamic Island に被らない
- [ ] 入力フォーカスでページ全体がズームしない
- [ ] 横向きで左右のノッチに文字やタブが食い込まない
- [ ] ライト / ダークの両方で地色がステータスバーまで続く
- [ ] 戻ったあとログイン状態が残る（当日中。ITP 確認）

### 4.2 iOS Safari

対象: iOS 17+。

- [ ] Safari でログイン → 1 タップ記録（または記録フォーム）→ 日別 / 週
- [ ] セラー写真（撮る or 選ぶ）→ `photo-edit` → 棚
- [ ] ノート作成（写真任意）
- [ ] 共有 → **ホーム画面に追加** → アイコンから起動
- [ ] スタンドアロンでタブバーが Safari と二重にならない
- [ ] スタンドアロン再起動後もセッションが残る

### 4.3 Android Chrome

対象: Chrome 最新（または直前メジャー）。

- [ ] 4.2 と同じ主要導線
- [ ] メニューの「アプリをインストール」または「ホーム画面に追加」
- [ ] インストールバナーがあれば試す（出なくても手順 2 で可）
- [ ] スタンドアロンでブラウザ UI が消える
- [ ] **戻るジェスチャでアプリが死なない**（フォームの戻るは 1 段、根で終了）

### 4.4 記録欄

| 項目 | iOS | Android | 日付 | 備考（OS 版は任意） |
|---|---|---|---|---|
| ブラウザ導線 |  |  |  |  |
| ホーム追加起動 |  |  |  |  |
| ブロッカーな崩れ |  |  |  | ゼロなら「なし」 |

---

## 5. 発見時の扱い

- **PWA・表示・端末差**（セーフエリア、ズーム、standalone、横向き）: このタスクの PR か後続 `fix/`。Issue 化するなら [.github/ISSUE_TEMPLATE/device-qa.yml](../.github/ISSUE_TEMPLATE/device-qa.yml)（対象機能に「PWA・表示・端末差」）
- **コア機能の回帰**（保存できない、認可、切り抜き失敗）: Phase 5.5。同時着手は 1 件

---

## 6. 対象外

- オフライン記録
- ストア申請
- 古い iOS / Android 全部
- 折りたたみの特殊レイアウト
- Phase 3〜5 の初回探索（5.5）
- カスタムインストールバナー

---

## 7. セキュリティ

- 実機スクショに実データの飲酒ログ・メール・顔を載せない
- Cookie・トークンを Issue / PR に貼らない
- 社内プロキシで Cookie が落ちるかは個人利用では無視してよい
- セッション Cookie の属性は変えない（httpOnly / Secure / SameSite=Lax）

---

## 8. 受け入れ

エージェント（本 PR）:

- [x] チェックリストがある
- [x] safe-area / `dvh` / 入力 16px / 横向き・ノッチをコードで潰した
- [x] PWA 追加手順が README にある
- [x] lint / typecheck / test
- [x] 監査: 表示修正のみ。認可・Cookie 属性・SW キャッシュ方針は変えていない

オーナー（マージ後でも可）:

- [ ] iOS と Android の両方でホーム追加起動（Phase 6 DoD）
- [ ] ブロッカーな崩れがゼロ
