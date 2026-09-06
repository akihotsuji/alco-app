import { type RefCallback, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";

export type HighlightPhase = "enter" | "opening" | "highlight" | "fading" | null;

/**
 * 保存後の `?highlight=` を、行挿入・スクロール・2秒リングへ変換する（M-14〜M-16）。
 * クエリは対象行の有無を確定した時点で replace して、再読み込み時の再演出を防ぐ。
 */
export function useHighlightRow(highlightId: string | null, itemIds: readonly string[]) {
  const [, setSearchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const rowRef = useRef<HTMLAnchorElement | null>(null);
  const [phase, setPhase] = useState<HighlightPhase>(highlightId ? "enter" : null);
  const [targetId, setTargetId] = useState<string | null>(highlightId);
  const highlightedExists = targetId ? itemIds.includes(targetId) : false;

  const register: RefCallback<HTMLAnchorElement> = useCallback((node) => {
    rowRef.current = node;
  }, []);

  useEffect(() => {
    if (highlightId) {
      setTargetId(highlightId);
      setPhase("enter");
    }
  }, [highlightId]);

  useEffect(() => {
    if (!targetId || itemIds.length === 0) {
      return;
    }
    const next = new URLSearchParams(window.location.search);
    next.delete("highlight");
    setSearchParams(next, { replace: true });
    if (!highlightedExists) {
      setPhase(null);
      setTargetId(null);
      return;
    }

    rowRef.current?.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    setPhase("enter");
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => setPhase("opening"));
    });
    const highlightTimer = setTimeout(() => setPhase("highlight"), MOTION_MS.enter);
    const fadeTimer = setTimeout(
      () => setPhase("fading"),
      MOTION_MS.enter + MOTION_MS.highlightHold,
    );
    const doneTimer = setTimeout(
      () => {
        setPhase(null);
        setTargetId(null);
      },
      MOTION_MS.enter + MOTION_MS.highlightHold + MOTION_MS.highlightFade,
    );
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
      clearTimeout(highlightTimer);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [highlightedExists, itemIds.length, reduceMotion, setSearchParams, targetId]);

  return { phase, register, targetId };
}
