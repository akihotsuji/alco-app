import { useRef, useState } from "react";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import { useDeleteReaction, usePutReaction, useReactionTypes } from "@/client/hooks/use-social.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { SOCIAL_COPY, type SocialReactionSummary } from "@/shared/social.ts";

type ReactionBarProps = {
  postId: string;
  reactions: SocialReactionSummary[];
  canReact: boolean;
  variant?: "full" | "compact";
};

export function ReactionBar({ postId, reactions, canReact, variant = "full" }: ReactionBarProps) {
  if (variant === "compact") {
    return <CompactReactionBar postId={postId} reactions={reactions} canReact={canReact} />;
  }
  return <FullReactionBar postId={postId} reactions={reactions} canReact={canReact} />;
}

function FullReactionBar({ postId, reactions, canReact }: Omit<ReactionBarProps, "variant">) {
  const types = useReactionTypes();
  const { toggle, pending } = useReactionToggle(postId);
  const mine = reactions.find((item) => item.mine);
  const options = types.data?.items ?? [];

  return (
    // biome-ignore lint/a11y/useSemanticElements: 横並びのトグル群。fieldset だと flex が崩れる
    <div className="reaction-bar" role="group" aria-label="リアクション">
      {options.map((type) => {
        const summary = reactions.find((item) => item.typeId === type.id);
        const selected = summary?.mine ?? false;
        return (
          <button
            key={type.id}
            type="button"
            className={selected ? "reaction-chip is-mine" : "reaction-chip"}
            disabled={!canReact || pending}
            aria-pressed={selected}
            onClick={() => toggle(type.id, mine?.typeId)}
          >
            <span aria-hidden>{type.emoji}</span>
            <span>{type.label}</span>
            {summary && summary.count > 0 ? <span>{summary.count}</span> : null}
          </button>
        );
      })}
      {options.length === 0
        ? reactions.map((item) => (
            <span key={item.typeId} className="reaction-chip">
              <span aria-hidden>{item.emoji}</span>
              <span>{item.label}</span>
              <span>{item.count}</span>
            </span>
          ))
        : null}
    </div>
  );
}

function CompactReactionBar({ postId, reactions, canReact }: Omit<ReactionBarProps, "variant">) {
  const types = useReactionTypes();
  const { toggle, pending, error, clearError } = useReactionToggle(postId);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mine = reactions.find((item) => item.mine);
  const others = reactions.filter((item) => item.count > 0);
  const total = others.reduce((sum, item) => sum + item.count, 0);
  const preview = others.slice(0, 2);
  const options = types.data?.items ?? [];

  function closeSheet() {
    setOpen(false);
    clearError();
  }

  async function onSelect(typeId: string) {
    const ok = await toggle(typeId, mine?.typeId);
    if (ok) {
      closeSheet();
    }
  }

  const summary =
    preview.length > 0 ? (
      <span className="reaction-compact-summary">
        {preview.map((item) => (
          <span key={item.typeId} aria-hidden>
            {item.emoji}
          </span>
        ))}
        <span>{total}</span>
      </span>
    ) : null;

  if (!canReact) {
    return summary ? <div className="reaction-compact">{summary}</div> : null;
  }

  return (
    <div className="reaction-compact">
      <button
        ref={triggerRef}
        type="button"
        className={mine ? "reaction-compact-btn is-mine" : "reaction-compact-btn"}
        disabled={pending}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden>{mine?.emoji ?? "😊"}</span>
        <span>{mine?.label ?? SOCIAL_COPY.reactionAction}</span>
        {summary}
      </button>
      <DialogRoot
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            closeSheet();
          }
        }}
      >
        <DialogContent
          className="app-sheet-panel"
          aria-describedby="reaction-sheet-desc"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DialogTitle className="text-[length:var(--text-title)] font-semibold leading-[1.3]">
            {SOCIAL_COPY.reactionAction}
          </DialogTitle>
          <DialogDescription id="reaction-sheet-desc" className="share-field-hint">
            種類を選ぶと同じ種類でもう一度押すと取り消せます
          </DialogDescription>
          {/* biome-ignore lint/a11y/useSemanticElements: シート内のトグル群 */}
          <div className="reaction-sheet-list" role="group" aria-label="リアクション">
            {options.map((type) => {
              const summaryItem = reactions.find((item) => item.typeId === type.id);
              const selected = summaryItem?.mine ?? false;
              return (
                <button
                  key={type.id}
                  type="button"
                  className={selected ? "reaction-sheet-item is-mine" : "reaction-sheet-item"}
                  disabled={pending}
                  aria-pressed={selected}
                  onClick={() => void onSelect(type.id)}
                >
                  <span aria-hidden>{type.emoji}</span>
                  <span>{type.label}</span>
                  {summaryItem && summaryItem.count > 0 ? <span>{summaryItem.count}</span> : null}
                </button>
              );
            })}
          </div>
          {error ? (
            <p className="settings-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="button" variant="ghost" onClick={closeSheet} disabled={pending}>
            閉じる
          </Button>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}

function useReactionToggle(postId: string) {
  const put = usePutReaction();
  const remove = useDeleteReaction();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const pending = put.isPending || remove.isPending;

  async function toggle(typeId: string, mineTypeId?: string): Promise<boolean> {
    if (pending) {
      return false;
    }
    setError(null);
    try {
      if (mineTypeId === typeId) {
        await remove.mutateAsync(postId);
      } else {
        await put.mutateAsync({ postId, reactionTypeId: typeId });
      }
      return true;
    } catch (caught) {
      const message = isApiClientError(caught)
        ? "保存できませんでした。もう一度試してください"
        : "保存できませんでした。もう一度試してください";
      setError(message);
      showToast({ message });
      return false;
    }
  }

  return { toggle, pending, error, clearError: () => setError(null) };
}
