# 3-07 dev環境デプロイと日常利用開始

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 3 飲酒記録 |
| ステータス | **未着手** |
| 要件 | ドッグフーディング、無料枠 |
| ソース | Phase 3「dev環境にデプロイし、オーナーの日常利用を開始」 |

## 1. 概要

飲酒記録が使える状態を Cloudflare の **dev Workers** に載せ、オーナーが実機の日常記録を始める。本番分離は Phase 7。CI 自動デプロイは Phase 7-02 でも、本タスクで手動 `wrangler deploy` は可。

## 2. 前提条件

- 3-02〜3-06 が main（または dev ブランチ）に入り、ローカルで日常利用できる
- 0-03 の D1/R2、0-04 の wrangler 名
- Better Auth の secret を **wrangler secret** で入れる（値をチャットに出さない）

## 3. スコープ

**対象**

- 初回の dev デプロイ
- リモート D1 へマイグレーション apply
- 実機から HTTPS でログイン〜記録
- オーナーへの URL 共有（workers.dev）
- デプロイ手順の短いメモ（後で operations に統合）

**対象外**

- 本番 env
- GitHub Actions デプロイ完成形
- 独自ドメイン
- R2 写真（Phase 4。バケットは無くても飲酒記録は動く）

## 4. 成果物

- 公開 URL（dev）でアプリが動く
- リモート D1 にテーブル
- `wrangler secret` 済み（ドキュメントにはキー名のみ）
- ロードマップ Phase 3 のチェック更新

## 5. 細分化タスク

1. リモート migrate
2. secret 投入（オーナー操作）
3. `pnpm exec wrangler deploy --env dev`
4. 実機でサインアップ〜記録〜サマリー
5. 失敗時のログの見方を 1 段落書く（秘密はログらない）
6. 日常利用開始の宣言（オーナー）

## 6. 手順

```powershell
pnpm exec wrangler d1 migrations apply alco-app-dev --remote --env dev
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env dev
pnpm exec wrangler deploy --env dev
```

環境は 0-03 FIX どおり `env.dev`。コマンドは `--env dev` を明示する。

デプロイ後:

1. workers.dev URL を実機 Safari/Chrome で開く
2. サインアップ（招待なし。メール＋パスワード）
3. マイドリンクを 1 つ作り、今夜から使う

CI 未整備のデプロイ権限はオーナーのマシンまたは手動。エージェントがトークンを要求するときは GitHub Secrets へ案内し、値を受け取らない。

## 7. 仕様詳細

- dev URL は推測されうる。招待制は採用しないため **URL を公開しない**
- `workers.dev` は HTTPS。Cookie secure が有効になる
- バックアップはまだ無い（Phase 7-04）。ドッグフードデータ消失リスクをオーナーが了解する

## 8. 受け入れ条件

- [ ] 実機で毎日の記録が運用できる（Phase 3 DoD）
- [ ] CI グリーンのコードが載っている
- [ ] secret がリポジトリに無い
- [ ] リモート migrate 済み
- [ ] ロードマップ更新

## 9. セキュリティ観点

- デプロイトークンを wrangler.jsonc に書かない
- dev とはいえ他ユーザーデータは無い前提でも認可コードを外さない
- オーナー以外の登録を許す設定なら、その認識があること

## 10. 関連ファイル / 関連spec

- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)
- 後続: [../phase-07-production-release/02-deploy-pipeline.md](../phase-07-production-release/02-deploy-pipeline.md)

## 11. リスク・注意点

- ローカルとリモートの migration 差分
- ドッグフード中にスキーマ変更するとデータ移行が必要。Phase 4 以降も互換を意識
- 無料枠のデプロイ回数
