import { z } from "zod";
import {
  TURNSTILE_SITEVERIFY_URL,
  TURNSTILE_TOKEN_MAX_LENGTH,
  TURNSTILE_VERIFY_TIMEOUT_MS,
} from "@/shared/turnstile.ts";

const siteverifySchema = z.object({
  success: z.boolean(),
});

export type VerifyTurnstile = (input: { token: string; remoteIp?: string }) => Promise<boolean>;

/**
 * Cloudflare siteverify。トークン・シークレット・応答本文はログに出さない。
 * ネットワーク失敗・タイムアウトは失敗（開きにしない）。
 */
export async function verifyTurnstileToken(input: {
  secret: string;
  token: string;
  remoteIp?: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const token = input.token.trim();
  if (!token || token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
    return false;
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_VERIFY_TIMEOUT_MS);
  try {
    const body = new URLSearchParams({
      secret: input.secret,
      response: token,
    });
    if (input.remoteIp) {
      body.set("remoteip", input.remoteIp);
    }
    const response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const parsed = siteverifySchema.safeParse(await response.json());
    return parsed.success && parsed.data.success;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function createTurnstileVerifier(secret: string, fetchImpl?: typeof fetch): VerifyTurnstile {
  return ({ token, remoteIp }) =>
    verifyTurnstileToken({
      secret,
      token,
      remoteIp,
      fetchImpl,
    });
}
