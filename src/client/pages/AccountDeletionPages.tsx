import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  TURNSTILE_LOAD_ERROR_MESSAGE,
  useTurnstileGate,
} from "@/client/auth/use-turnstile-gate.ts";
import { PasswordField } from "@/client/components/auth/PasswordField.tsx";
import { TurnstileField } from "@/client/components/auth/TurnstileField.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { Label } from "@/client/components/ui/label.tsx";
import { useMe } from "@/client/hooks/use-me.ts";
import {
  discardAccountScopedClientData,
  notifyAccountDeletionAccepted,
} from "@/client/lib/account-deletion-client.ts";
import { api, isApiClientError, unwrap } from "@/client/lib/api.ts";
import { authClient } from "@/client/lib/auth-client.ts";
import { historyIdx } from "@/client/lib/history-state.ts";
import { cn } from "@/client/lib/utils.ts";
import { ACCOUNT_DELETION_COPY, ACCOUNT_DELETION_PENDING_USER_KEY } from "@/shared/account-deletion.ts";
import { legalHref } from "@/shared/legal.ts";
import { GOOGLE_OAUTH_PROVIDER, OAUTH_ERROR_MESSAGE } from "@/shared/oauth.ts";
import { turnstileRequestHeaders } from "@/shared/turnstile.ts";

function readPendingUserId(): string | null {
  try {
    return sessionStorage.getItem(ACCOUNT_DELETION_PENDING_USER_KEY);
  } catch {
    return null;
  }
}

function writePendingUserId(userId: string): void {
  try {
    sessionStorage.setItem(ACCOUNT_DELETION_PENDING_USER_KEY, userId);
  } catch {
    // 記憶できなくてもサーバー側の 5 分判定が残る
  }
}

function clearPendingUserId(): void {
  try {
    sessionStorage.removeItem(ACCOUNT_DELETION_PENDING_USER_KEY);
  } catch {
    //
  }
}

function finishAcceptedDeletion(navigate: ReturnType<typeof useNavigate>, qc: ReturnType<typeof useQueryClient>) {
  navigate("/account-deleted", { replace: true });
  void qc.cancelQueries();
  qc.clear();
  discardAccountScopedClientData();
  notifyAccountDeletionAccepted();
  void authClient.signOut().catch(() => {
    authClient.$store.notify("$sessionSignal");
  });
}

