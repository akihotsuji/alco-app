import { describe, expect, it } from "vitest";
import { ageGatePath, agePathFor } from "./age-path.ts";

describe("agePathFor", () => {
  it("ホームと /age 自身は redirect を付けない", () => {
    expect(agePathFor("/")).toBe("/age");
    expect(agePathFor("/age")).toBe("/age");
    expect(agePathFor("/age", "?redirect=%2Flogs")).toBe("/age");
  });

  it("タブ配下のパスを redirect に載せる", () => {
    expect(agePathFor("/cellar")).toBe("/age?redirect=%2Fcellar");
    expect(agePathFor("/logs/new", "?camera=1")).toBe("/age?redirect=%2Flogs%2Fnew%3Fcamera%3D1");
  });
});

describe("ageGatePath", () => {
  it("不正や認証画面の redirect は /age だけにする", () => {
    expect(ageGatePath(null)).toBe("/age");
    expect(ageGatePath("/login")).toBe("/age");
    expect(ageGatePath("/age")).toBe("/age");
    expect(ageGatePath("https://evil.example")).toBe("/age");
  });

  it("安全な相対パスを引き継ぐ", () => {
    expect(ageGatePath("/logs/new")).toBe("/age?redirect=%2Flogs%2Fnew");
  });
});
