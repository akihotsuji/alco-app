import { afterEach, describe, expect, it, vi } from "vitest";
import { SERVICE_NAME_JA } from "@/shared/prod-canonical.ts";
import {
  buildResetPasswordEmailText,
  createResetPasswordMailer,
  EMAIL_FROM_KEY,
  isSafeResetUrl,
  RESEND_API_KEY_KEY,
  RESEND_API_URL,
  RESET_PASSWORD_EMAIL_SUBJECT,
} from "./reset-password-mail.ts";

const RESET_URL =
  "http://localhost/api/auth/reset-password/test-token-value?callbackURL=%2Freset-password";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reset password mail", () => {
  it("本文にサービス名と期限とリンクだけを載せ、トークンを二重に出さない", () => {
    const text = buildResetPasswordEmailText(RESET_URL);
    expect(text).toContain(SERVICE_NAME_JA);
    expect(text).toContain("1時間");
    expect(text).toContain(RESET_URL);
    expect(text).not.toContain("もう一杯");
    expect(text.match(/test-token-value/g)).toHaveLength(1);
  });

  it("http(s) 以外のリセット URL は送らない", () => {
    expect(isSafeResetUrl("https://sake-shiori.com/api/auth/reset-password/a")).toBe(true);
    expect(isSafeResetUrl("http://localhost/api/auth/reset-password/a")).toBe(true);
    expect(isSafeResetUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeResetUrl("not-a-url")).toBe(false);
  });

  it("API キーが無いときは fetch しない", async () => {
    const fetchImpl = vi.fn();
    const mailer = createResetPasswordMailer({}, fetchImpl as unknown as typeof fetch);
    await mailer({ email: "user@example.com", resetUrl: RESET_URL });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("Resend へ text メールを送り、ログに URL とキーを出さない", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response("{}", { status: 200 }),
    );
    const mailer = createResetPasswordMailer(
      {
        [RESEND_API_KEY_KEY]: "re_test_dummy_key",
        [EMAIL_FROM_KEY]: `${SERVICE_NAME_JA} <noreply@sake-shiori.com>`,
      },
      fetchImpl as unknown as typeof fetch,
    );
    await mailer({ email: "user@example.com", resetUrl: RESET_URL });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(RESEND_API_URL);
    const init = fetchImpl.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_dummy_key");
    const body = JSON.parse(String(init?.body)) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
    };
    expect(body.subject).toBe(RESET_PASSWORD_EMAIL_SUBJECT);
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.text).toContain(RESET_URL);
    expect(body).not.toHaveProperty("html");

    const logged = error.mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain(RESET_URL);
    expect(logged).not.toContain("test-token-value");
    expect(logged).not.toContain("re_test_dummy_key");
  });

  it("送信失敗でも投げず、ログに本文を出さない", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    const mailer = createResetPasswordMailer(
      {
        [RESEND_API_KEY_KEY]: "re_test_dummy_key",
        [EMAIL_FROM_KEY]: `${SERVICE_NAME_JA} <noreply@sake-shiori.com>`,
      },
      fetchImpl as unknown as typeof fetch,
    );
    await expect(
      mailer({ email: "user@example.com", resetUrl: RESET_URL }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith("reset email send failed");
    const logged = error.mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain(RESET_URL);
  });
});
