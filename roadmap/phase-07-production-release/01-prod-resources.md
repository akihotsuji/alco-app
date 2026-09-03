# 7-01 本番用リソース作成

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **未着手** |
| 要件 | 可用性、コスト無料枠、dev と完全分離 |
| ソース | Phase 7「Workers環境分離、本番D1・本番R2」 |

## 1. 概要

wrangler の env で本番 Worker / D1 / R2 を dev と分ける。データを混ぜない。

## 2. 前提条件

- Phase 6 完了相当のアプリ
- Cloudflare アカウント
- 0-03 で `env.dev` を採用済み。本タスクは **`env.production` を追加**する
- 命名: 本番 Worker / D1 は `alco-app-prod`、R2 は `alco-app-photos-prod`（0-03 の予定名）

## 3. スコープ

**対象**

- `wrangler.jsonc` の `env.production`（名前は任意）
- 本番 D1 create、本番 R2 create（非公開）
- バインディング
- 初回はデプロイしなくてもリソースだけ可。次タスクでパイプライン

**対象外**

- GitHub 自動デプロイ（7-02）
- 独自ドメイン（7-06）
- シークレット値の文書化（禁止）

## 4. 成果物

- 本番 D1 / R2
- wrangler env 設定（database_id は設定ファイルに含まれる。secret ではない）
- 環境一覧表（spec または README）。**ID のコピペ過多は不要**

## 5. 細分化タスク

1. 名前を決める
2. D1/R2 create（prod）
3. wrangler env 分割
4. ダッシュボードで R2 public オフ
5. 誤って dev に prod を向けていないかレビュー

## 6. 手順

```powershell
pnpm exec wrangler d1 create alco-app-prod
pnpm exec wrangler r2 bucket create alco-app-photos-prod
```

`wrangler.jsonc` に `env.production` を足す。トップレベルを dev 扱いにしない（0-03 FIX）。dev は `--env dev`、本番は `--env production` を必須にする。無引数の `wrangler deploy` が本番を向かないこと。

本番 migrate は 7-02 または初回リリース時。本タスクで apply するなら **prod と分かったうえで**。

## 7. 仕様詳細

分離の定義:

- 別 D1
- 別 R2
- 別 Worker 名
- 別 BETTER_AUTH_SECRET
- 別 Cookie ドメイン（後でカスタムドメイン）

同じ D1 を wrangler の 2 env から指さない。

## 8. 受け入れ条件

- [ ] 本番リソースが dev と別
- [ ] R2 非公開
- [ ] 設定に secret 値がない
- [ ] 命名がドキュメントにある

## 9. セキュリティ観点

- 本番 database_id をチャットに貼りまわない（公開でも実害は限定的だが習慣）
- 本番 R2 を公開バケットにしない

## 10. 関連ファイル / 関連spec

- [spec/02-tech-stack.md](../../spec/02-tech-stack.md)
- [02-deploy-pipeline.md](02-deploy-pipeline.md)
- [../phase-00-project-foundation/03-cloudflare-dev-resources.md](../phase-00-project-foundation/03-cloudflare-dev-resources.md)

## 11. リスク・注意点

- `wrangler deploy` 無引数が本番を向く設定ミス
- 無料枠内に 2 環境収まるか（Workers/D1 は通常可）
