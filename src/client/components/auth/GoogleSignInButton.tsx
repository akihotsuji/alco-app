import { ageGatePath } from "@/client/auth/age-path.ts";
import { authClientErrorMessage } from "@/client/auth/auth-error.ts";
import { oauthErrorCallbackPath } from "@/client/auth/oauth.ts";
import { Button } from "@/client/components/ui/button.tsx";
import { authClient } from "@/client/lib/auth-client.ts";
import { resolveSafeRedirect } from "@/shared/auth.ts";
import { LEGAL_VERSION } from "@/shared/legal.ts";
import {
  GOOGLE_OAUTH_PROVIDER,
  googleSignInLabel,
  OAUTH_ERROR_MESSAGE,
  OAUTH_SIGNUP_ERROR_MESSAGE,
} from "@/shared/oauth.ts";
import { turnstileRequestHeaders } from "@/shared/turnstile.ts";

type GoogleSignInButtonProps = {
  mode: "login" | "signup";
  redirectQuery: string | null;
  acceptedLegal: boolean;
  disabled: boolean;
  turnstileToken?: string | null;
  onError: (message: string | null) => void;
  onBusyChange: (busy: boolean) => void;
};

export function GoogleSignInButton({
  mode,
  redirectQuery,
  acceptedLegal,
  disabled,
  turnstileToken = null,
  onError,
  onBusyChange,
}: GoogleSignInButtonProps) {
  const requestSignUp = mode === "signup";
  const canStart = !disabled && (!requestSignUp || acceptedLegal);

  async function onClick() {
    if (!canStart) {
      return;
    }
    onBusyChange(true);
    onError(null);
    const result = await authClient.signIn.social({
      provider: GOOGLE_OAUTH_PROVIDER,
      callbackURL: resolveSafeRedirect(redirectQuery),
      newUserCallbackURL: ageGatePath(redirectQuery),
      errorCallbackURL: oauthErrorCallbackPath(
        mode === "signup" ? "/signup" : "/login",
        redirectQuery,
      ),
      requestSignUp,
      additionalData: requestSignUp
        ? { acceptedLegal: true, legalVersion: LEGAL_VERSION }
        : undefined,
      fetchOptions: {
        headers: turnstileRequestHeaders(turnstileToken),
      },
    });
    if (result.error) {
      onBusyChange(false);
      onError(
        authClientErrorMessage(
          result.error.status,
          requestSignUp ? OAUTH_SIGNUP_ERROR_MESSAGE : OAUTH_ERROR_MESSAGE,
          result.error.message,
        ),
      );
    }
  }

  return (
    <div className="auth-oauth">
      <p className="auth-oauth-divider">または</p>
      <Button type="button" variant="secondary" disabled={!canStart} onClick={onClick}>
        {googleSignInLabel(mode)}
      </Button>
    </div>
  );
}
