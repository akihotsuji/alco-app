import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import {
  guideSpotlight,
  guideSpotlightPath,
  guideStepProgress,
  isGuidePracticeStep,
} from "@/client/lib/first-run-guide.ts";
import {
  type GuideHole,
  type GuideTipLayout,
  guideTipLayout,
  measureGuideTarget,
} from "@/client/lib/guide-spotlight-layout.ts";

const TIP_FALLBACK = { width: 320, height: 128 };

/** 対象だけを切り抜き、吹き出しで次の操作を示す */
export function GuideSpotlight() {
  const guide = useFirstRunGuide();
  const location = useLocation();
  const config = guide.step === "off" ? null : guideSpotlight(guide.step);
  const progress = guide.step === "off" ? null : guideStepProgress(guide.step);
  const listPath = guide.step === "off" ? null : guideSpotlightPath(guide.step);
  const onExpectedPath = listPath === null || location.pathname === listPath;
  const target = config && onExpectedPath ? config.target : null;
  const remasureKey = `${guide.step}:${location.pathname}:${location.search}`;
  const [hole, setHole] = useState<GuideHole | null>(null);
  const [tipBox, setTipBox] = useState(TIP_FALLBACK);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target) {
      setHole(null);
      return;
    }
    void remasureKey;
    let cancelled = false;
    const update = () => {
      if (cancelled) {
        return;
      }
      setHole(measureGuideTarget(target));
    };
    update();
    const frame = window.requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-guide-target", "class", "style"],
    });
    const resize = new ResizeObserver(update);
    resize.observe(document.documentElement);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target, remasureKey]);

  const tip: GuideTipLayout | null = hole
    ? guideTipLayout(hole, { width: window.innerWidth, height: window.innerHeight }, tipBox)
    : null;

  useLayoutEffect(() => {
    void remasureKey;
    const node = tipRef.current;
    if (!node || !hole) {
      return;
    }
    const next = { width: node.offsetWidth, height: node.offsetHeight };
    setTipBox((current) =>
      current.width === next.width && current.height === next.height ? current : next,
    );
    const layout = guideTipLayout(
      hole,
      { width: window.innerWidth, height: window.innerHeight },
      next,
    );
    node.style.setProperty("--guide-tip-arrow-x", `${layout.arrowLeft}px`);
  }, [hole, remasureKey]);

  if (!config || !onExpectedPath || !hole || !tip) {
    return null;
  }

  return (
    <div
      className="guide-spotlight"
      data-practice={isGuidePracticeStep(guide.step) ? "1" : undefined}
    >
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
          borderRadius: hole.radius,
        }}
      />
      <div
        ref={tipRef}
        className="guide-spotlight-tip"
        data-placement={tip.placement}
        role="status"
        style={{ top: tip.top, left: tip.left, width: tip.width }}
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
