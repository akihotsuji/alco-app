import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GOOGLE_LOGIN_LABEL, GOOGLE_SIGNUP_LABEL, googleSignInLabel } from "@/shared/oauth.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("GoogleSignInButton", () => {
  it("公式クライアントだけで、自前 OAuth を持たない", () => {
    const source = readFileSync(join(here, "GoogleSignInButton.tsx"), "utf8");
    expect(source).toContain("authClient.signIn.social");
    expect(source).toContain("googleSignInLabel(mode)");
    expect(googleSignInLabel("login")).toBe(GOOGLE_LOGIN_LABEL);
    expect(googleSignInLabel("signup")).toBe(GOOGLE_SIGNUP_LABEL);
    expect(GOOGLE_LOGIN_LABEL).toBe("Googleアカウントでログインする");
    expect(GOOGLE_SIGNUP_LABEL).toBe("Googleアカウントで登録する");
    expect(source).toContain('type="button"');
    expect(source).not.toContain("oauth2.googleapis.com");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
