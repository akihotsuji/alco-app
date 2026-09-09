# 独自ドメイン（7-06）

実装: Phase 7-06。手順は [06-custom-domain.md](../../roadmap/phase-07-production-release/06-custom-domain.md)。

- 状態: **ゾーン接続済み**（2026-09-09）。apex / www を Worker `alco-app-prod` に付けた。ホスト正規化（308）は Deploy prod のあと
- 公開名称: **さけしおり**（ラテン表記 `sake-shiori`）
- 正ホスト: **`sake-shiori.com`**（TLD は Web の既定として `.com`）
- 正オリジン: `https://sake-shiori.com`

---

## 1. 目的

本番だけ読みやすい HTTPS のホストで開き、Cookie と Better Auth の `baseURL` を 1 オリジンに固定する。dev の `workers.dev` は開発用のまま残す。

---

## 2. 対象 / 対象外

**対象**

- 本番 Worker `alco-app-prod` へのカスタムドメイン（apex と www）
- 本番のホスト正規化（www / 本番 `workers.dev` / HTTP → HTTPS apex）
- Better Auth の本番 `baseURL`（`CANONICAL_ORIGIN`）
- DNS は Cloudflare（Registrar で買ったゾーンを同じアカウントに置く）

**対象外**

- **dev**（`alco-app-dev`）へのカスタムドメイン。`workers.dev` のまま
- 本番 `workers.dev` の無効化（閉じない。リダイレクトする）
- メール（MX）。パスワードリセットは Phase 8
- アカウント ID・`workers.dev` URL の文書化（禁止）

---

## 3. ホスト方針

| 項目 | 決定 |
|---|---|
| サービス名 | さけしおり |
| ラテン | sake-shiori |
| 正 | `https://sake-shiori.com`（apex） |
| www | `https://www.sake-shiori.com` → 正へ 308（パス・クエリ維持） |
| 本番 `workers.dev` | 同じ Worker 上で残す。リクエストは正へ 308 |
| HTTP | 正ホストの HTTP は HTTPS へ 308 |
| Cookie `Domain` | **付けない**（apex だけのホスト Cookie） |
| 常時 HTTPS | はい。証明書は Cloudflare が発行 |

apex と www の両方を「正」にしない。セッション Cookie が割れないようにする。

---

## 4. 設定（コード）

`wrangler.jsonc` の `env.production` のみ。

| キー | 値 | 置き場 |
|---|---|---|
| `CANONICAL_ORIGIN` | `https://sake-shiori.com` | wrangler `vars`（秘密ではない） |
| `routes` | `sake-shiori.com` と `www.sake-shiori.com`（`custom_domain: true`） | 同上 |
| `workers_dev` | `true` | 同上 |
| `assets.run_worker_first` | `true` | 同上。SPA も含めて Worker が先にホストを見る |

`env.dev` に `CANONICAL_ORIGIN` もカスタムドメインも置かない。本番 URL を dev に書かない。

`BETTER_AUTH_URL` は任意の上書き。未設定なら `CANONICAL_ORIGIN`、それも無ければリクエスト origin（[auth.md](auth.md) / [secrets.md](../secrets.md)）。

---

## 5. リダイレクト

実装: `src/server/canonical-redirect.ts`。`handleFetch` の先頭で、API・静的ファイルより先に判定する。

飛び先の origin は **設定値だけ**。`Host` ヘッダーを行き先にしない。

リダイレクトするのは次だけ。

- `www.` + 正ホスト
- `*.workers.dev`（`CANONICAL_ORIGIN` がある本番だけ）
- 正ホストの `http:`

未知ホストと `localhost` は飛ばさない。パスの `//` は別オリジンにしない。

状態コードは **308**（メソッド維持）。

---

## 6. 接続手順

ゾーンがアカウントに無いと、`wrangler deploy --env production` のカスタムドメイン付与は失敗する。**ドメインを Cloudflare Registrar で買ったあと**に Deploy prod する。

1. Cloudflare ダッシュボードで `sake-shiori.com` を Registrar 購入する（支払い・登録者情報・登録約款はオーナー）
2. 公式ダッシュボード以外の「証明書確認」リンクは踏まない
3. この変更が `main` に入ったあと、Actions → Deploy prod を承認する
4. デプロイが apex / www を Worker に付け、DNS と証明書を作る
5. `https://sake-shiori.com` でログイン〜記録を確認する

2026-09-09: ゾーン `sake-shiori.com` は active。apex と www を `alco-app-prod` に API で接続した。証明書は apex で発行済み。www の DNS は Cloudflare 側に出ている。ホスト正規化のコードは Deploy prod 後に乗る。

---

## 7. PWA

`start_url` / `id` は `/` のまま（相対）。オリジンが変わると、本番 `workers.dev` でホーム追加済みのアイコンは別アプリになる。新ホストで入れ直す。

---

## 8. テスト

- `src/server/canonical-redirect.test.ts` — 判定・オープンリダイレクト防止
- `src/server/handle-fetch.test.ts` — Worker 入口の 308 / API / SPA
- `src/server/env.test.ts` — `CANONICAL_ORIGIN` が Auth `baseURL` になる
- `src/ci/wrangler-env.test.ts` — 本番だけ routes / vars。dev には無い

---

## 関連

- [production-env.md](production-env.md)
- [deploy-prod.md](deploy-prod.md)
- [auth.md](auth.md)
- [secrets.md](../secrets.md)
- [pwa.md](pwa.md)
