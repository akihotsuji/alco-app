import type { SessionBootKind } from "./session-boot.ts";

export type GuestOnlyContent = "boot" | "redirect" | "outlet";

/**
 * ログイン／登録フォームを一度出したら、セッション再取得中に起動画面へ戻さない。
 * Better Auth の signUp / signIn は送信中に refetch し、フォームを外すと成功後の navigate が消える。
 */
export function resolveGuestOnlyContent(input: {
  kind: SessionBootKind;
  hasBootVariant: boolean;
  settledAsGuest: boolean;
}): GuestOnlyContent {
  if (input.kind === "authenticated") {
    return "redirect";
  }
  if (input.hasBootVariant && !input.settledAsGuest) {
    return "boot";
  }
  return "outlet";
}
