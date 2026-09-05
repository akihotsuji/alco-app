import { z } from "zod";

// 副作用モジュール。Zod を使う入口（サーバー index / クライアント main）で最初に 1 回 import する。
// - locale ja: API の `fields` メッセージは日本語で返す（spec/api-design.md 2.6）
// - jitless: Zod v4 は既定で `new Function("")` を試して JIT 可否を判定する。SPA の CSP は
//   `script-src 'self'`（unsafe-eval なし）なので、プローブ自体が CSP 違反として記録される。
//   JIT を使わない宣言で抑止する（Workers 上では UA 判定で元から無効）
z.config({ ...z.locales.ja(), jitless: true });
