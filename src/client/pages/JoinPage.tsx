import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthBoot } from "@/client/auth/AuthBoot.tsx";
import { loginPathFor } from "@/client/auth/login-path.ts";
import { useSessionBoot } from "@/client/hooks/use-session-boot.ts";
import { useAcceptInvitation, usePreviewInvitation } from "@/client/hooks/use-cellars.ts";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import {
  captureJoinTokenFromLocation,
  clearJoinToken,
  newOperationKey,
  writeSelectedCellarId,
} from "@/client/lib/cellar-share.ts";
import { PREF_CHANGE_EVENT } from "@/client/lib/preferences.ts";
import { CELLAR_COPY } from "@/shared/cellars.ts";
import { CELLAR_PREF_KEYS } from "@/shared/constants.ts";
import { PWA_NAME } from "@/shared/pwa.ts";
import type { InvitationPreview } from "@/shared/cellars.ts";

export function JoinPage() {
  const boot = useSessionBoot();
  const navigate = useNavigate();
  const preview = usePreviewInvitation();
  const accept = useAcceptInvitation();
  const [token, setToken] = useState<string | null>(null);
  const [result, setResult] = useState<InvitationPreview | null>(null);

  useEffect(() => {
    const captured = captureJoinTokenFromLocation(window.location.hash, (url) => {
      window.history.replaceState(window.history.state, "", url);
    });
    setToken(captured);
  }, []);

  const previewMutate = preview.mutate;
  const previewPending = preview.isPending;
  const previewSuccess = preview.isSuccess;
  useEffect(() => {
    if (boot.kind !== "authenticated" || !token || previewPending || previewSuccess) {
      return;
    }
    previewMutate(token, {
      onSuccess: (data) => setResult(data),
    });
  }, [boot.kind, previewMutate, previewPending, previewSuccess, token]);

  if (boot.kind === "loading" || boot.kind === "slow") {
    return <AuthBoot variant={boot.variant ?? undefined} onRetry={boot.retry} retrying={boot.retrying} />;
  }

  if (boot.kind !== "authenticated") {
    return (
      <main className="join-page">
        <h1>{PWA_NAME}</h1>
        <p>招待リンクからの参加です。お酒の記録アプリにログインすると、共有セラーに参加できます。</p>
        <p>ボトル・写真・メンバー名は、参加が確定するまで表示しません。</p>
        <Link className={buttonVariants()} to={loginPathFor("/join")}>
          ログインして参加
        </Link>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="join-page">
        <p>{CELLAR_COPY.inviteUnavailable}</p>
        <Link className={buttonVariants({ variant: "secondary" })} to="/cellar">
          セラーを開く
        </Link>
      </main>
    );
  }

  if (preview.isError || result?.status === "unavailable") {
    return (
      <main className="join-page">
        <p>{CELLAR_COPY.inviteUnavailable}</p>
        <Link className={buttonVariants({ variant: "secondary" })} to="/cellar">
          セラーを開く
        </Link>
      </main>
    );
  }

  if (result?.status === "already_member" && result.cellarId) {
    return (
      <main className="join-page">
        <p>すでにこのセラーに参加しています。</p>
        <Button
          type="button"
          onClick={() => {
            writeSelectedCellarId(result.cellarId ?? "");
            window.dispatchEvent(
              new CustomEvent(PREF_CHANGE_EVENT, { detail: { key: CELLAR_PREF_KEYS.selectedId } }),
            );
            clearJoinToken();
            navigate("/cellar", { replace: true });
          }}
        >
          セラーを開く
        </Button>
      </main>
    );
  }

  if (result?.status === "already_in_other") {
    return (
      <main className="join-page">
        <p>別の共有セラーに参加中です。自動では乗り換えません。</p>
        <Link className={buttonVariants()} to="/cellar/share/settings">
          共有設定
        </Link>
      </main>
    );
  }

  if (!result || result.status !== "joinable") {
    return (
      <main className="join-page">
        <p>招待を確認しています…</p>
      </main>
    );
  }

  return (
    <main className="join-page">
      <h1>{result.cellarName} に参加しますか？</h1>
      {result.inviterName ? <p>招待者：{result.inviterName}</p> : null}
      <p>{CELLAR_COPY.shareBoundary}</p>
      <p>記録に保存したコピーは、脱退後も残ります。</p>
      <Button
        type="button"
        disabled={accept.isPending}
        onClick={() => {
          accept.mutate(
            { token, operationKey: newOperationKey() },
            {
              onSuccess: (joined) => {
                writeSelectedCellarId(joined.cellarId);
                window.dispatchEvent(
                  new CustomEvent(PREF_CHANGE_EVENT, {
                    detail: { key: CELLAR_PREF_KEYS.selectedId },
                  }),
                );
                clearJoinToken();
                navigate("/cellar", { replace: true });
              },
            },
          );
        }}
      >
        参加する
      </Button>
    </main>
  );
}
