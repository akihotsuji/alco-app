import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";

/** ホーム H8 の直下。固定帯にしてマイドリンクと重ねない */
export function GuideHomeBanner() {
  const guide = useFirstRunGuide();
  if (guide.step !== "home-record") {
    return null;
  }

  return (
    <div className="guide-home-banner">
      <Mascot pose="default" size={48} life lifeId="guide-home" aria-hidden />
      <div className="guide-home-copy">
        <p>飲んだ量は、ここから残せます</p>
        <button type="button" className="guide-exit" onClick={guide.skip}>
          ガイドを終了
        </button>
      </div>
    </div>
  );
}
