import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { parseDrinkTypeParam } from "@/client/lib/cellar-shelf.ts";
import { applyCellarToolbarParams, replaceSearchKeepState } from "@/client/lib/history-state.ts";
import type { DrinkType } from "@/shared/constants.ts";

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
  const drinkType = parseDrinkTypeParam(drinkTypeParam);
  const [qInput, setQInput] = useState(qParam);
  const [searchOpen, setSearchOpen] = useState(qParam.length > 0);
  const [typeOpen, setTypeOpen] = useState(false);
  const q = useDebounced(qInput.trim(), 300);
  const navigateOptions = replaceSearchKeepState(location.state);

  useEffect(() => {
    const next = applyCellarToolbarParams(searchParams, { type: "setQuery", q });
    if (!next) {
      return;
    }
    setSearchParams(next, navigateOptions);
  }, [q, searchParams, setSearchParams, navigateOptions]);

  function clearFilters() {
    setQInput("");
    setSearchOpen(false);
    setTypeOpen(false);
    setSearchParams(
      (current) => applyCellarToolbarParams(current, { type: "clearFilters" }) ?? current,
      navigateOptions,
    );
  }

  function clearDrinkType() {
    setTypeOpen(false);
    setSearchParams(
      (current) => applyCellarToolbarParams(current, { type: "clearDrinkType" }) ?? current,
      navigateOptions,
    );
  }

  function selectDrinkType(type: DrinkType) {
    setSearchParams(
      (current) =>
        applyCellarToolbarParams(current, { type: "selectDrinkType", drinkType: type }) ?? current,
      navigateOptions,
    );
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
