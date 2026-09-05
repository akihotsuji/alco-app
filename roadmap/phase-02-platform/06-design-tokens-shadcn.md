# 2-06 デザイントークンとshadcn/ui導入

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **完了**（2026-09-05） |
| 要件 | Tailwind + shadcn、design-system |
| ソース | Phase 2「デザイントークン（Tailwind設定）とshadcn/ui導入、基本コンポーネント」 |

## 1. 概要

`spec/design-system.md` のトークンを Tailwind に落とし、ボタン・入力・カード等の shadcn コンポーネントを導入する。画面の量産はしない。

## 2. 前提条件

- 1-03 承認
- Vite + React
- ui-design ルールがあること（無ければ本 PR で追加）

## 3. スコープ

**対象**

- Tailwind CSS v4（`@tailwindcss/vite`。導入時点の shadcn Vite 手順）
- CSS 変数（design-system の全トークン。1-07 / 1-08 追補の `--mascot-*` / `--shelf-*` / `--radius-photo` / `--tab-center-size` を含む）
- shadcn: Button, Input, Label, Card, Dialog。Toast は 2-05 の `ToastProvider`（cheer / 5 秒 / タブ上配置が仕様どおり）。Tabs は下部タブが独自実装のため未導入。Form / Sheet は使わない
- **`<Mascot pose size />`**（4 ポーズは 2-05 で `src/client/components/mascot/Mascot.tsx` に実装済み。本タスクは Tailwind / shadcn への載せ替えとトークン同期）
- ログイン画面をこれらの部品で整える（キャラ `default` 120px。2-02 の見た目改善でも可）

**対象外**

- チャート
- 全ページのピクセル調整
- 独自コンポーネントライブラリの抽象化（使い始めるまで shadcn 直でよい）

## 4. 成果物

- `src/client/components/ui/*`（shadcn CLI 生成物）
- `tailwind` 設定とグローバル CSS
- トークンが design-system の HEX/OKLCH と一致する対応表（コメントまたは spec 同期）

## 5. 細分化タスク

1. Tailwind を Vite に入れる
2. shadcn init（パス `src/client`）
3. トークンを design-system に合わせて上書き
4. 基本コンポーネントを add
5. ログイン画面を置換して見た目確認
6. ui-design ルールでマジックカラー直書きを禁止

## 6. 手順

shadcn 公式の Vite 手順に従う。出力先を `src/client` に合わせ、Workers バンドルが CSS を含むことを確認。

```powershell
pnpm exec shadcn init
pnpm exec shadcn add button input label card
```

（コマンドは CLI 版で変わる。実行前に公式を読む。）

OS の外観設定に追従する（2026-08-13 確定）。`:root` にライト、`.dark` または `@media (prefers-color-scheme: dark)` にダークを置く。html に `.dark` を固定しない。アプリ内のテーマ切替 UI は作らない。

ブランチ: `feature/shadcn-tokens`

## 7. 仕様詳細

- 色は CSS 変数経由。`bg-[#123]` 禁止（ui-design）
- 角丸・余白はトークン
- フォントは 1-03 確定のシステムスタック。Web フォント CDN は足さない
- shadcn は Default + Stone。ニューモーフィズムの `--shadow-outset` / `--shadow-inset` / `--shadow-primary` で上書きする。色帯ヘッダーは置かない

Tailwind v4 は `@theme inline` で CSS 変数をユーティリティに写し、影は `@utility shadow-*` で `var(--shadow-*)` を参照する（ダーク切替で値が追従する）。`@custom-variant dark` は `prefers-color-scheme`。

## 8. 受け入れ条件

- [x] Button/Input/Card がストーリーなしでもログイン画面で使われている
- [x] `<Mascot />` 4 ポーズがライト／ダークで崩れない（黒目が見える）。SVG は [spec/assets/character/](../../spec/assets/character/) と同一
- [x] トークンが design-system と対応（ライト／ダーク両方）
- [x] OS のライト／ダーク切替で見た目が追従する（html に `.dark` 固定なし）
- [x] モバイル幅で崩れない
- [x] 追加依存の理由が PR にある
- [x] lint / typecheck

## 9. セキュリティ観点

- shadcn は手元のコンポーネント。外部 CDN コンポーネント実行を足さない
- フォント CDN を足すなら CSP 更新（2-03）

## 10. 関連ファイル / 関連spec

- [spec/design-system.md](../../spec/design-system.md)
- [spec/character.md](../../spec/character.md)
- [../phase-01-design/03-design-system.md](../phase-01-design/03-design-system.md)
- [../phase-01-design/08-character-mascot.md](../phase-01-design/08-character-mascot.md)

## 11. リスク・注意点

- `src/components` に生成されて project-context の `src/client` とずれる → alias を揃える
- コンポーネントを一度に add しすぎない（未使用コード）
