import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("認証画面 8-03", () => {
  it("ログインにパスワード再設定の導線がある", () => {
    const login = readFileSync(join(here, "LoginPage.tsx"), "utf8");
    expect(login).toContain("パスワードを忘れた");
    expect(login).toContain("/forgot-password");
    expect(login).toContain("loginNoticeFromSearch");
  });

  it("サインアップに招待コード欄が無い", () => {
    const signup = readFileSync(join(here, "SignupPage.tsx"), "utf8");
    expect(signup).not.toMatch(/invite|招待コード/i);
  });
});
