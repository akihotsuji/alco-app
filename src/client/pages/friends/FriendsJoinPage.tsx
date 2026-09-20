import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthBoot } from "@/client/auth/AuthBoot.tsx";
import { loginPathFor } from "@/client/auth/login-path.ts";
import { CardSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { InvitePasteForm } from "@/client/components/friends/InvitePasteForm.tsx";
import { SocialAvatar } from "@/client/components/friends/SocialAvatar.tsx";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useSessionBoot } from "@/client/hooks/use-session-boot.ts";
import {
  useCreateFriendRequest,
  useInvitePreview,
  useSocialMe,
} from "@/client/hooks/use-social.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import {
  bindReceivedInviteUser,
  captureFriendJoinToken,
  clearReceivedInvite,
  copyText,
  friendInviteUrl,
  reconstructStoredInviteUrl,
  rememberFriendSuccessToast,
} from "@/client/lib/social-invite.ts";
import { PWA_NAME } from "@/shared/pwa.ts";
import { SOCIAL_COPY } from "@/shared/social.ts";

export function FriendsJoinPage() {
  const boot = useSessionBoot();
  const me = useSocialMe(boot.kind === "authenticated");
  const viewerId = boot.kind === "authenticated" ? (me.data?.userId ?? null) : null;
  const [token, setToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const preview = useInvitePreview(token);
  const request = useCreateFriendRequest();
  const navigate = useNavigate();
  useEffect(() => {
    const next = captureFriendJoinToken(
      window.location.hash,
      (url) => {
        window.history.replaceState(window.history.state, "", url);
      },
      { userId: viewerId },
    );
    if (next) {
      setToken(next);
    }
    if (viewerId) {
      bindReceivedInviteUser(viewerId);
    }
    setTokenReady(true);
  }, [viewerId]);

  const inviteUrl =
    typeof window === "undefined"
      ? null
      : token
        ? friendInviteUrl(window.location.origin, token)
        : reconstructStoredInviteUrl(window.location.origin);

  async function onCopy() {
    if (!inviteUrl) {
      return;
    }
    const ok = await copyText(inviteUrl);
    setCopied(ok);
    setCopyFailed(!ok);
  }

  if (boot.kind === "loading" || boot.kind === "slow" || !tokenReady) {
    return (
      <AuthBoot variant={boot.variant ?? undefined} onRetry={boot.retry} retrying={boot.retrying} />
    );
  }

  if (boot.kind !== "authenticated") {
    return (
      <main className="join-page">
        <h1>{PWA_NAME}</h1>
        <p>酒のしおりで友達になるには、ログインしてください。</p>
        <Link className={buttonVariants()} to={loginPathFor("/friends/join")}>
          {SOCIAL_COPY.loginAndContinue}
        </Link>
        {inviteUrl ? (
          <>
            <Button type="button" variant="secondary" onClick={() => void onCopy()}>
              {SOCIAL_COPY.copyInviteLink}
            </Button>
            {copied ? (
              <p className="share-field-hint">コピーしました。{SOCIAL_COPY.pasteInviteHint}</p>
            ) : null}
            {copyFailed ? (
              <label className="field-label" htmlFor="join-invite-url">
                {SOCIAL_COPY.copyInviteLink}
                <Input
                  id="join-invite-url"
                  readOnly
                  value={inviteUrl}
                  onFocus={(event) => event.target.select()}
                />
              </label>
            ) : null}
            {!copied && !copyFailed ? (
              <p className="share-field-hint">{SOCIAL_COPY.pasteInviteHint}</p>
            ) : null}
          </>
        ) : (
          <p className="share-field-hint">{SOCIAL_COPY.inviteInvalid}</p>
        )}
      </main>
    );
  }

  if (token && preview.isError) {
    const unavailable =
      isApiClientError(preview.error) &&
      (preview.error.code === "not_found" || preview.error.code === "validation_error");
    if (!unavailable) {
      return (
        <main className="join-page">
          <QueryError onRetry={() => preview.refetch()} retrying={preview.isFetching} />
        </main>
      );
    }
  }

  if (token && preview.isPending) {
    return <CardSkeleton />;
  }

  if (!token) {
    return (
      <main className="join-page">
        <h1>{SOCIAL_COPY.addFriend}</h1>
        <p className="share-field-hint">
          受け取った招待リンクを貼り付けて、相手を確認してから申請してください。
        </p>
        <InvitePasteForm
          onParsed={(next) => {
            setToken(
              captureFriendJoinToken(`#t=${next}`, undefined, {
                origin: window.location.origin,
                userId: viewerId,
              }),
            );
          }}
        />
        <Link className={buttonVariants({ variant: "secondary" })} to="/">
          {SOCIAL_COPY.goHome}
        </Link>
      </main>
    );
  }

  if (preview.data?.status === "unavailable" || (preview.isError && !preview.data)) {
    clearReceivedInvite();
    return (
      <main className="join-page">
        <p>{SOCIAL_COPY.inviteInvalid}</p>
        <InvitePasteForm
          onParsed={(next) => {
            setToken(
              captureFriendJoinToken(`#t=${next}`, undefined, {
                origin: window.location.origin,
                userId: viewerId,
              }),
            );
          }}
        />
        <Link className={buttonVariants({ variant: "secondary" })} to="/">
          {SOCIAL_COPY.goHome}
        </Link>
      </main>
    );
  }

  const profile = preview.data?.profile;
  const isOwn = Boolean(profile && me.data && profile.userId === me.data.userId);
  const alreadyFriends = Boolean(preview.data?.alreadyFriends);
  const alreadyRequested = Boolean(preview.data?.alreadyRequested);
  const reversePending = Boolean(preview.data?.reversePending);

  async function sendRequest() {
    if (!token) {
      return;
    }
    try {
      await request.mutateAsync(token);
      clearReceivedInvite();
      rememberFriendSuccessToast(SOCIAL_COPY.requestSent);
      navigate("/", { replace: true });
    } catch (error) {
      if (isApiClientError(error) && error.code === "not_found") {
        clearReceivedInvite();
      }
    }
  }

  return (
    <main className="join-page">
      <h1>友達申請</h1>
      {profile ? (
        <>
          <SocialAvatar profile={profile} size={64} />
          <p>{profile.nickname}</p>
        </>
      ) : null}
      {isOwn ? <p>{SOCIAL_COPY.ownInvite}</p> : null}
      {!isOwn && alreadyFriends ? <p>{SOCIAL_COPY.alreadyFriends}</p> : null}
      {!isOwn && alreadyRequested ? <p>{SOCIAL_COPY.alreadyRequested}</p> : null}
      {!isOwn && reversePending ? (
        <Link className={buttonVariants()} to="/friends/list">
          {SOCIAL_COPY.checkIncoming}
        </Link>
      ) : null}
      {!isOwn && !alreadyFriends && !alreadyRequested && !reversePending ? (
        <Button type="button" onClick={() => void sendRequest()} disabled={request.isPending}>
          {SOCIAL_COPY.sendRequest}
        </Button>
      ) : null}
      {request.isError ? (
        <p className="settings-error" role="alert">
          送信できませんでした。もう一度試してください
        </p>
      ) : null}
      {alreadyFriends || alreadyRequested || isOwn ? (
        <Link className={buttonVariants({ variant: "secondary" })} to="/">
          {SOCIAL_COPY.goHome}
        </Link>
      ) : null}
    </main>
  );
}
