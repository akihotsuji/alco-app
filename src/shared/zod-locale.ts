import { z } from "zod";

// API の `fields` メッセージは日本語で返す（spec/api-design.md 2.6）。
// 副作用モジュール。Zod を使う入口（サーバー index / クライアント main）で 1 回 import する。
z.config(z.locales.ja());
