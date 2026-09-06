import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { authClientErrorMessage } from "@/client/auth/auth-error.ts";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { authClient } from "@/client/lib/auth-client.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { AUTH_NAME_MAX_LENGTH, AUTH_NAME_MESSAGE, displayNameSchema } from "@/shared/auth.ts";

type DisplayNameRowProps = {
  name: string;
};

const SAVE_FAILED = TOAST_MESSAGES.saveFailed;

export function DisplayNameRow({ name }: DisplayNameRowProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const closeEditRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(name);
    }
  }, [editing, name]);

  async function save() {
    if (saving || closeEditRef.current) {
      return;
    }
    const parsed = displayNameSchema.safeParse(draft);
    if (!parsed.success) {
      setError(AUTH_NAME_MESSAGE);
      return;
    }
    if (parsed.data === name) {
      closeEditRef.current = true;
      setError(null);
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await authClient.updateUser({ name: parsed.data });
    setSaving(false);
    if (result.error) {
      setError(authClientErrorMessage(result.error.status, SAVE_FAILED));
      return;
    }
    closeEditRef.current = true;
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    setEditing(false);
    showToast({ message: TOAST_MESSAGES.saved });
  }

  function cancel() {
    closeEditRef.current = true;
    setDraft(name);
    setError(null);
    setEditing(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (editing) {
    return (
      <div className="settings-row settings-row-stack">
        <span className="settings-row-main">
          <label className="settings-inline-label" htmlFor="settings-display-name">
            表示名
          </label>
          <Input
            id="settings-display-name"
            className="settings-name-input"
            type="text"
            autoComplete="name"
            autoFocus
            maxLength={AUTH_NAME_MAX_LENGTH}
            value={draft}
            disabled={saving}
            aria-invalid={error ? true : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              void save();
            }}
            onKeyDown={onKeyDown}
          />
        </span>
        {error ? (
          <p className="settings-caption settings-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="settings-row"
      onClick={() => {
        closeEditRef.current = false;
        setError(null);
        setDraft(name);
        setEditing(true);
      }}
    >
      <span>表示名</span>
      <span className="settings-value-with-chevron">
        <span className="settings-value">{name || "未設定"}</span>
        <ChevronRight size={20} className="settings-chevron" aria-hidden />
      </span>
    </button>
  );
}
