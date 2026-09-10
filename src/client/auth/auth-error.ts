import { SIGNUPS_CLOSED_MESSAGE } from "@/shared/auth.ts";

const RATE_LIMIT_MESSAGE = "しばらく待ってから試してください";

/** Better Auth の失敗を画面文言へ。429 と登録停止だけサーバー文を許可する。 */
export function authClientErrorMessage(
  status: number | undefined,
  fallback: string,
  serverMessage?: string,
): string {
  if (status === 429) {
    return RATE_LIMIT_MESSAGE;
  }
  if (serverMessage === SIGNUPS_CLOSED_MESSAGE) {
    return SIGNUPS_CLOSED_MESSAGE;
  }
  return fallback;
}
