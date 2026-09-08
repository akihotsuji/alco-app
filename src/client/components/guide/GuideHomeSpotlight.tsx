import { useEffect, useState } from "react";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { guideStepProgress } from "@/client/lib/first-run-guide.ts";

const TARGET = '[data-guide-target="record"]';
const HOLE_PAD = 8;

type Hole = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function measureTarget(): Hole | null {
  const el = document.querySelector<HTMLElement>(TARGET);
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

/** `guide-home-record`。画面を暗くし H8 だけを枠で示す */
export function GuideHomeSpotlight() {
  const guide = useFirstRunGuide();
  const [hole, setHole] = useState<Hole | null>(null);
  const progress = guideStepProgress("home-record");

  useEffect(() => {
    if (guide.step !== "home-record") {
      setHole(null);
      return;
    }
    const update = () => setHole(measureTarget());
    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [guide.step]);

  if (guide.step !== "home-record") {
    return null;
  }

  const tipTop = hole ? hole.top + hole.height + 12 : 120;
  const tipLeft = hole ? Math.max(16, Math.min(hole.left, window.innerWidth - 32 - 280)) : 16;

  return (
    <div className="guide-spotlight">
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
        </>
      ) : (
        <div className="guide-spotlight-panel" style={{ inset: 0 }} />
      )}
      <div className="guide-spotlight-tip" role="status" style={{ top: tipTop, left: tipLeft }}>
        <Mascot pose="default" size={48} life lifeId="guide-home" aria-hidden />
        <div className="guide-spotlight-copy">
          <p>飲んだ量は、ここから残せます</p>
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
