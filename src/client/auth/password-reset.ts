export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "入力されたメールアドレスに、再設定の案内を送りました。届かない場合は受信トレイと迷惑メールを確認してください。";

export const RESET_PASSWORD_INVALID_MESSAGE =
  "有効期限切れか、すでに使われたリンクです。もう一度メールからやり直してください。";

export const LOGIN_AFTER_RESET_MESSAGE = "パスワードを変更しました。ログインしてください。";

export const RESET_PASSWORD_MISMATCH_MESSAGE = "パスワードが一致しません";

export function readResetToken(searchParams: URLSearchParams): string | null {
  const token = searchParams.get("token");
  return token && token.length > 0 ? token : null;
}

export function isInvalidResetLink(searchParams: URLSearchParams): boolean {
  const error = searchParams.get("error");
  return error === "INVALID_TOKEN" || error === "invalid_token";
}

export function loginNoticeFromSearch(searchParams: URLSearchParams): string | null {
  return searchParams.get("reset") === "1" ? LOGIN_AFTER_RESET_MESSAGE : null;
}

export function shouldStripResetQuery(searchParams: URLSearchParams): boolean {
  return searchParams.has("token") || searchParams.has("error");
}