export function AccountDeletePage() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const turnstile = useTurnstileGate();
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [wrongAccount, setWrongAccount] = useState(false);
  const [googleReauthed, setGoogleReauthed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.data) {
      return;
    }
    const pending = readPendingUserId();
    if (!pending) {
      return;
    }
    if (pending !== me.data.id) {
      clearPendingUserId();
      setWrongAccount(true);
      setGoogleReauthed(false);
      return;
    }
    setWrongAccount(false);
    setGoogleReauthed(true);
  }, [me.data]);

  const hasPassword = me.data?.hasPassword === true;
  const googleOnly = me.data?.hasPassword === false && me.data.hasGoogle;
  const identityReady = hasPassword ? password.length > 0 : googleReauthed;
  const canSubmit =
    Boolean(me.data) &&
    confirmed &&
    identityReady &&
    !wrongAccount &&
    !submitting &&
    !googleBusy;

  function refreshTurnstile() {
    turnstile.setToken(null);
    setWidgetKey((value) => value + 1);
  }

  async function onGoogleReauth() {
    if (!me.data || !turnstile.canAct) {
      return;
    }
    setGoogleBusy(true);
    setError(null);
    writePendingUserId(me.data.id);
    const result = await authClient.signIn.social({
      provider: GOOGLE_OAUTH_PROVIDER,
      callbackURL: "/settings/account/delete",
      errorCallbackURL: "/settings/account/delete",
      fetchOptions: {
        headers: turnstileRequestHeaders(turnstile.token),
      },
    });
    if (result.error) {
      setGoogleBusy(false);
      refreshTurnstile();
      setError(OAUTH_ERROR_MESSAGE);
    }
  }

  async function onSubmit() {
    if (!canSubmit || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await unwrap(
        api.api.me["account-deletion"].$post({
          json: hasPassword ? { confirmed: true, password } : { confirmed: true },
        }),
      );
      finishAcceptedDeletion(navigate, qc);
    } catch (caught) {
      setSubmitting(false);
      refreshTurnstile();
      if (isApiClientError(caught)) {
        if (caught.code === "reauthentication_required") {
          setError(ACCOUNT_DELETION_COPY.reauthRequired);
          return;
        }
        if (caught.code === "rate_limited") {
          setError(ACCOUNT_DELETION_COPY.rateLimited);
          return;
        }
        if (caught.code === "unauthorized") {
          setError(ACCOUNT_DELETION_COPY.generic);
          return;
        }
        setError(ACCOUNT_DELETION_COPY.generic);
        return;
      }
      setError(ACCOUNT_DELETION_COPY.disconnect);
    }
  }

  function onCancel() {
    const fallback = me.data?.ageVerified ? "/settings" : "/age";
    const idx = historyIdx(window.history.state);
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }

  if (me.isPending) {
    return <p className="account-delete-copy">読み込み中</p>;
  }
  if (me.isError || !me.data) {
    return <QueryError onRetry={() => me.refetch()} retrying={me.isFetching} />;
  }

  const shownError = turnstile.blocked ? TURNSTILE_LOAD_ERROR_MESSAGE : error;

  return (
    <div className="account-delete-page">
      <p className="account-delete-copy">{ACCOUNT_DELETION_COPY.body}</p>
      <p className="account-delete-note">
        {ACCOUNT_DELETION_COPY.note}{" "}
        <Link className="account-delete-privacy" to={legalHref("/privacy", "settings")}>
          プライバシーポリシー
        </Link>
      </p>

      <div className="signup-legal">
        <input
          id="account-delete-confirm"
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <label htmlFor="account-delete-confirm">{ACCOUNT_DELETION_COPY.confirm}</label>
      </div>

      {hasPassword ? (
        <>
          <Label htmlFor="account-delete-password">{ACCOUNT_DELETION_COPY.passwordLabel}</Label>
          <PasswordField
            id="account-delete-password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? "account-delete-error" : undefined}
          />
        </>
      ) : null}

      {googleOnly ? (
        <div className="account-delete-google">
          <Button
            type="button"
            variant="secondary"
            disabled={googleBusy || submitting || !turnstile.canAct}
            onClick={() => void onGoogleReauth()}
          >
            {ACCOUNT_DELETION_COPY.googleReauth}
          </Button>
          {turnstile.siteKey ? (
            <TurnstileField
              key={widgetKey}
              siteKey={turnstile.siteKey}
              onTokenChange={turnstile.setToken}
              onLoadError={() => setError(TURNSTILE_LOAD_ERROR_MESSAGE)}
            />
          ) : null}
        </div>
      ) : null}

      {wrongAccount ? <p className="account-delete-error">{ACCOUNT_DELETION_COPY.wrongAccount}</p> : null}
      {shownError ? (
        <p id="account-delete-error" className="account-delete-error" role="alert">
          {shownError}
        </p>
      ) : null}

      <SaveBar
        label={ACCOUNT_DELETION_COPY.submit}
        pendingLabel={ACCOUNT_DELETION_COPY.submitting}
        variant="destructive"
        pending={submitting}
        disabled={!canSubmit}
        onSave={() => void onSubmit()}
      />
      <Button className="mt-4" type="button" variant="ghost" onClick={onCancel}>
        {ACCOUNT_DELETION_COPY.cancel}
      </Button>
    </div>
  );
}

export function AccountDeletedPage() {
  return (
    <main className="account-deleted-page">
      <h1 className="account-deleted-title">{ACCOUNT_DELETION_COPY.acceptedTitle}</h1>
      <p className="account-deleted-copy">{ACCOUNT_DELETION_COPY.acceptedBody}</p>
      <Link className={cn(buttonVariants(), "account-deleted-login")} to="/login">
        {ACCOUNT_DELETION_COPY.login}
      </Link>
    </main>
  );
}
