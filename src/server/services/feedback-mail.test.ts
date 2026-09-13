import { afterEach, describe, expect, it, vi } from "vitest";
import { SERVICE_NAME_JA } from "@/shared/prod-canonical.ts";
import {
  buildFeedbackEmailText,
  createFeedbackMailer,
  type FeedbackMail,
  FEEDBACK_TO_KEY,
  feedbackMailSubject,
  readFeedbackTo,
} from "./feedback-mail.ts";
import { EMAIL_FROM_KEY, RESEND_API_KEY_KEY, RESEND_API_URL } from "./reset-password-mail.ts";

const MAIL: FeedbackMail = {
  category: "improvement",
  body: "棚が使いにくい",
  userId: "user-1",
  userEmail: "sender@example.com",
  createdAt: new Date("2026-09-12T03:00:00.000Z"),
  attachments: [
    {
      filename: "1.jpg",
      contentType: "image/jpeg",
      bytes: new Uint8Array([1, 2, 3]),
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("feedback mail", () => {
  it("件名と本文に種類・日付・ID・メールを載せ、パスワードは出さない", () => {
    expect(feedbackMailSubject("improvement")).toBe(`【${SERVICE_NAME_JA}】ご意見（改善案）`);
    const text = buildFeedbackEmailText(MAIL);
    expect(text).toContain("種類: 改善案");
    expect(text).toContain("利用者ID: user-1");
    expect(text).toContain("メール: sender@example.com");
    expect(text).toContain("棚が使いにくい");
    expect(text).not.toContain("password");
    expect(text).not.toContain("もう一杯");
  });

  it("カンマ区切りや空白の宛先は拒否する", () => {
    expect(readFeedbackTo({ [FEEDBACK_TO_KEY]: "owner@example.com" })).toBe("owner@example.com");
    expect(readFeedbackTo({ [FEEDBACK_TO_KEY]: "a@example.com,b@example.com" })).toBeUndefined();
    expect(readFeedbackTo({ [FEEDBACK_TO_KEY]: "not-an-email" })).toBeUndefined();
  });

  it("キーが揃わないときは fetch しない", async () => {
    const fetchImpl = vi.fn();
    const mailer = createFeedbackMailer({}, fetchImpl as unknown as typeof fetch);
    await mailer(MAIL);
    expect(fetchImpl).not.toHaveBeenCalled();

    const partial = createFeedbackMailer(
      {
        [RESEND_API_KEY_KEY]: "re_test_dummy_key",
        [EMAIL_FROM_KEY]: `${SERVICE_NAME_JA} <noreply@sake-shiori.com>`,
      },
      fetchImpl as unknown as typeof fetch,
    );
    await partial(MAIL);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("Resend へ text と添付を送り、ログに本文とメールとキーを出さない", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response("{}", { status: 200 }),
    );
    const mailer = createFeedbackMailer(
      {
        [RESEND_API_KEY_KEY]: "re_test_dummy_key",
        [EMAIL_FROM_KEY]: `${SERVICE_NAME_JA} <noreply@sake-shiori.com>`,
        [FEEDBACK_TO_KEY]: "owner@example.com",
      },
      fetchImpl as unknown as typeof fetch,
    );
    await mailer(MAIL);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(RESEND_API_URL);
    const init = fetchImpl.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_dummy_key");
    const body = JSON.parse(String(init?.body)) as {
      from: string;
      to: string[];
      reply_to: string;
      subject: string;
      text: string;
      attachments: { filename: string; content: string; content_type: string }[];
    };
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.reply_to).toBe("sender@example.com");
    expect(body.subject).toBe(`【${SERVICE_NAME_JA}】ご意見（改善案）`);
    expect(body.text).toContain("棚が使いにくい");
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0]?.filename).toBe("1.jpg");
    expect(body).not.toHaveProperty("html");

    const logged = error.mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain("棚が使いにくい");
    expect(logged).not.toContain("sender@example.com");
    expect(logged).not.toContain("re_test_dummy_key");
  });

  it("送信失敗でも投げず、ログに本文を出さない", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    const mailer = createFeedbackMailer(
      {
        [RESEND_API_KEY_KEY]: "re_test_dummy_key",
        [EMAIL_FROM_KEY]: `${SERVICE_NAME_JA} <noreply@sake-shiori.com>`,
        [FEEDBACK_TO_KEY]: "owner@example.com",
      },
      fetchImpl as unknown as typeof fetch,
    );
    await expect(mailer(MAIL)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith("feedback email send failed");
    const logged = error.mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain("棚が使いにくい");
    expect(logged).not.toContain("sender@example.com");
  });
});
