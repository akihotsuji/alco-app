import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALERT_WEBHOOK_URL_KEY,
  buildErrorAlertPayload,
  ERROR_ALERT_COOLDOWN_MS,
  errorNameOf,
  readAlertWebhookUrl,
  reportUnexpectedError,
  resetErrorAlertCooldownForTests,
  resolveWorkerLabel,
  sendErrorAlert,
} from "./error-alert.ts";

const WEBHOOK = "https://ntfy.example/topic-should-not-leak";
const SECRET_MARKER = "super-secret-cookie-value";
const MEMO_MARKER = "昨夜の店名と感想";

afterEach(() => {
  resetErrorAlertCooldownForTests();
  vi.restoreAllMocks();
});

describe("readAlertWebhookUrl", () => {
  it("https のみを返し、http・userinfo・不正値は捨てる", () => {
    expect(readAlertWebhookUrl({ [ALERT_WEBHOOK_URL_KEY]: WEBHOOK })).toBe(WEBHOOK);
    expect(
      readAlertWebhookUrl({ [ALERT_WEBHOOK_URL_KEY]: "http://alert.example/hook" }),
    ).toBeUndefined();
    expect(
      readAlertWebhookUrl({ [ALERT_WEBHOOK_URL_KEY]: "https://user:pass@alert.example/hook" }),
    ).toBeUndefined();
    expect(readAlertWebhookUrl({ [ALERT_WEBHOOK_URL_KEY]: "javascript:alert(1)" })).toBeUndefined();
    expect(readAlertWebhookUrl({ [ALERT_WEBHOOK_URL_KEY]: "" })).toBeUndefined();
    expect(readAlertWebhookUrl({})).toBeUndefined();
  });
});

describe("resolveWorkerLabel / errorNameOf", () => {
  it("CANONICAL_ORIGIN があるときだけ本番ラベルにする", () => {
    expect(resolveWorkerLabel({})).toBe("alco-app-dev");
    expect(resolveWorkerLabel({ CANONICAL_ORIGIN: "https://sake-shiori.com" })).toBe(
      "alco-app-prod",
    );
  });

  it("Error.name だけを返し、メッセージは使わない", () => {
    expect(errorNameOf(new TypeError(`${SECRET_MARKER} ${MEMO_MARKER}`))).toBe("TypeError");
    expect(errorNameOf("not-an-error")).toBe("Error");
    const crafted = new Error("x");
    crafted.name = `Error ${SECRET_MARKER}`;
    expect(errorNameOf(crafted)).toBe("Error");
  });
});

describe("sendErrorAlert", () => {
  it("未設定なら送らず fetch しない", async () => {
    const fetchImpl = vi.fn();
    await expect(
      sendErrorAlert({
        env: {},
        worker: "alco-app-dev",
        kind: "unhandled_error",
        method: "GET",
        path: "/api/drink-logs",
        errorName: "Error",
        fetchImpl,
      }),
    ).resolves.toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("許可キーだけの JSON を HTTPS へ POST する", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await sendErrorAlert({
      env: { [ALERT_WEBHOOK_URL_KEY]: WEBHOOK },
      worker: "alco-app-prod",
      kind: "unhandled_error",
      method: "GET",
      path: "/api/drink-logs",
      errorName: "TypeError",
      fetchImpl,
    });
    expect(result).toBe("sent");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(WEBHOOK);
    expect(init).toMatchObject({
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/json" },
    });
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual(
      buildErrorAlertPayload({
        worker: "alco-app-prod",
        kind: "unhandled_error",
        method: "GET",
        path: "/api/drink-logs",
        errorName: "TypeError",
      }),
    );
    expect(Object.keys(body).sort()).toEqual([
      "errorName",
      "kind",
      "method",
      "path",
      "source",
      "worker",
    ]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(SECRET_MARKER);
    expect(serialized).not.toContain(MEMO_MARKER);
    expect(serialized).not.toContain("Cookie");
    expect(serialized).not.toContain("stack");
  });

  it("同じキーは冷却中に再送しない", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const base = {
      env: { [ALERT_WEBHOOK_URL_KEY]: WEBHOOK },
      worker: "alco-app-dev" as const,
      kind: "unhandled_error" as const,
      method: "GET",
      path: "/boom",
      errorName: "Error",
      fetchImpl,
    };
    expect(await sendErrorAlert({ ...base, nowMs: 1_000 })).toBe("sent");
    expect(await sendErrorAlert({ ...base, nowMs: 1_000 + ERROR_ALERT_COOLDOWN_MS - 1 })).toBe(
      "skipped",
    );
    expect(await sendErrorAlert({ ...base, nowMs: 1_000 + ERROR_ALERT_COOLDOWN_MS })).toBe("sent");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fetch 失敗でも投げず、本文や URL をログに出さない", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error(`failed ${SECRET_MARKER}`));
    await expect(
      sendErrorAlert({
        env: { [ALERT_WEBHOOK_URL_KEY]: WEBHOOK },
        worker: "alco-app-dev",
        kind: "probe",
        method: "PROBE",
        path: "/probe",
        errorName: "Error",
        fetchImpl,
      }),
    ).resolves.toBe("skipped");
    expect(errorSpy).toHaveBeenCalledWith("[alert] webhook failed");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(SECRET_MARKER);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(WEBHOOK);
  });
});

describe("reportUnexpectedError", () => {
  it("env が無い・不正 URL は送らない", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(
      await reportUnexpectedError({
        env: undefined,
        kind: "unhandled_error",
        method: "GET",
        path: "/boom",
        err: new Error(SECRET_MARKER),
      }),
    ).toBe("skipped");
    expect(
      await reportUnexpectedError({
        env: { [ALERT_WEBHOOK_URL_KEY]: "http://alert.example/hook" },
        kind: "scheduled_error",
        method: "CRON",
        path: "scheduled",
        err: new Error(MEMO_MARKER),
      }),
    ).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
