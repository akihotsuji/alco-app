# 6-02 Playwright E2E（CI組み込み）

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 6 PWA・品質 |
| ステータス | **未着手**（`e2e/` なし） |
| 要件 | 主要導線のスモーク |
| ソース | Phase 6「ログイン→記録→サマリー、ボトル登録→ノート作成を CI へ」 |

## 1. 概要

壊れやすい横断導線を E2E で固定する。skill `e2e-testing` も本タスクで作る。

## 2. 前提条件

- MVP 3 機能
- CI（0-07）。ジョブ追加
- テスト用ユーザーを毎回作るか、固定シードか。**要確認**（毎回サインアップ推奨）

## 3. スコープ

**対象**

- Playwright
- シナリオ 2 本（ロードマップどおり）
- CI（browser インストール、タイムアウト）
- skill ドキュメント

**対象外**

- 全画面網羅
- ビジュアルリグレッション
- 実 iOS クラウド

## 4. 成果物

- `e2e/` と `playwright.config.ts`
- `.github/workflows` の e2e ジョブ
- `.cursor/skills/e2e-testing/SKILL.md`
- package.json `test:e2e`

## 5. 細分化タスク

1. Playwright 導入、baseURL は wrangler dev または preview
2. 認証ヘルパ（UI ログイン）
3. シナリオ A: ログイン→記録→サマリー数字
4. シナリオ B: ボトル→ノート
5. CI で webServer 起動
6. skill（デバッグ: `--debug`、トレース）
7. フレーク対策（strict locator、wait の禁止乱用）

## 6. 手順

```powershell
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

CI は chromium のみ（無料枠）。ローカルで webkit を任意。

起動: アプリが D1 local を使うよう、E2E 用の migrate を webServer 前に実行。

```powershell
pnpm test:e2e
```

ブランチ: `feature/playwright-e2e`

パスワードは E2E 専用。本番ユーザーを使わない。

## 7. 仕様詳細

- 写真アップロード E2E はファイルchooser。初期は写真なしノートでもシナリオ B を満たせるが、ロードマップは登録→ノートなのでボトル必須。写真は任意ステップ
- CI の並列は 1 から（D1 ファイル競合）

## 8. 受け入れ条件

- [ ] 2 シナリオがローカルと CI でパス（Phase 6 DoD）
- [ ] 本番秘密を使わない
- [ ] skill がある
- [ ] フレークで main が赤のまま放置されない（リトライ上限を設定）

## 9. セキュリティ観点

- トレース artifact に Cookie が乗る。public リポジトリなら注意。private でも artifact 保持期間を短く
- テストの `storageState` を git にコミットしない

## 10. 関連ファイル / 関連spec

- [spec/02-tech-stack.md](../../spec/02-tech-stack.md) Playwright
- [../phase-00-project-foundation/07-github-actions-ci.md](../phase-00-project-foundation/07-github-actions-ci.md)

## 11. リスク・注意点

- wrangler dev の起動待ちで CI タイムアウト
- 日本語フォントで webkit のみ落ちる
- 日付が JST 依存で UTC ランナーとずれる → テストは相対「今日」
