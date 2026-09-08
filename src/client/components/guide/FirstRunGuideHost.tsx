import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { PracticeLogForm } from "@/client/components/guide/PracticeLogForm.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";

export function FirstRunGuideHost() {
  const guide = useFirstRunGuide();

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

      {guide.step === "home-record" ? (
        <div className="guide-home-banner">
          <Mascot pose="default" size={48} life lifeId="guide-home" aria-hidden />
          <div className="guide-home-copy">
            <p>飲んだ量は、ここから残せます</p>
            <button type="button" className="guide-exit" onClick={guide.skip}>
              ガイドを終了
            </button>
          </div>
        </div>
      ) : null}

      {guide.step === "practice" ? (
        <div className="guide-practice-overlay">
          <header className="guide-practice-header">
            <button type="button" className="guide-exit" onClick={guide.backToHomeRecord}>
              戻る
            </button>
            <h1>練習</h1>
            <button type="button" className="guide-exit" onClick={guide.skip}>
              ガイドを終了
            </button>
          </header>
          <PracticeLogForm onSaved={guide.finishPractice} />
        </div>
      ) : null}

      <DialogRoot
        open={guide.step === "done"}
        onOpenChange={(open) => {
          if (!open) {
            guide.finishDone();
          }
        }}
      >
        <DialogContent className="app-sheet-panel">
          <Mascot pose="cheer" size={64} life lifeId="guide-done" reactToken={1} aria-hidden />
          <DialogTitle className="text-[length:var(--text-title)] font-semibold leading-[1.3]">
            基本の操作はこれだけです
          </DialogTitle>
          <DialogDescription className="visually-hidden">初回ガイドの完了</DialogDescription>
          <Button type="button" onClick={guide.finishDone}>
            ガイドを終了
          </Button>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
