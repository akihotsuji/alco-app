const RATE_LIMIT_MESSAGE = "しばらく待ってから試してください";

/** Better Auth の失敗を画面文言へ。429 だけ共通、それ以外は呼び出し側の汎用文。 */
export function authClientErrorMessage(status: number | undefined, fallback: string): string {
  return status === 429 ? RATE_LIMIT_MESSAGE : fallback;
}
