import { describe, expect, it } from "vitest";
import { readAuthSecret, resolveAuthBaseURL } from "./env.ts";

describe("readAuthSecret", () => {
  it("文字列のシークレットを返す", () => {
    expect(readAuthSecret({ BETTER_AUTH_SECRET: "s3cret" })).toBe("s3cret");
  });

  it("欠ける・空文字・非文字列は設定不足とする", () => {
    expect(() => readAuthSecret({})).toThrow("BETTER_AUTH_SECRET is not configured");
    expect(() => readAuthSecret({ BETTER_AUTH_SECRET: "" })).toThrow(
      "BETTER_AUTH_SECRET is not configured",
    );
    expect(() => readAuthSecret({ BETTER_AUTH_SECRET: 1 })).toThrow(
      "BETTER_AUTH_SECRET is not configured",
    );
  });
});

describe("resolveAuthBaseURL", () => {
  it("設定があれば末尾スラッシュを除いて使う", () => {
    expect(resolveAuthBaseURL({ BETTER_AUTH_URL: "https://app.example/" }, "https://other/")).toBe(
      "https://app.example",
    );
  });

  it("未設定・空文字はリクエスト origin に落とす", () => {
    expect(resolveAuthBaseURL({}, "https://app.example/login")).toBe("https://app.example");
    expect(resolveAuthBaseURL({ BETTER_AUTH_URL: "" }, "https://app.example/login")).toBe(
      "https://app.example",
    );
  });

  it("BETTER_AUTH_URL が無ければ CANONICAL_ORIGIN を使う", () => {
    expect(
      resolveAuthBaseURL(
        { CANONICAL_ORIGIN: "https://sake-shiori.com/" },
        "https://other.example/",
      ),
    ).toBe("https://sake-shiori.com");
  });

  it("BETTER_AUTH_URL は CANONICAL_ORIGIN より優先する", () => {
    expect(
      resolveAuthBaseURL(
        {
          BETTER_AUTH_URL: "https://override.example",
          CANONICAL_ORIGIN: "https://sake-shiori.com",
        },
        "https://other.example/",
      ),
    ).toBe("https://override.example");
  });
});
