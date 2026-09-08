import { useNavigate } from "react-router";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { GuideSpotlight } from "@/client/components/guide/GuideSpotlight.tsx";
import { PracticeBottleForm } from "@/client/components/guide/PracticeBottleForm.tsx";
import { PracticeLogForm } from "@/client/components/guide/PracticeLogForm.tsx";
import { PracticeNoteForm } from "@/client/components/guide/PracticeNoteForm.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import {
  GUIDE_DONE_STEPS,
  guideDoneCopy,
  isGuidePracticeStep,
} from "@/client/lib/first-run-guide.ts";

export function FirstRunGuideHost() {
  const guide = useFirstRunGuide();
  const navigate = useNavigate();
  const practice = isGuidePracticeStep(guide.step);
  const done = guide.step !== "off" && GUIDE_DONE_STEPS.has(guide.step);
  const copy = guide.step === "off" ? null : guideDoneCopy(guide.step);

  return (
    <>
      <DialogRoot
        open={guide.step === "invite"}
        onOpenChange={(open) => {
          if (!open) {
            guide.skip();
          }
        }}
      >
        <DialogContent className="app-sheet-panel">
          <DialogTitle className="text-[length:var(--text-title)] font-semibold leading-[1.3]">
            使い方を少し試してみますか？
          </DialogTitle>
          <DialogDescription className="visually-hidden">初回ガイドの招待</DialogDescription>
          <Button type="button" onClick={guide.start}>
            操作を試す
          </Button>
          <Button type="button" variant="ghost" onClick={guide.skip}>
            今はしない
          </Button>
        </DialogContent>
      </DialogRoot>

      <GuideSpotlight />

      {practice ? (
        <div className="guide-practice-overlay">
          <header className="guide-practice-header">
            <button
              type="button"
              className="guide-exit"
              onClick={() => {
                if (guide.step === "practice-volume" || guide.step === "practice-save") {
                  guide.backToHomeRecord();
                  return;
                }
                if (guide.step === "cellar-type" || guide.step === "cellar-save") {
                  guide.startTour("cellar");
                  return;
                }
                guide.startTour("notes");
              }}
            >
              戻る
            </button>
            <h1>練習</h1>
            <button type="button" className="guide-exit" onClick={guide.skip}>
              ガイドを終了
            </button>
          </header>
          {guide.step === "practice-volume" || guide.step === "practice-save" ? (
            <PracticeLogForm
              onFieldUsed={guide.advancePracticeField}
              onSaved={guide.finishPractice}
            />
          ) : null}
          {guide.step === "cellar-type" || guide.step === "cellar-save" ? (
            <PracticeBottleForm
              onFieldUsed={guide.advancePracticeField}
              onSaved={guide.finishPractice}
            />
          ) : null}
          {guide.step === "notes-rating" || guide.step === "notes-save" ? (
            <PracticeNoteForm
              onFieldUsed={guide.advancePracticeField}
              onSaved={guide.finishPractice}
            />
          ) : null}
        </div>
      ) : null}

      <DialogRoot
        open={done}
        onOpenChange={(open) => {
          if (!open) {
            guide.finishDone();
          }
        }}
      >
        <DialogContent className="app-sheet-panel">
          <Mascot pose="cheer" size={64} life lifeId="guide-done" reactToken={1} aria-hidden />
          <DialogTitle className="text-[length:var(--text-title)] font-semibold leading-[1.3]">
            {copy?.title ?? "基本の操作はこれだけです"}
          </DialogTitle>
          {copy?.detail ? <p className="form-lead">{copy.detail}</p> : null}
          <DialogDescription className="visually-hidden">ガイドの完了</DialogDescription>
          <Button type="button" onClick={guide.finishDone}>
            ガイドを終了
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              guide.showMoreGuides();
              navigate("/settings");
            }}
          >
            ほかの使い方を見る
          </Button>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
