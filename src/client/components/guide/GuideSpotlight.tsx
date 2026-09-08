import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import {
  guideSpotlight,
  guideStepProgress,
  isGuidePracticeStep,
} from "@/client/lib/first-run-guide.ts";

const HOLE_PAD = 8;
const TIP_HEIGHT = 128;

type Hole = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function measureTarget(selector: string): Hole | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) {
    return null;
  }
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top - HOLE_PAD,
    left: rect.left - HOLE_PAD,
    width: rect.width + HOLE_PAD * 2,
    height: rect.height + HOLE_PAD * 2,
  };
}

function tipLayout(hole: Hole): { top: number; left: number; placement: "above" | "below" } {
  const width = Math.min(320, window.innerWidth - 32);
  const spaceBelow = window.innerHeight - (hole.top + hole.height);
  const placement = spaceBelow < TIP_HEIGHT + 16 ? "above" : "below";
  const top =
    placement === "above" ? Math.max(16, hole.top - TIP_HEIGHT - 12) : hole.top + hole.height + 12;
  const preferRight = hole.left > window.innerWidth / 2;
  const left = preferRight
    ? Math.max(16, Math.min(hole.left + hole.width - width, window.innerWidth - 16 - width))
    : Math.max(16, Math.min(hole.left, window.innerWidth - 16 - width));
  return { top, left, placement };
}

/** 対象だけを切り抜き、吹き出しで次の操作を示す */
export function GuideSpotlight() {
  const guide = useFirstRunGuide();
  const location = useLocation();
  const config = guide.step === "off" ? null : guideSpotlight(guide.step);
  const progress = guide.step === "off" ? null : guideStepProgress(guide.step);
  const target = config?.target ?? null;
  const remasureKey = `${guide.step}:${location.pathname}:${location.search}`;
  const [hole, setHole] = useState<Hole | null>(null);

  useEffect(() => {
    if (!target) {
      setHole(null);
      return;
    }
    void remasureKey;
    let cancelled = false;
    let attempts = 0;
    let frame = 0;
    const update = () => {
      if (cancelled) {
        return;
      }
      const next = measureTarget(target);
      setHole(next);
      if (!next && attempts < 12) {
        attempts += 1;
        frame = window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target, remasureKey]);

  if (!config) {
    return null;
  }

  const tip = hole ? tipLayout(hole) : { top: 120, left: 16, placement: "below" as const };

  return (
    <div
      className="guide-spotlight"
      data-practice={isGuidePracticeStep(guide.step) ? "1" : undefined}
    >
      {hole ? (
        <>
          <div
            className="guide-spotlight-panel"
            style={{ top: 0, left: 0, right: 0, height: hole.top }}
          />
          <div
            className="guide-spotlight-panel"
            style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="guide-spotlight-panel"
            style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }}
          />
          <div
            className="guide-spotlight-panel"
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
          />
          <div
            className="guide-spotlight-ring"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        </>
      ) : (
        <div className="guide-spotlight-panel" style={{ inset: 0 }} />
      )}
      <div
        className="guide-spotlight-tip"
        data-placement={tip.placement}
        role="status"
        style={{ top: tip.top, left: tip.left }}
      >
        <Mascot pose="default" size={48} life lifeId="guide-spot" aria-hidden />
        <div className="guide-spotlight-copy">
          <p>{config.message}</p>
          <div className="guide-spotlight-meta">
            {progress ? (
              <span>
                {progress.current} / {progress.total}
              </span>
            ) : null}
            <button type="button" className="guide-exit" onClick={guide.skip}>
              ガイドを終了
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
