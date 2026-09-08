import { describe, expect, it } from "vitest";
import { hasSessionCookie } from "./session-cookie.ts";

describe("hasSessionCookie", () => {
  it("better-auth のセッション Cookie 名だけを見る", () => {
    expect(hasSessionCookie("better-auth.session_token=abc")).toBe(true);
    expect(hasSessionCookie("theme=light; __Secure-better-auth.session_token=xyz")).toBe(true);
    expect(hasSessionCookie("better-auth.session_data=abc")).toBe(false);
    expect(hasSessionCookie("")).toBe(false);
  });
});
