import { readCanonicalOrigin } from "../canonical-redirect.ts";

/** wrangler secret / `.dev.vars` のキー。値はここに書かない。 */
export const ALERT_WEBHOOK_URL_KEY = "ALERT_WEBHOOK_URL";

export const ERROR_ALERT_SOURCE = "alco-app";

export const ERROR_ALERT_KINDS = ["unhandled_error", "scheduled_error", "probe"] as const;

export type ErrorAlertKind = (typeof ERROR_ALERT_KINDS)[number];

export type ErrorAlertWorker = "alco-app-dev" | "alco-app-prod";

export type ErrorAlertPayload = {
  source: typeof ERROR_ALERT_SOURCE;
  worker: ErrorAlertWorker;
  kind: ErrorAlertKind;
  method: string;
  path: string;
  errorName: string;
};

export type ErrorAlertResult = "sent" | "skipped";

export const ERROR_ALERT_COOLDOWN_MS = 5 * 60 * 1000;

const ERROR_NAME = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

const lastSentAt = new Map<string, number>();

export function readAlertWebhookUrl(env: object): string | undefined {
  const value = Reflect.get(env, ALERT_WEBHOOK_URL_KEY);
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

export function resolveWorkerLabel(env: object): ErrorAlertWorker {
  return readCanonicalOrigin(env) ? "alco-app-prod" : "alco-app-dev";
}

export function errorNameOf(err: unknown): string {
  if (err instanceof Error && ERROR_NAME.test(err.name)) {
    return err.name;
  }
  return "Error";
}

export function buildErrorAlertPayload(input: {
  worker: ErrorAlertWorker;
  kind: ErrorAlertKind;
  method: string;
  path: string;
  errorName: string;
}): ErrorAlertPayload {
  return {
    source: ERROR_ALERT_SOURCE,
    worker: input.worker,
    kind: input.kind,
    method: input.method,
    path: input.path,
    errorName: input.errorName,
  };
}

function cooldownKey(payload: ErrorAlertPayload): string {
  return `${payload.worker}|${payload.kind}|${payload.method}|${payload.path}|${payload.errorName}`;
}

export function resetErrorAlertCooldownForTests(): void {
  lastSentAt.clear();
}

export async function sendErrorAlert(input: {
  env: object;
  worker: ErrorAlertWorker;
  kind: ErrorAlertKind;
  method: string;
  path: string;
  errorName: string;
  nowMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ErrorAlertResult> {
  const webhook = readAlertWebhookUrl(input.env);
  if (!webhook) {
    return "skipped";
  }

  const payload = buildErrorAlertPayload(input);
  const nowMs = input.nowMs ?? Date.now();
  const key = cooldownKey(payload);
  const previous = lastSentAt.get(key);
  if (previous !== undefined && nowMs - previous < ERROR_ALERT_COOLDOWN_MS) {
    return "skipped";
  }

  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  try {
    await fetchImpl(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      redirect: "manual",
      body: JSON.stringify(payload),
    });
    lastSentAt.set(key, nowMs);
    return "sent";
  } catch {
    console.error("[alert] webhook failed");
    return "skipped";
  }
}

export async function reportUnexpectedError(input: {
  env: object | undefined;
  kind: Exclude<ErrorAlertKind, "probe">;
  method: string;
  path: string;
  err: unknown;
}): Promise<ErrorAlertResult> {
  if (!input.env) {
    return "skipped";
  }
  return sendErrorAlert({
    env: input.env,
    worker: resolveWorkerLabel(input.env),
    kind: input.kind,
    method: input.method,
    path: input.path,
    errorName: errorNameOf(input.err),
  });
}
