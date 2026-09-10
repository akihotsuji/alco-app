import { describe, expect, it } from "vitest";
import { readAuthSecret, readGoogleOAuthConfig, resolveAuthBaseURL } from "./env.ts";

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

describe("readGoogleOAuthConfig", () => {
  it("両方あるときだけ返す", () => {
    expect(
      readGoogleOAuthConfig({
        GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "gsec",
      }),
    ).toEqual({
      clientId: "id.apps.googleusercontent.com",
      clientSecret: "gsec",
    });
  });

  it("片方だけ・空は未設定", () => {
    expect(readGoogleOAuthConfig({})).toBeUndefined();
    expect(readGoogleOAuthConfig({ GOOGLE_CLIENT_ID: "id" })).toBeUndefined();
    expect(readGoogleOAuthConfig({ GOOGLE_CLIENT_SECRET: "sec" })).toBeUndefined();
    expect(
      readGoogleOAuthConfig({ GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "sec" }),
    ).toBeUndefined();
    expect(
      readGoogleOAuthConfig({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "sec" }),
    ).toBeUndefined();
  });

  it("前後空白は除く", () => {
    expect(
      readGoogleOAuthConfig({
        GOOGLE_CLIENT_ID: " id.apps.googleusercontent.com ",
        GOOGLE_CLIENT_SECRET: " gsec ",
      }),
    ).toEqual({
      clientId: "id.apps.googleusercontent.com",
      clientSecret: "gsec",
    });
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
