# 0-06 Vitest導入

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 0 プロジェクト基盤 |
| ステータス | **完了**（2026-09-03。`pnpm test` がパス） |
| 要件 | 保守性（自動テスト）、計算ロジックの単体テスト前提 |
| ソース | [spec/03-roadmap.md](../../spec/03-roadmap.md) Phase 0 |

## 1. 概要

単体・コンポーネントテストの実行基盤を入れる。サンプルテスト 1 件がパスすれば本タスクは完了。本格的な API テストは Phase 2-07。E2E は Phase 6。

## 2. 前提条件

- 0-04、0-05 完了（ソースと TypeScript がある）
- テストファイル配置は coding-standards: **対象と同じディレクトリに `*.test.ts`**

## 3. スコープ

**対象**

- Vitest 設定
- サンプルテスト 1 件（純アルコール計算の仮実装でも、単純な `add` でもよい）
- `pnpm test` script
- （推奨）純アルコール計算の式は Phase 1-06 / 3-04 が正。ここでは **テストランナーが動くこと** が目的

**対象外**

- Testing Library の本格導入（Phase 2 以降のコンポーネントで足してよい。本タスクで入れてもよいが必須ではない）
- Playwright
- Cloudflare 実リソースを叩くテスト

## 4. 成果物

- `vitest.config.ts`（または `vite.config.ts` 内 test）
- サンプル: 例 `src/shared/example.test.ts` または health 用の純粋関数テスト
- package.json `"test": "vitest run"` と watch 用 `"test:watch"`

## 5. 細分化タスク

1. `vitest` を devDependency に追加する
2. Vite とパスエイリアスを共有する
3. サンプルテストを 1 件書く
4. `pnpm test` が終了コード 0 で終わることを確認する
5. README にテストの実行方法を 1 行書く

## 6. 手順

```powershell
pnpm add -D vitest
```

React コンポーネントを本タスクで試すなら `@testing-library/react` と `jsdom`（または `happy-dom`）が必要。サンプルを純粋関数にする方が依存が少ない。

推奨サンプル（プレースホルダ。本番の計算は 3-04）:

```typescript
import { describe, expect, it } from "vitest";

function healthMessage() {
  return "ok";
}

describe("healthMessage", () => {
  it("returns ok", () => {
    expect(healthMessage()).toBe("ok");
  });
});
```

実行:

```powershell
pnpm test
```

CI では watch せず `vitest run` を使う（0-07）。

## 7. 仕様詳細

[coding-standards](../../.cursor/rules/coding-standards.mdc):

- 計算ロジックは単体テスト必須（Phase 3 で本命）
- API テストに認可ケースを含める（Phase 2 以降）
- 配置: `*.test.ts` をソース隣

**FIX（0-06）**: Phase 2 の API テストは Node 上の Hono `app.request()` を使う。Workers ハーネス（`cloudflare:test` / Miniflare / `@cloudflare/vitest-pool-workers`）は使わない。D1 は後でモックまたは local D1。詳細は「12. FIX」。

## 8. 受け入れ条件

- [x] サンプルテスト 1 件以上が `pnpm test` でパス（Phase 0 DoD の一部）
- [x] CI から呼べる非インタラクティブ script がある
- [x] テストがソース隣の `*.test.ts` である
- [x] 本物のシークレットや本番 URL をテストに書いていない

## 9. セキュリティ観点

- テストフィクスチャに実パスワード・実セッション Cookie を置かない
- 後の API テストで「他ユーザーの ID を知っていて 404 になる」ケースを書ける土台にする

## 10. 関連ファイル / 関連spec

- [.cursor/rules/coding-standards.mdc](../../.cursor/rules/coding-standards.mdc)
- 次: [07-github-actions-ci.md](07-github-actions-ci.md)
- 利用: Phase 2-07、Phase 3-04

## 11. リスク・注意点

- Vite と Vitest のメジャー不一致で設定が壊れる。導入時の peer を確認する
- `vitest`（watch）を CI に書くとジョブが終わらない。必ず `run`

## 12. FIX（0-06）

正本は [spec/02-tech-stack.md](../../spec/02-tech-stack.md) の「テスト（0-06 FIX）」。

| 項目 | 決定 |
|---|---|
| ランナー | **Vitest 5.x**（導入時安定版。Vite 7 peer を満たす。実行には Node >= 22.12） |
| 設定 | `vitest.config.ts` を Vite と分離（Cloudflare プラグインをテスト時に読まない） |
| パスエイリアス | `@/` → `src/`。`vite.alias.ts` で Vite と共有 |
| 実行環境 | Node。`environment: "node"` |
| 配置 | `src/**/*.test.ts`（ソース隣） |
| API テスト方針 | Hono の `app.request()` を Node / Vitest で使う。Workers ハーネスは使わない。D1 は後でモックまたは local D1（Phase 2-07 で踏襲） |
| scripts | `test` = `vitest run`、`test:watch` = `vitest` |
| Testing Library / jsdom | 本タスクでは入れない |
| globals | 使わない。`import { describe, expect, it } from "vitest"` |
| サンプル | `src/server/index.test.ts`（`GET /api/health` と未定義 `/api` の 404。0-04 の node:test から移行） |
