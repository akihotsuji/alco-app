import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCellars } from "@/client/hooks/use-cellars.ts";
import {
  readSelectedCellarId,
  resolveSelectedCellar,
  writeSelectedCellarId,
} from "@/client/lib/cellar-share.ts";
import { PREF_CHANGE_EVENT } from "@/client/lib/preferences.ts";
import type { CellarSummary } from "@/shared/cellars.ts";
import { CELLAR_PREF_KEYS } from "@/shared/constants.ts";

function subscribeSelectedId(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CELLAR_PREF_KEYS.selectedId) {
      onStoreChange();
    }
  };
  const onPref = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.key === CELLAR_PREF_KEYS.selectedId) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PREF_CHANGE_EVENT, onPref);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PREF_CHANGE_EVENT, onPref);
  };
}

export function useSelectedCellarId(): string | null {
  return useSyncExternalStore(subscribeSelectedId, readSelectedCellarId, () => null);
}

export function useCellarSelection() {
  const query = useCellars();
  const storedId = useSelectedCellarId();
  const items = query.data?.items ?? [];
  const selected = useMemo(
    () => resolveSelectedCellar(items, storedId),
    [items, storedId],
  );
  const shared = items.find((item) => item.kind === "shared") ?? null;
  const personal = items.find((item) => item.kind === "personal") ?? null;

  const select = useCallback((cellar: CellarSummary) => {
    writeSelectedCellarId(cellar.id);
    window.dispatchEvent(
      new CustomEvent(PREF_CHANGE_EVENT, { detail: { key: CELLAR_PREF_KEYS.selectedId } }),
    );
  }, []);

  return {
    ...query,
    items,
    selected,
    shared,
    personal,
    select,
  };
}
