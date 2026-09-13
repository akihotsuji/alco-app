import { describe, expect, it } from "vitest";
import { AUTH_PASSWORD_MIN_LENGTH } from "../shared/auth.ts";
import {
  cookieHeaderFrom,
  createLocalDevUser,
  LOCAL_DEV_USER_EMAIL,
  parseLocalDevUser,
} from "./local-dev-user.ts";

describe("local-dev-user", () => {
  it("資格情報 JSON を厳密に読む", () => {
    expect(parseLocalDevUser("{")).toBeNull();
    expect(parseLocalDevUser(JSON.stringify({ email: "a@b.c" }))).toBeNull();
    expect(
      parseLocalDevUser(JSON.stringify({ email: "a@b.c", password: "short", name: "x" })),
    ).toBeNull();
    const user = {
      email: "a@b.c",
      password: "long-enough-password",
      name: "ローカル",
    };
    expect(parseLocalDevUser(JSON.stringify(user))).toEqual(user);
  });

  it("生成ユーザーは固定メールと十分な長さのパスワード", () => {
    const user = createLocalDevUser();
    expect(user.email).toBe(LOCAL_DEV_USER_EMAIL);
    expect(user.password.length).toBeGreaterThanOrEqual(AUTH_PASSWORD_MIN_LENGTH);
    expect(user.password.startsWith("LocalDev-")).toBe(true);
    expect(createLocalDevUser().password).not.toBe(user.password);
  });

  it("Set-Cookie から Cookie ヘッダーへ畳む", () => {
    const response = new Response(null, {
      headers: [
        ["set-cookie", "a=1; Path=/"],
        ["set-cookie", "b=2; HttpOnly"],
      ],
    });
    expect(cookieHeaderFrom(response)).toBe("a=1; b=2");
  });
});
