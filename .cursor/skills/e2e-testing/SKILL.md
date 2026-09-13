---
name: e2e-testing
description: alco-appのPlaywright E2E。主要導線のスモークを追加・実行・デバッグするとき、CIのe2eジョブが落ちたときに使用する。
---

# E2E テスト手順

正本は [spec/features/e2e.md](../../../spec/features/e2e.md)。手順の背景は [roadmap/phase-06-pwa-quality/02-playwright-e2e.md](../../../roadmap/phase-06-pwa-quality/02-playwright-e2e.md)。

## いつ使うか

- 横断導線（記録、セラー→ノート、認証後ホーム）を壊しうる変更
- `pnpm test:e2e` や CI ジョブ `e2e` が失敗したとき
- 新しいスモークシナリオを足すとき（全画面網羅はしない）

## 実行

```powershell
pnpm db:migrate:local
pnpm test:e2e
```

- 初回だけブラウザ: `pnpm exec playwright install --with-deps chromium`
- `.dev.vars` が無いと Better Auth が起動しない。`pnpm dev:vars` で使い捨て生成するか、`.dev.vars.example` をコピーして `BETTER_AUTH_SECRET` を入れる（値は git に出さない）
- `pnpm test`（Vitest）とは別。混ぜない
- アプリは Playwright の `webServer` が `CLOUDFLARE_VITE_FORCE_LOCAL=true` 付きで `pnpm exec vite` を上げる（Workers AI のリモートプロキシを切る）。既に `pnpm dev` があるときはそれを再利用する（CI では再利用しない）

デバッグ:

```powershell
pnpm exec playwright test --debug
pnpm exec playwright test --ui
pnpm exec playwright show-trace test-results/**/trace.zip
```

失敗後の HTML レポート: `pnpm exec playwright show-report`

## 書き方

- 置き場は `e2e/*.spec.ts`。ヘルパは `e2e/helpers/`
- ユーザーは毎回サインアップ。固定シード・本番アカウント禁止
- 日付は「今日」だけ見る。`Asia/Tokyo` は `playwright.config.ts` が設定する
- locator は role / label / 見える文言。CSS クラスや待ちの `waitForTimeout` を常用しない
- 写真は任意。撮るなら `filechooser`。自動でカメラを開く `?camera=1` は使わない
- 初回ガイドが出たら「今はしない」。ガイド練習 overlay を本番導線の代わりにしない
- 並列は 1 のまま（ローカル D1 競合）

## CI

`.github/workflows/ci.yml` のジョブ `e2e`。Chromium のみ。失敗時 artifact は 3 日。

落ちたとき:

1. artifact の `trace.zip` を `playwright show-trace` で見る
2. フレーク（起動待ち・ガイド・ダイアログ）なら locator と待ち対象を直す。リトライ上限は 2 のまま
3. アプリ側の回帰なら Vitest も足す

## やってはいけないこと

- `storageState` やトレースを git に入れる
- 本番 secret / 本番ユーザーを使う
- パスワードを `console.log` や expect メッセージに出す
- CI に `CLOUDFLARE_API_TOKEN` を足す。E2E は `CLOUDFLARE_VITE_FORCE_LOCAL=true` で足りる
