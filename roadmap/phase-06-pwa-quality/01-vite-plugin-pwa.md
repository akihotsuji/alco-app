# 6-01 vite-plugin-pwa導入

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 6 PWA・品質 |
| ステータス | **未着手** |
| 要件 | ホーム画面追加、スタンドアロン、アイコン、スプラッシュ。オフライン記録は対象外 |
| ソース | Phase 6「manifest、アイコン一式、スタンドアロン、テーマカラー」 |

## 1. 概要

PWA としてホーム画面から起動できるようにする。オフラインキューは作らない。

## 2. 前提条件

- Phase 5 まで SPA が動く
- 1-03 のテーマカラー
- `public/` にアイコンを置ける

## 3. スコープ

**対象**

- vite-plugin-pwa
- web manifest（name, short_name, display: standalone, theme_color, background_color, start_url）
- アイコン一式（少なくとも 192 と 512。Apple touch icon）
- テーマカラー

**対象外**

- オフライン記録、Background Sync
- プッシュ通知
- ストア申請

## 4. 成果物

- プラグイン設定
- `public` アイコン（著作権フリーまたは自作。TSUZUKIT のスクショを流用しない）
- スタンドアロンでタブバーがブラウザと二重にならない確認手順
- 依存追加理由を PR に

## 5. 細分化タスク

1. short_name（ホームアイコン下。短い日本語 or alco。**要確認**）
2. display standalone
3. SW 戦略: 静的は cache、API は network only（オフライン記録しない）
4. アイコン生成（マスク可能）
5. iOS の `apple-mobile-web-app-capable` 相当がプラグインで出るか確認
6. 実機追加は 6-05 と分担。本タスクはビルド成果とデスクトップ Chrome での installability

## 6. 手順

```powershell
pnpm add -D vite-plugin-pwa
```

`vite.config.ts` に登録。`wrangler` が SW ファイルを assets に含めるか確認（含まれないと PWA が壊れる）。

```powershell
pnpm build
pnpm exec wrangler dev
```

Lighthouse PWA 項目は 6-03 と一緒でも可。

ブランチ: `feature/pwa-manifest`

## 7. 仕様詳細

- start_url: `/` 認証後。未ログインならログインへ
- オフラインフォールバックページは任意。API 失敗時は既存 error UI
- theme_color は design-system のヘッダー色。可能なら `theme-color` メタを `prefers-color-scheme` でライト／ダークに分ける（OS追従）

**要確認**: アプリ表示名（仮称 alco-app のままか）

## 8. 受け入れ条件

- [ ] manifest がビルドに含まれる
- [ ] standalone 指定
- [ ] アイコンがある
- [ ] SW が API を無理にキャッシュして古いデータを出さない
- [ ] lint / typecheck
- [ ] 監査（SW が秘密をキャッシュしない）

## 9. セキュリティ観点

- SW の scope をアプリ全体にして中間者に注意（HTTPS 必須。Workers は HTTPS）
- API レスポンスを CacheFirst にしない（セッション付き JSON）

## 10. 関連ファイル / 関連spec

- [spec/01-requirements.md](../../spec/01-requirements.md) PWA
- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)
- [05-device-qa.md](05-device-qa.md)

## 11. リスク・注意点

- iOS は SW 対応が限定的。ホーム追加は manifest + apple メタが主
- 古い SW が残りデプロイ後に壊れる → skipWaiting / 更新手順を README に
