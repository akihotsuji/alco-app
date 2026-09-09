import { resolveSafeRedirect } from "@/shared/auth.ts";
import { hrefWithRedirect } from "./login-path.ts";

/** 未確認ユーザーを `/age` へ。`/` と `/age` 自身は redirect を付けない。 */
export function agePathFor(pathname: string, search = ""): string {
  const redirect = `${pathname}${search}`;
  if (redirect === "/" || pathname === "/age") {
    return "/age";
  }
  return hrefWithRedirect("/age", redirect);
}

/** サインアップ成功後。安全な redirect を `/age` に載せる。 */
export function ageGatePath(redirectQuery: string | null): string {
  const dest = resolveSafeRedirect(redirectQuery);
  return dest === "/" ? "/age" : hrefWithRedirect("/age", dest);
}
