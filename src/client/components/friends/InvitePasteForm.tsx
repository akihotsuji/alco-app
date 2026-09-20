import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/client/components/ui/button.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { parsePastedInviteUrl } from "@/client/lib/social-invite.ts";
import { SOCIAL_COPY, SOCIAL_MESSAGES } from "@/shared/social.ts";

type InvitePasteFormProps = {
  onParsed?: (token: string) => void;
};

export function InvitePasteForm({ onParsed }: InvitePasteFormProps) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply(raw: string) {
    const parsed = parsePastedInviteUrl(raw, window.location.origin);
    if (!parsed.ok) {
      setError(SOCIAL_MESSAGES.invite);
      return;
    }
    setError(null);
    if (onParsed) {
      onParsed(parsed.token);
      return;
    }
    navigate(`/friends/join#t=${parsed.token}`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    apply(draft);
  }

  async function pasteAssist() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDraft(text);
        setError(null);
      }
    } catch {
      // 手入力は残す
    }
  }

  return (
    <form className="invite-paste-form" onSubmit={onSubmit}>
      <label className="field-label" htmlFor="invite-paste">
        {SOCIAL_COPY.pasteInviteField}
        <Input
          id="invite-paste"
          value={draft}
          autoComplete="off"
          inputMode="url"
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      {error ? (
        <p className="settings-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="invite-paste-actions">
        <Button type="button" variant="secondary" onClick={() => void pasteAssist()}>
          貼り付け
        </Button>
        <Button type="submit">{SOCIAL_COPY.addFriend}</Button>
      </div>
    </form>
  );
}
