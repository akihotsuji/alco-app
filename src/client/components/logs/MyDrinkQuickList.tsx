import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { deleteDrinkLog } from "@/client/hooks/use-drink-logs.ts";
import { type MyDrink, useLogMyDrink } from "@/client/hooks/use-my-drinks.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { MOTION_MS, type MotionState } from "@/client/lib/motion.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";

type LoggedDrink = {
  id: string;
  drunkOn: string;
  alcoholG: number;
};

type MyDrinkQuickListProps = {
  items: readonly MyDrink[];
  disabled?: boolean;
  drunkAt?: string;
  onLogged?: (log: LoggedDrink) => void;
  onUndone?: () => void;
};

export function MyDrinkQuickList({
  items,
  disabled = false,
  drunkAt,
  onLogged,
  onUndone,
}: MyDrinkQuickListProps) {
  const mutation = useLogMyDrink();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeState, setActiveState] = useState<MotionState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  async function undo(logId: string) {
    try {
      await deleteDrinkLog(logId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogSummaries }),
      ]);
      onUndone?.();
    } catch {
      showToast({ message: TOAST_MESSAGES.saveFailed });
    }
  }

  function log(item: MyDrink) {
    if (disabled || mutation.isPending) {
      return;
    }
    setActiveId(item.id);
    setActiveState("loading");
    mutation.mutate(
      { id: item.id, body: drunkAt ? { drunkAt } : {} },
      {
        onSuccess: (created) => {
          haptic("success");
          setActiveState("success");
          onLogged?.(created);
          showToast({
            message: TOAST_MESSAGES.logged,
            action: { label: "取り消す", onSelect: () => void undo(created.id) },
          });
          timerRef.current = setTimeout(() => {
            setActiveId(null);
            setActiveState("idle");
          }, MOTION_MS.fill + MOTION_MS.state);
        },
        onError: () => {
          setActiveId(null);
          setActiveState("error");
          showToast({ message: TOAST_MESSAGES.saveFailed });
          void queryClient.invalidateQueries({ queryKey: queryKeys.myDrinks });
        },
      },
    );
  }

  return (
    <div className="chip-row chip-row-wrap mydrink-quick-list">
      {items.slice(0, 4).map((item) => (
        <Chip
          key={item.id}
          className="mydrink-quick-chip"
          disabled={disabled || mutation.isPending}
          state={activeId === item.id ? activeState : "idle"}
          onSelect={() => log(item)}
        >
          <span className="mydrink-quick-name">{item.name}</span>
          <span>{item.volumeMl}ml</span>
        </Chip>
      ))}
    </div>
  );
}
