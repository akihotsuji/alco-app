import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { nextBottleSearchParams, replaceSearchKeepState } from "@/client/lib/history-state.ts";
import { DRINK_TYPES, type DrinkType } from "@/shared/constants.ts";

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function useBottleListFilters() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const drinkTypeParam = searchParams.get("drinkType");
  const drinkType =
    drinkTypeParam && (DRINK_TYPES as readonly string[]).includes(drinkTypeParam)
      ? (drinkTypeParam as DrinkType)
      : undefined;
  const [qInput, setQInput] = useState(qParam);
  const [searchOpen, setSearchOpen] = useState(qParam.length > 0);
  const [typeOpen, setTypeOpen] = useState(false);
  const q = useDebounced(qInput.trim(), 300);
  const navigateOptions = replaceSearchKeepState(location.state);

  useEffect(() => {
    const next = nextBottleSearchParams(searchParams, q);
    if (!next) {
      return;
    }
    setSearchParams(next, navigateOptions);
  }, [q, searchParams, setSearchParams, navigateOptions]);

  function keepView(current: URLSearchParams): URLSearchParams {
    const next = new URLSearchParams();
    const view = current.get("view");
    if (view) {
      next.set("view", view);
    }
    return next;
  }

  function clearFilters() {
    setQInput("");
    setSearchOpen(false);
    setTypeOpen(false);
    setSearchParams((current) => keepView(current), navigateOptions);
  }

  function clearDrinkType() {
    setTypeOpen(false);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("drinkType");
      return next;
    }, navigateOptions);
  }

  function selectDrinkType(type: DrinkType) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("drinkType", type);
      return next;
    }, navigateOptions);
    setTypeOpen(false);
  }

  return {
    q,
    qInput,
    setQInput,
    searchOpen,
    setSearchOpen,
    typeOpen,
    setTypeOpen,
    drinkType,
    clearFilters,
    clearDrinkType,
    selectDrinkType,
  };
}
