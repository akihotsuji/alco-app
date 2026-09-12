---
name: release
description: alco-appの本番リリース手順。チェックリスト実行、本番デプロイ、動作確認、ロールバックのときに使用する。
---

# リリース手順

正本の項目は [spec/release-checklist.md](../../../spec/release-checklist.md)。障害・復元・ロールバックのコマンドは [spec/operations.md](../../../spec/operations.md)。デプロイワークフローは [spec/features/deploy-prod.md](../../../spec/features/deploy-prod.md)。

## いつ使うか

- 初回本番リリース
- タグ `vX.Y.Z` または Actions の Deploy prod
- リリース後に戻すとき（コードまたは D1）

`main` マージだけでは本番は変わらない。dev は [spec/features/dev-deploy-ci.md](../../../spec/features/dev-deploy-ci.md)。

## 実行順

失敗したら次へ進まない。値・Cookie・SQL をチャットに貼らない。

1. 対象 commit の `CI` が success
2. [spec/security-audit-release.md](../../../spec/security-audit-release.md) が Critical / High ゼロ。新しい API を足したら再監査
3. 本番 secret が入っている（入れるのはオーナー。[spec/secrets.md](../../../spec/secrets.md)）
4. GitHub Environment `production` の必須レビューアがある
5. Actions → **Deploy prod** → ブランチ `main`（またはタグ push）→ 承認。中で未適用 migrate があれば D1 バックアップ → migrate → deploy
6. `GET https://sake-shiori.com/api/health`
7. 本番だけのユーザーでログイン。記録 / ボトル / ノートを 1 件ずつ。写真は自分だけ
8. 任意でホーム画面に追加
9. Backup D1 を手動 1 回。初回は `mode=rehearse` も
10. [spec/operations.md](../../../spec/operations.md) のロールバックを読み上げて確認

チェックリストの該当行を `[x]` にする。個人情報は書かない。実施日と「オーナー」だけ残してよい。

## ロールバック

コードを戻すときは `wrangler rollback --env production`、または前の成功タグで Deploy prod を再実行する。詳細と注意（migrate 済みの DB、写真削除は戻せない）は [spec/operations.md](../../../spec/operations.md)。

エージェントはデプロイトークンの値を受け取らない。手動 wrangler が必要なら `wrangler login --device --browser=false` を先に出し、オーナーが承認してから続ける。

## やってはいけないこと

- 素の `wrangler deploy`（`--env production` を付ける）
- 本番 D1 へ確認なしの `time-travel restore` / `execute --file`
- チェックリストや PR に secret・本番パスワード・セッションを書く
- dev のテストアカウントを本番に作る
- Preview / PR ブランチを本番 Worker に載せる
