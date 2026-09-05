# 2-05 共通レイアウト実装

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **完了**（2026-09-05） |
| 要件 | モバイルファースト、下部タブ（1-01 / 1-07: 記録が中央） |
| ソース | Phase 2「下部タブナビゲーション、ヘッダー、ローディング/エラー表示」 |

## 1. 概要

認証後シェル（タブ・ヘッダー）と、トースト・ダイアログ・空状態・loading / error の横断部品を **[spec/screen-designs/00-common.md](../../spec/screen-designs/00-common.md) のとおりに**実装する。各タブの中身はプレースホルダでよい（Phase 2 DoD は「空のホーム」）。

## 2. 前提条件

- 1-01 / 1-07 承認済みのタブ構成（正本: [spec/screens.md](../../spec/screens.md)、部品: [spec/screen-designs/00-common.md](../../spec/screen-designs/00-common.md)）
- 2-02 認証、2-04 Query（loading/error に接続）
- 2-06 と順序: トークンがあると見た目が正しい。並行するなら未トークンの Tailwind でも可

## 3. スコープ

**対象**

- React Router のルートツリー（`/cellar/archive` を `/cellar/:bottleId` より前に）
- 認証済みレイアウト / 未認証レイアウト
- 下部タブ 5: ホーム / セラー / **記録（中央、直径 60px の primary 円、12px 浮く）** / ノート / 設定
- ヘッダー（左 40px 円ボタン / タイトル / 右 1 アクション）
- トースト（5 秒、保存成功時は `cheer` 32px）、ダイアログ（下寄せカード）、空状態（キャラ 96px + 1 行 + 主ボタン）、`not-found`
- 全画面ローディング、クエリエラーの表示パターン
- 空のホーム（キャラ `rest`）

**対象外**

- 記録入力フォーム本体
- PWA スタンドアロンの safe-area 詰め込みは最低限（`viewport-fit` は Phase 6 でも可。今入れてよい）

## 4. 成果物

- `src/client` の layout コンポーネント
- ルート定義
- タブを押して URL が変わること

## 5. 細分化タスク

1. React Router（library モード）を導入する
2. `/login` `/signup` と認証後ルートを分ける
3. 下部タブ（現在地ハイライト）
4. ヘッダー（タイトルはルートで変える）
5. `loading` UI と `error` + 再試行
6. 実機幅（DevTools 390px）でタブが折り返さないか見る

## 6. 手順

```powershell
pnpm add react-router
```

ルートは [spec/screens.md](../../spec/screens.md) の表に従う（`/` `/logs` `/cellar` `/notes` `/settings` および配下）。

Worker の SPA フォールバックが無いと `/logs` リロードが 404。0-04 の設定を確認して直す。

safe-area: `pb-safe` 相当をタブに足し、iPhone ホームバーと重ならないようにする（完全検証は Phase 6-05）。

ブランチ: `feature/app-shell`

## 7. 仕様詳細

- タブは一覧・詳細では常時表示。作成・編集画面では隠す（[spec/screens.md](../../spec/screens.md)）
- 主アクションは画面内。FAB を足すかは 1-02 に従う
- エラー文は汎用。「Failed to fetch」生出しを避ける
- 設定タブにログアウト（2-02）を置く

## 8. 受け入れ条件

- [x] ログイン後に空ホームとタブが見える（Phase 2 DoD）
- [x] 未ログインでタブ配下が開けない
- [x] タブ遷移ができる。中央タブが `/logs` に着地し、現在地で inset になる
- [x] loading/error の出し方がある
- [x] モバイル幅で横スクロールしない。320px でラベルが折り返さない
- [x] [spec/screen-designs/00-common.md](../../spec/screen-designs/00-common.md) の受け入れチェック全項目
- [x] lint / typecheck

## 9. セキュリティ観点

- ルートガードは補助。API 401 が正
- ユーザー入力をヘッダータイトルに出す場合はテキストレンダリング

## 10. 関連ファイル / 関連spec

- 正本: [spec/screens.md](../../spec/screens.md)
- [../phase-01-design/01-screens-navigation.md](../phase-01-design/01-screens-navigation.md)
- [06-design-tokens-shadcn.md](06-design-tokens-shadcn.md)

## 11. リスク・注意点

- 5 タブでラベルが切れる
- ネストしたスクロール（タブ固定 + リスト）で iOS がバウンスしにくい → `min-h-dvh` と overflow を検証
