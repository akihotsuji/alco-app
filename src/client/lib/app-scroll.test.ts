import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canScrollBox, primaryScrollerKind } from "./app-scroll.ts";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../styles.css"), "utf8");

describe("primaryScrollerKind", () => {
  it("長いページは content を選ぶ", () => {
    expect(
      primaryScrollerKind({
        content: { scrollHeight: 1500, clientHeight: 800, scrollTop: 0 },
        document: { scrollHeight: 800, clientHeight: 800, scrollTop: 0 },
      }),
    ).toBe("content");
  });

  it("content が伸び切っていると document に逃げる", () => {
    expect(
      primaryScrollerKind({
        content: { scrollHeight: 1500, clientHeight: 1500, scrollTop: 0 },
        document: { scrollHeight: 1500, clientHeight: 800, scrollTop: 0 },
      }),
    ).toBe("document");
  });

  it("短いページは none", () => {
    expect(
      primaryScrollerKind({
        content: { scrollHeight: 800, clientHeight: 800, scrollTop: 0 },
        document: { scrollHeight: 800, clientHeight: 800, scrollTop: 0 },
      }),
    ).toBe("none");
  });

  it("1px 以下の差は誤差", () => {
    expect(canScrollBox({ scrollHeight: 801, clientHeight: 800, scrollTop: 0 })).toBe(false);
    expect(canScrollBox({ scrollHeight: 810, clientHeight: 800, scrollTop: 0 })).toBe(true);
  });
});

describe("シェル CSS", () => {
  it("app-content が flex 子として縮み、document は縦に閉じる", () => {
    expect(css).toMatch(/\.app-content\s*\{[^}]*min-height:\s*0/);
    expect(css).toMatch(/\.app-shell\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/html\s*\{[^}]*overflow-y:\s*hidden/);
    expect(css).toContain("overscroll-behavior-y: none");
  });
});
