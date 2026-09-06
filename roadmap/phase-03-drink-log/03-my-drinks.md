# 3-03 マイドリンク（プリセット）の登録・1タップ記録

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 3 飲酒記録 |
| ステータス | **未着手** |
| 要件 | よく飲む組み合わせをプリセットし 1 タップ記録 |
| ソース | Phase 3 マイドリンク |

## 1. 概要

マイドリンク CRUD と、ホーム等からの 1 タップで drink_log を切る機能。ログにはプリセット値をコピーし、後のプリセット編集が過去に影響しない。

## 2. 前提条件

- 3-01 承認、3-02 の POST ログ API
- データモデルの `my_drinks`

## 3. スコープ

**対象**

- マイドリンクの作成・一覧・編集・削除（[spec/screen-designs/03-log.md](../../spec/screen-designs/03-log.md) `mydrink-*`。親タブはホーム、入口はホームの「管理」）
- 1 タップ記録（現在時刻、コピーした type/volume/abv）。チップは **ホームのみ**（最大 4。日別には置かない。2026-09-06 (c)）
- 件数上限 30（data-model 5.6 で確定）
- ホームの今日カードとキャラクター（`default` / `rest`、1 タップ後 `cheer` 300ms + 上 4px。[spec/screen-designs/02-home.md](../../spec/screen-designs/02-home.md)）
- 1 タップのモーション（[spec/motion-design.md](../../spec/motion-design.md)）: チップの送信中 inset 維持と成功の水位線（M-07 / M-08）、数字カウント（M-09）、今日の週マスが満ちる（M-17）、休肝ピルのフェード（M-18）、ホーム主ボタンの 1 回出現（M-03）。`haptic("success")`
- **ホームの導線と中央タブの切替**（2026-09-06 オーナー確定 (c)。[spec/screen-designs/00-common.md](../../spec/screen-designs/00-common.md) 1.2、[02-home.md](../../spec/screen-designs/02-home.md) H2 / H9 / H13）
  - 中央タブ「記録」: `/logs` へのナビゲーションをやめ、タップで記録用 `photo-edit` を開く。「使う」で `/logs/new` を写真付き（`attachments.log` を `log-new` の N2 として受け取る）で開く。× / OS キャンセルは何もしない。現在地ハイライト（`/logs` 配下で中央タブが inset）を外し、`/logs` 配下の親タブをホームにする（`app-routes.ts`）。再タップも撮影から
  - ホームのカメラ円ボタン H9: 中央タブと同じ挙動（`?camera=1` は使わない）
  - 今日カード H2 → 今日の `/logs`。カード右上に「今週 ›」H13 → `summary-week`（ルートは 3-06 で実装。3-03 ではリンクだけ置く）
  - 週マスのタップ先をその日の `/logs/:date` に（X6。未来は無効）

**対象外**

- 並び替え DnD（sort_order カラムがあれば手動数値で可）
- ボトルからのマイドリンク生成

## 4. 成果物

- `/api/my-drinks` CRUD
- `POST /api/my-drinks/:id/log`（1-05 で必須。サーバーがプリセットをコピー）
- UI: 管理画面とホームのショートカット
- 中央タブ・ホームのカメラを撮影開始に切り替えた共通シェル（`BottomTabBar` / `AppShell` / `app-routes.ts`）
- テスト: 1 タップが自分のログになる、他人の my_drink id で 404、`/logs` 配下の親タブがホーム（`app-routes.test.ts`）

## 5. 細分化タスク

1. shared Zod
2. API CRUD + 1 タップ endpoint
3. 管理 UI
4. ホームにショートカット（2-05 の空ホームを埋める）。今日カード → `/logs`、「今週 ›」、カメラ = 撮影開始
5. 中央タブを撮影開始に切り替え、現在地ハイライトと `/logs` 着地を外す（[00-common.md](../../spec/screen-designs/00-common.md) 受け入れチェックの該当 2 項目を PR に貼る）
6. 他人 ID の 404 テスト
7. 監査

## 6. 手順

ブランチ: `feature/my-drinks`

1 タップの実装は「クライアントが値を展開して POST /drink-logs」でも「サーバーが my_drink を読む」でも可。**推奨はサーバーが読む**（改ざんされず、削除済み ID は 404）。仕様に明記。

```powershell
pnpm test && pnpm lint && pnpm typecheck
```

## 7. 仕様詳細

- 削除済みマイドリンクの 1 タップ: 404、ログは作らない
- 編集は未来の 1 タップのみ影響
- 名前は必須、最大長 **40**（drink-log.md 9 章で確定）
- ホームに出す件数 **4**（`sortOrder` 上位。残りは一覧へ。日別には出さない。drink-log.md 9 章で確定）

## 8. 受け入れ条件

- [ ] 登録と 1 タップが実機でできる
- [ ] 過去ログがプリセット編集で変わらない
- [ ] 他ユーザーのプリセット ID で記録できないテスト
- [ ] 中央タブ / ホームのカメラで `photo-edit` が開き、「使う」で写真付き `log-new`、× / OS キャンセルで元の画面に留まる。中央タブに現在地ハイライトが無く、`/logs` 配下ではホームタブが現在地
- [ ] 今日カード → 今日の `/logs`、「今週 ›」→ `/summary/week`、週マス → `/logs/:date`
- [ ] DoD 5 項（spec, テスト, lint, 同期, 監査）

## 9. セキュリティ観点

- `:id` + session userId で my_drinks を検索
- クライアントが任意の volume を 1 タップ API に混ぜない（サーバーコピー）

## 10. 関連ファイル / 関連spec

- [spec/features/drink-log.md](../../spec/features/drink-log.md)
- [02-log-input-screen.md](02-log-input-screen.md)

## 11. リスク・注意点

- 誤タップで記録が積もる → トースト「取り消す」5 秒（drink-log.md 9 章で確定。楽観更新なし）
- ホームの 1 タップとタブ「記録」の役割分担 → 確定（2026-09-06 (c)）: 1 タップはホームのチップだけ、中央タブは撮影開始（着地しない）、写真なし記録はホームの「記録する」
- 中央タブの切替で 2-05 の「`/logs` に着地し現在地で inset」を外す。`app-routes.test.ts` の期待値も直す
