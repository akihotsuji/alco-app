import assert from "node:assert/strict";
import { test } from "node:test";
import { app } from "./index.ts";

test("GET /api/health は { ok: true } を返す", async () => {
  const res = await app.request("/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("未定義の /api は内部情報なしの 404 を返す", async () => {
  const res = await app.request("/api/not-a-real-route");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { ok: false });
});
