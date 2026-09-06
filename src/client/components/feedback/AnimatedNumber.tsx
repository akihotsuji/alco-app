import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  className?: string;
};

export function interpolateNumber(from: number, to: number, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return from + (to - from) * (1 - (1 - clamped) ** 3);
}

export function useAnimatedNumber(value: number | undefined): number | undefined {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    if (value === undefined) {
      shownRef.current = undefined;
      setShown(undefined);
      return;
    }
    if (reduceMotion || shownRef.current === undefined || shownRef.current === value) {
      shownRef.current = value;
      setShown(value);
      return;
    }

    const from = shownRef.current;
    let frame = 0;
    const startedAt = performance.now();
    const draw = (now: number) => {
      const next = interpolateNumber(from, value, (now - startedAt) / MOTION_MS.state);
      shownRef.current = next;
      setShown(next);
      if (now - startedAt < MOTION_MS.state) {
        frame = requestAnimationFrame(draw);
      } else {
        shownRef.current = value;
        setShown(value);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, value]);

  return shown;
}

export function AnimatedNumber({ value, decimals = 0, className }: AnimatedNumberProps) {
  const shown = useAnimatedNumber(value) ?? value;
  return (
    <span className={className} aria-live="polite">
      {shown.toFixed(decimals)}
    </span>
  );
}
