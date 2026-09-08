import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { useMe } from "@/client/hooks/use-me.ts";
import {
  GUIDE_DONE_STEPS,
  type GuideRecord,
  type GuideStep,
  type GuideTour,
  guideStartStep,
  guideTourOf,
  guideTourPath,
  isGuidePracticeStep,
  markGuideHintSeen,
  markGuideStatus,
  nextGuideStep,
  peekStoredGuideRecord,
  readGuideRecord,
  resolveInitialGuide,
  writeGuideRecord,
} from "@/client/lib/first-run-guide.ts";
import type { GuideStatus } from "@/shared/constants.ts";

type FirstRunGuideValue = {
  step: GuideStep | "off";
  status: GuideStatus;
  record: GuideRecord | null;
  pickerOpen: boolean;
  hideHomeMascotLife: boolean;
  interceptRecord: boolean;
  interceptCellarAdd: boolean;
  interceptNotesCreate: boolean;
  cellarHintSeen: boolean;
  notesHintSeen: boolean;
  start: () => void;
  startTour: (tour: GuideTour) => void;
  skip: () => void;
  onHomeRecordAction: () => void;
  onCellarAdd: () => void;
  onNotesCreate: () => void;
  advancePracticeField: () => void;
  backToHomeRecord: () => void;
  finishPractice: () => void;
  finishDone: () => void;
  openPicker: () => void;
  closePicker: () => void;
  showMoreGuides: () => void;
  replay: () => void;
  markHintSeen: (hint: "cellarHintSeen" | "notesHintSeen") => void;
  applyActivity: (hasExistingData: boolean) => void;
};

const FirstRunGuideContext = createContext<FirstRunGuideValue | null>(null);

function advanceFrom(step: GuideStep | "off"): GuideStep | "off" {
  if (step === "off") {
    return "off";
  }
  return nextGuideStep(step, "continue") ?? "off";
}

