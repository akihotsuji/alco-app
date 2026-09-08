# 7-02 GitHub Actions デプロイパイプライン

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 7 本番リリース |
| ステータス | **一部完了**（dev 自動デプロイを開発 Phase で先行。本番は未着手） |
| 要件 | main マージ→dev 自動、タグ/手動承認→本番 |
| ソース | Phase 7 デプロイパイプライン |

## 1. 概要

人が `wrangler deploy` を忘れても、main は dev に、本番は意図したときだけ更新される。

## 2. 前提条件

- 7-01 の env
- GitHub Secrets: `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`（値は Secrets のみ）
- 0-07 の CI がグリーンのときだけデプロイする

## 3. スコープ

**先行済み（開発 Phase）**

- `deploy-dev.yml`: `CI` が `main` の push で成功したあと `env.dev` へ。`workflow_dispatch` あり。リモート migrate も自動。正本は [spec/features/dev-deploy-ci.md](../../spec/features/dev-deploy-ci.md)

**対象（残り）**

- `deploy-prod.yml`: tag `v*` または `workflow_dispatch` + environment 承認
- 本番向け migrate を CI にするか（dev は自動化済み）

**対象外**

- Preview 毎 PR デプロイ（Workers 無料枠と複雑さ。**要確認** で後回し推奨）

## 4. 成果物

- ワークフロー YAML
- GitHub Environment `production`（承認者 = オーナー）
- 手順の短い README
- skill `release` の草案でも可（7-08 と分担）

## 5. 細分化タスク

1. API トークン権限（Workers 編集、D1、R2。Account 全権限は避ける）— オーナーが GitHub Secrets に入れる（キー名のみ文書化）
2. dev 自動デプロイ — 先行済み（`deploy-dev.yml`）
3. 本番は environment protection
4. CI 成功が必要（`workflow_run` または同じ workflow の job needs）
5. 失敗通知は 7-05 でも可。最低限 Actions メール

## 6. 手順

オーナーが GitHub Secrets を入れる。エージェントはプレースホルダ名だけ書く。

```yaml
# 概念。実装時に公式 wrangler-action を読む
# - name: Deploy
#   uses: cloudflare/wrangler-action@...
#   with:
#     apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
#     command: deploy --env production
```

`pull_request_target` でデプロイしない。fork PR が秘密を奪えないように。

ブランチ: `feature/deploy-workflows`

## 7. 仕様詳細

- main → dev Worker
- tag `v1.0.0` → 本番、または手動
- デプロイ成果物は CI と同じ commit
- migrate を自動にする場合、失敗したらデプロイしない

## 8. 受け入れ条件

- [x] main マージで dev が更新される（ワークフロー先行。GitHub Secrets 投入後に実デプロイが通る）
- [ ] 本番は承認またはタグなしでは変わらない（本番ワークフロー未作成）
- [x] トークンが git に無い
- [x] CI 赤でデプロイされない（`workflow_run` の `conclusion == success` かつ triggering event が `push`）

## 9. セキュリティ観点

- OIDC が使えるなら長期トークンよりよい。Workers 公式の推奨を導入時確認。**要確認**
- `contents: read` とデプロイに必要な最小 `permissions`
- ログに secret を echo しない

## 10. 関連ファイル / 関連spec

- [03-secret-management.md](03-secret-management.md)
- [spec/02-tech-stack.md](../../spec/02-tech-stack.md) CI/CD
- [spec/features/dev-deploy-ci.md](../../spec/features/dev-deploy-ci.md)
- `.github/workflows/deploy-dev.yml`

## 11. リスク・注意点

- トークン漏洩時のローテーション手順を 7-03 に書く
- 同時に main と本番が違う commit になるのは正常（本番は遅れてもよい）
