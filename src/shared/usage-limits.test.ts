import { describe, expect, it } from "vitest";
import {
  AI_RECOGNIZE_DAILY_LIMIT,
  AI_RECOGNIZE_DAILY_LIMIT_MAX,
  PHOTO_MAX_BYTES,
  PHOTO_OUTPUT_LONG_EDGE,
  PHOTO_UPLOAD_DAILY_LIMIT,
} from "./constants.ts";

/** 8-06。R2 / AI 無料枠を守る定数が緩んでいないことを固定する。認識は一旦 MAX（無制限化しない）。 */
describe("無料枠を守る上限", () => {
  it("写真は長辺 1280・1 MiB。日次 80。認識は日次上限 MAX（10000）", () => {
    expect(PHOTO_OUTPUT_LONG_EDGE).toBe(1280);
    expect(PHOTO_MAX_BYTES).toBe(1_048_576);
    expect(PHOTO_UPLOAD_DAILY_LIMIT).toBe(80);
    expect(AI_RECOGNIZE_DAILY_LIMIT_MAX).toBe(10_000);
    expect(AI_RECOGNIZE_DAILY_LIMIT).toBe(AI_RECOGNIZE_DAILY_LIMIT_MAX);
  });
});
