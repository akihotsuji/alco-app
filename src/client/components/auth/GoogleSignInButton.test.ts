import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GOOGLE_CONTINUE_LABEL } from "@/shared/oauth.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("GoogleSignInButton", () => {
  it("公式クライアントだけで、自前 OAuth を持たない", () => {
    const source = readFileSync(join(here, "GoogleSignInButton.tsx"), "utf8");
    expect(source).toContain("authClient.signIn.social");
    expect(source).toContain("oauthClientFailed");
    expect(source).toContain("finally");
    expect(source).toContain("GOOGLE_CONTINUE_LABEL");
    expect(GOOGLE_CONTINUE_LABEL).toBe("Google で続行");
    expect(source).toContain('type="button"');
    expect(source).not.toContain("oauth2.googleapis.com");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
