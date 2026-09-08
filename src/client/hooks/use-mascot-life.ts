import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import {
  claimMascotLife,
  idleBlinkDelayMs,
  initialMascotLifeState,
  mascotActionDuration,
  type MascotLifeState,
  releaseMascotLife,
  startMascotTap,
} from "@/client/lib/mascot-life.ts";
import type { MascotPresence } from "@/client/lib/mascot-presence.ts";

type UseMascotLifeInput = {
  id: string;
  enabled: boolean;
  pose: "default" | "surprised" | "rest" | "cheer";
  presence: MascotPresence;
  gazeOnMount?: boolean;
  reactToken?: number;
};

export function useMascotLife({
  id,
  enabled,
  pose,
  presence,
  gazeOnMount = true,
  reactToken = 0,
}: UseMascotLifeInput) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [claimed, setClaimed] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  const [life, setLife] = useState<MascotLifeState>(initialMascotLifeState);
  const [heavyEnter, setHeavyEnter] = useState(false);
  const playedHeavy = useRef(false);
  const playedGaze = useRef(false);
  const lastReact = useRef(0);

  const canAnimate =
    enabled && claimed && inView && pageVisible && !reduceMotion && pose !== "rest";

  useEffect(() => {
    if (!enabled || reduceMotion) {
      releaseMascotLife(id);
      setClaimed(false);
      return;
    }
    setClaimed(claimMascotLife(id));
    return () => releaseMascotLife(id);
  }, [enabled, id, reduceMotion]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver !== "function") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting === true);
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      setPageVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!canAnimate) {
      setLife((current) => ({ ...current, action: null }));
      return;
    }
    if (gazeOnMount && !playedGaze.current) {
      playedGaze.current = true;
      setLife((current) => ({ ...current, action: "gaze", gaze: "target" }));
      const toUser = window.setTimeout(() => {
        setLife((current) => ({ ...current, action: null, gaze: "user" }));
      }, mascotActionDuration("gaze"));
      return () => window.clearTimeout(toUser);
    }
  }, [canAnimate, gazeOnMount]);

  useEffect(() => {
    if (!canAnimate || life.action !== null) {
      return;
    }
    const delay = idleBlinkDelayMs();
    const timer = window.setTimeout(() => {
      setLife((current) => ({ ...current, action: "blink" }));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [canAnimate, life.action]);

  useEffect(() => {
    if (!life.action) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLife((current) => ({ ...current, action: null }));
    }, mascotActionDuration(life.action));
    return () => window.clearTimeout(timer);
  }, [life.action]);

  useEffect(() => {
    if (!canAnimate || reactToken === 0 || reactToken === lastReact.current) {
      return;
    }
    lastReact.current = reactToken;
    setLife((current) => ({ ...current, action: "react", gaze: "user" }));
  }, [canAnimate, reactToken]);

  useEffect(() => {
    if (presence !== "heavy" || playedHeavy.current) {
      return;
    }
    playedHeavy.current = true;
    if (!reduceMotion) {
      setHeavyEnter(true);
      const timer = window.setTimeout(() => setHeavyEnter(false), mascotActionDuration("react"));
      return () => window.clearTimeout(timer);
    }
  }, [presence, reduceMotion]);

  function onTap() {
    if (!canAnimate) {
      return;
    }
    setLife((current) => startMascotTap(current, Date.now()) ?? current);
  }

  return { rootRef, life, heavyEnter, canAnimate, onTap };
}
