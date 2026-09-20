import { useDeleteReaction, usePutReaction, useReactionTypes } from "@/client/hooks/use-social.ts";
import type { SocialReactionSummary } from "@/shared/social.ts";

type ReactionBarProps = {
  postId: string;
  reactions: SocialReactionSummary[];
  canReact: boolean;
};

export function ReactionBar({ postId, reactions, canReact }: ReactionBarProps) {
  const types = useReactionTypes();
  const put = usePutReaction();
  const remove = useDeleteReaction();
  const mine = reactions.find((item) => item.mine);
  const options = types.data?.items ?? [];

  function toggle(typeId: string) {
    if (!canReact || put.isPending || remove.isPending) {
      return;
    }
    if (mine?.typeId === typeId) {
      remove.mutate(postId);
      return;
    }
    put.mutate({ postId, reactionTypeId: typeId });
  }

  return (
    <div className="reaction-bar" role="group" aria-label="リアクション">
      {options.map((type) => {
        const summary = reactions.find((item) => item.typeId === type.id);
        const selected = summary?.mine ?? false;
        return (
          <button
            key={type.id}
            type="button"
            className={selected ? "reaction-chip is-mine" : "reaction-chip"}
            disabled={!canReact}
            aria-pressed={selected}
            onClick={() => toggle(type.id)}
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
