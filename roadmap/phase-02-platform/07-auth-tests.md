# 2-07 認証周りの単体テスト・APIテスト

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 2 土台実装 |
| ステータス | **未着手** |
| 要件 | 未ログイン 401、他ユーザーデータ不可（Phase 2 DoD） |
| ソース | Phase 2「認証周りの単体テスト・APIテスト」 |

## 1. 概要

認証と認可の回帰テストを CI に乗せる。Phase 2 DoD の「テストで担保」はこのタスクが担う。業務 API がまだ少ないので、`/api/me` と Auth フロー、将来コピーできるテストヘルパを用意する。

## 2. 前提条件

- 2-02、2-03
- 0-06 Vitest
- テスト配置: `src/server/**/*.test.ts` などソース隣

## 3. スコープ

**対象**

- 未認証で保護 API が 401
- 認証済みで `/api/me` が自分の id
- 他ユーザーのセッションでは他人の me が返らない（自明だが、リソース API の雛形として「ユーザー A の ID でユーザー B の行を取れない」を、テーブルが無い場合はスキップせず **2 ユーザー作成ヘルパ** を用意）
- ログイン失敗のメッセージがユーザー列挙しすぎない（可能なら）

**対象外**

- Playwright（Phase 6）
- drink-logs の認可（Phase 3 で同パターンを追加）

## 4. 成果物

- API テストファイル
- テスト用ユーザー作成ヘルパ（D1 local または in-memory）
- CI で `pnpm test` がこれらを実行

## 5. 細分化タスク

1. Hono `app.request` で Cookie を引き回すヘルパを書く
2. 未認証 401 テスト
3. サインアップ → ログイン → me の正常系
4. ユーザー 2 人を作り、A の Cookie で B 専用リソースを 404 にするテスト（リソースが無ければ `me` が B の id を返さないこと）
5. 失敗時にスタックが JSON に出ないこと

## 6. 手順

テストから本物の Cloudflare アカウントを叩かない。local D1 または Vitest でスキーマ apply。

方針は 0-06 で決めたハーネスに従う。未決なら:

1. テスト開始時に migrate local
2. `app.request("/api/auth/sign-up/email", { method: "POST", body, headers })` は Better Auth の実際のパスに合わせる（公式に従う。本手順書に推測パスを正と書かない。実装時にドキュメント確認）

パスワードはテスト専用の弱い値でよいが、本番 secret は使わない。

```powershell
pnpm test
pnpm lint
pnpm typecheck
```

ブランチ: `feature/auth-api-tests` または 2-02 と同じ PR（1 関心事なら認証とテストは同じ PR が DoD 的に正しい）。分割するなら本タスクはテストのみ。

## 7. 仕様詳細

必須ケース（Phase 2 DoD）:

| ケース | 期待 |
|---|---|
| Cookie なし GET /api/me | 401 |
| ユーザーA ログイン後 GET /api/me | 200、id が A |
| ユーザーB の id を A が指定 | ボディに userId を受けない。指定しても無視 |
| health | 200、認証不要 |

他ユーザーの drink_log はテーブル利用開始後に必須。ヘルパだけ先に置く。

## 8. 受け入れ条件

- [ ] 未ログイン 401 が自動テストにある
- [ ] 他ユーザーのデータにアクセスできないことが、利用可能なリソースでテストされている
- [ ] CI グリーン
- [ ] テストに本番シークレットが無い
- [ ] security-audit の「テスト【High】」項目を満たす

## 9. セキュリティ観点

- テストレポートにセッション Cookie を dump しない
- 認証バイパス用の `TEST_SKIP_AUTH` を本番ビルドに残さない

## 10. 関連ファイル / 関連spec

- [.cursor/skills/security-audit/SKILL.md](../../.cursor/skills/security-audit/SKILL.md)
- [02-better-auth.md](02-better-auth.md)
- [03-hono-api-structure.md](03-hono-api-structure.md)

## 11. リスク・注意点

- Better Auth のエンドポイントパス変更
- 並列テストで D1 ファイルが競合する → テストを serial または isolated DB
