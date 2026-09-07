import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { parseDrinkTypeParam } from "@/client/lib/cellar-shelf.ts";
import { applyNoteToolbarParams, replaceSearchKeepState } from "@/client/lib/history-state.ts";
import type { DrinkType } from "@/shared/constants.ts";
import { isValidRatingX10, RATING_LIST_MIN_DEFAULT } from "@/shared/tasting-notes.ts";

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function useNoteListFilters() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const drinkType = parseDrinkTypeParam(searchParams.get("drinkType"));
  const ratingRaw = searchParams.get("ratingX10Min");
  const ratingParsed = ratingRaw === null ? Number.NaN : Number(ratingRaw);
  const ratingX10Min = isValidRatingX10(ratingParsed) ? ratingParsed : undefined;
  const ratingChipOn = ratingRaw === String(RATING_LIST_MIN_DEFAULT);
  const bottleId = searchParams.get("bottleId");
  const [qInput, setQInput] = useState(qParam);
  const [searchOpen, setSearchOpen] = useState(qParam.length > 0);
  const [typeOpen, setTypeOpen] = useState(false);
  const q = useDebounced(qInput.trim(), 300);
  const navigateOptions = replaceSearchKeepState(location.state);

  useEffect(() => {
    const next = applyNoteToolbarParams(searchParams, { type: "setQuery", q });
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
      (current) => applyNoteToolbarParams(current, { type: "clearFilters" }) ?? current,
      navigateOptions,
    );
  }

  function clearDrinkType() {
    setTypeOpen(false);
    setSearchParams(
      (current) => applyNoteToolbarParams(current, { type: "clearDrinkType" }) ?? current,
      navigateOptions,
    );
  }

  function selectDrinkType(type: DrinkType) {
    setSearchParams(
      (current) =>
        applyNoteToolbarParams(current, { type: "selectDrinkType", drinkType: type }) ?? current,
      navigateOptions,
    );
    setTypeOpen(false);
  }

  function toggleRatingMin() {
    setSearchParams(
      (current) => applyNoteToolbarParams(current, { type: "toggleRatingMin" }) ?? current,
      navigateOptions,
    );
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
    ratingX10Min,
    ratingChipOn,
    bottleId,
    filtered: Boolean(q || drinkType || ratingX10Min !== undefined),
    clearFilters,
    clearDrinkType,
    selectDrinkType,
    toggleRatingMin,
  };
}