export function FirstRunGuideProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = me.data?.id ?? null;
  const [record, setRecord] = useState<GuideRecord | null>(() => peekStoredGuideRecord());
  const [step, setStep] = useState<GuideStep | "off">("off");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const stored = readGuideRecord(userId);
    setRecord(stored);
    if (stored.status !== "unset") {
      setBootstrapped(true);
    }
  }, [userId]);

  const persist = useCallback((next: GuideRecord) => {
    writeGuideRecord(next);
    setRecord(next);
  }, []);

  const applyActivity = useCallback(
    (hasExistingData: boolean) => {
      if (!userId || bootstrapped) {
        return;
      }
      const stored = record ?? readGuideRecord(userId);
      const launch = resolveInitialGuide({
        stored: stored.status,
        hasExistingData,
        replayRequested: false,
      });
      if (launch.status === "existing" && stored.status === "unset") {
        persist({ ...stored, userId, status: "existing" });
      }
      setStep(launch.step);
      setBootstrapped(true);
    },
    [bootstrapped, persist, record, userId],
  );

  const start = useCallback(() => {
    setStep("home-record");
  }, []);

  const startTour = useCallback(
    (tour: GuideTour) => {
      setPickerOpen(false);
      setBootstrapped(true);
      setStep(guideStartStep(tour));
      navigate(guideTourPath(tour));
    },
    [navigate],
  );

  useEffect(() => {
    if (step === "off" || step === "invite") {
      return;
    }
    const tour = guideTourOf(step);
    if (!tour) {
      return;
    }
    if (isGuidePracticeStep(step) || GUIDE_DONE_STEPS.has(step)) {
      return;
    }
    const expected = guideTourPath(tour);
    if (location.pathname !== expected) {
      navigate(expected, { replace: true });
    }
  }, [location.pathname, navigate, step]);

  const skip = useCallback(() => {
    if (userId) {
      persist(markGuideStatus(userId, "skipped"));
    }
    setPickerOpen(false);
    setStep("off");
  }, [persist, userId]);

  const onHomeRecordAction = useCallback(() => {
    setStep("practice-volume");
  }, []);

  const onCellarAdd = useCallback(() => {
    setStep("cellar-type");
  }, []);

  const onNotesCreate = useCallback(() => {
    setStep("notes-rating");
  }, []);

  const advancePracticeField = useCallback(() => {
    setStep((current) => {
      if (
        current === "practice-volume" ||
        current === "cellar-type" ||
        current === "notes-rating"
      ) {
        return advanceFrom(current);
      }
      return current;
    });
  }, []);

  const backToHomeRecord = useCallback(() => {
    setStep("home-record");
  }, []);

  const finishPractice = useCallback(() => {
    setStep((current) => {
      if (current === "off") {
        return "off";
      }
      if (GUIDE_DONE_STEPS.has(current)) {
        return current;
      }
      const next = nextGuideStep(current, "continue");
      if (next && GUIDE_DONE_STEPS.has(next)) {
        return next;
      }
      if (current === "practice-volume") {
        return "done";
      }
      if (current === "cellar-type") {
        return "cellar-done";
      }
      if (current === "notes-rating") {
        return "notes-done";
      }
      return next ?? "off";
    });
  }, []);

  const finishDone = useCallback(() => {
    if (userId) {
      persist(markGuideStatus(userId, "completed"));
    }
    setStep("off");
  }, [persist, userId]);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const showMoreGuides = useCallback(() => {
    if (userId) {
      persist(markGuideStatus(userId, "completed"));
    }
    setStep("off");
    setPickerOpen(true);
  }, [persist, userId]);

  const replay = useCallback(() => {
    setBootstrapped(true);
    setPickerOpen(true);
    setStep("off");
  }, []);

  const markHint = useCallback(
    (hint: "cellarHintSeen" | "notesHintSeen") => {
      if (!userId) {
        return;
      }
      persist(markGuideHintSeen(userId, hint));
    },
    [persist, userId],
  );

  const value = useMemo<FirstRunGuideValue>(
    () => ({
      step,
      status: record?.status ?? "unset",
      record,
      pickerOpen,
      hideHomeMascotLife:
        step !== "off" &&
        (step === "home-record" ||
          step === "cellar-add" ||
          step === "notes-create" ||
          GUIDE_DONE_STEPS.has(step) ||
          isGuidePracticeStep(step)),
      interceptRecord:
        step === "home-record" ||
        step === "practice-volume" ||
        step === "practice-save" ||
        step === "invite",
      interceptCellarAdd: step === "cellar-add",
      interceptNotesCreate: step === "notes-create",
      cellarHintSeen: record?.cellarHintSeen === true,
      notesHintSeen: record?.notesHintSeen === true,
      start,
      startTour,
      skip,
      onHomeRecordAction,
      onCellarAdd,
      onNotesCreate,
      advancePracticeField,
      backToHomeRecord,
      finishPractice,
      finishDone,
      openPicker,
      closePicker,
      showMoreGuides,
      replay,
      markHintSeen: markHint,
      applyActivity,
    }),
    [
      advancePracticeField,
      applyActivity,
      backToHomeRecord,
      finishDone,
      finishPractice,
      markHint,
      onCellarAdd,
      onHomeRecordAction,
      onNotesCreate,
      openPicker,
      closePicker,
      pickerOpen,
      record,
      replay,
      showMoreGuides,
      skip,
      start,
      startTour,
      step,
    ],
  );

  return <FirstRunGuideContext.Provider value={value}>{children}</FirstRunGuideContext.Provider>;
}

const FALLBACK: FirstRunGuideValue = {
  step: "off",
  status: "unset",
  record: null,
  pickerOpen: false,
  hideHomeMascotLife: false,
  interceptRecord: false,
  interceptCellarAdd: false,
  interceptNotesCreate: false,
  cellarHintSeen: true,
  notesHintSeen: true,
  start: () => {},
  startTour: () => {},
  skip: () => {},
  onHomeRecordAction: () => {},
  onCellarAdd: () => {},
  onNotesCreate: () => {},
  advancePracticeField: () => {},
  backToHomeRecord: () => {},
  finishPractice: () => {},
  finishDone: () => {},
  openPicker: () => {},
  closePicker: () => {},
  showMoreGuides: () => {},
  replay: () => {},
  markHintSeen: () => {},
  applyActivity: () => {},
};

export function useFirstRunGuide(): FirstRunGuideValue {
  return useContext(FirstRunGuideContext) ?? FALLBACK;
}
