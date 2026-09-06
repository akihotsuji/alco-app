import { useEffect, useState } from "react";
import {
  getReduceMotionPref,
  PREF_CHANGE_EVENT,
  parseReduceMotionPref,
} from "@/client/lib/preferences.ts";
import { type ReduceMotionPref, UI_PREF_KEYS } from "@/shared/constants.ts";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** OS の設定と「動きを減らす = 常に減らす」のどちらかで true（motion-design 6.7） */
export function resolveReduceMotion(osReduce: boolean, pref: ReduceMotionPref): boolean {
  return osReduce || pref === "always";
}

function osPrefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** OS の `prefers-reduced-motion: reduce`。設定「動きを減らす」の副文（06-settings S9）に使う */
export function useOsPrefersReducedMotion(): boolean {
  const [osReduce, setOsReduce] = useState(osPrefersReducedMotion);

  useEffect(() => {
    if (typeof matchMedia !== "function") {
      return;
    }
    const query = matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setOsReduce(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return osReduce;
}

/**
 * 動きを減らすかどうか。JS 側の分岐（`scrollIntoView` の behavior、`pour` の有無）に使う。
 * CSS 側は AppShell が `<html data-reduce-motion="1">` を付け外しし、同じ判定を共有する。
 */
export function useReducedMotion(): boolean {
  const osReduce = useOsPrefersReducedMotion();
  const [pref, setPref] = useState<ReduceMotionPref>(getReduceMotionPref);

  useEffect(() => {
    const onPrefChange = () => setPref(getReduceMotionPref());
    const onStorage = (event: StorageEvent) => {
      if (event.key === UI_PREF_KEYS.reduceMotion) {
        setPref(parseReduceMotionPref(event.newValue));
      }
    };
    window.addEventListener(PREF_CHANGE_EVENT, onPrefChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PREF_CHANGE_EVENT, onPrefChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return resolveReduceMotion(osReduce, pref);
}
