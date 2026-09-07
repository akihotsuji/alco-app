import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router";
import { resolveCellarListView } from "@/client/lib/cellar-shelf.ts";
import { replaceSearchKeepState } from "@/client/lib/history-state.ts";
import { getCellarListViewPref, setCellarListViewPref } from "@/client/lib/preferences.ts";
import type { CellarListView } from "@/shared/constants.ts";

export function useCellarListView(): {
  view: CellarListView;
  setView: (view: CellarListView) => void;
} {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlView = searchParams.get("view");
  const view = resolveCellarListView(urlView, getCellarListViewPref());
  const navigateOptions = replaceSearchKeepState(location.state);

  useEffect(() => {
    if (urlView === view) {
      return;
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("view", view);
      return next;
    }, navigateOptions);
  }, [navigateOptions, setSearchParams, urlView, view]);

  function setView(nextView: CellarListView) {
    setCellarListViewPref(nextView);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("view", nextView);
      return next;
    }, navigateOptions);
  }

  return { view, setView };
}
