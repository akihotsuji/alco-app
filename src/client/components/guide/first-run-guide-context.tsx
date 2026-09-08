import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMe } from "@/client/hooks/use-me.ts";
import {
  type GuideRecord,
  type GuideStep,
  markGuideHintSeen,
  markGuideStatus,
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
  hideHomeMascotLife: boolean;
  interceptRecord: boolean;
  cellarHintSeen: boolean;
  notesHintSeen: boolean;
  start: () => void;
  skip: () => void;
  onHomeRecordAction: () => void;
  backToHomeRecord: () => void;
  finishPractice: () => void;
  finishDone: () => void;
  replay: () => void;
  markHintSeen: (hint: "cellarHintSeen" | "notesHintSeen") => void;
  applyActivity: (hasExistingData: boolean) => void;
};

const FirstRunGuideContext = createContext<FirstRunGuideValue | null>(null);

export function FirstRunGuideProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const userId = me.data?.id ?? null;
  const [record, setRecord] = useState<GuideRecord | null>(() => peekStoredGuideRecord());
  const [step, setStep] = useState<GuideStep | "off">("off");
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

  const persist = useCallback(
    (next: GuideRecord) => {
      writeGuideRecord(next);
      setRecord(next);
    },
    [],
  );

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

  const skip = useCallback(() => {
    if (userId) {
      persist(markGuideStatus(userId, "skipped"));
    }
    setStep("off");
  }, [persist, userId]);

  const onHomeRecordAction = useCallback(() => {
    setStep("practice");
  }, []);

  const backToHomeRecord = useCallback(() => {
    setStep("home-record");
  }, []);

  const finishPractice = useCallback(() => {
    setStep("done");
  }, []);

  const finishDone = useCallback(() => {
    if (userId) {
      persist(markGuideStatus(userId, "completed"));
    }
    setStep("off");
  }, [persist, userId]);

  const replay = useCallback(() => {
    setBootstrapped(true);
    setStep("home-record");
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
      hideHomeMascotLife: step === "home-record" || step === "done" || step === "practice",
      interceptRecord: step === "home-record" || step === "practice" || step === "invite",
      cellarHintSeen: record?.cellarHintSeen === true,
      notesHintSeen: record?.notesHintSeen === true,
      start,
      skip,
      onHomeRecordAction,
      backToHomeRecord,
      finishPractice,
      finishDone,
      replay,
      markHintSeen: markHint,
      applyActivity,
    }),
    [
      applyActivity,
      backToHomeRecord,
      finishDone,
      finishPractice,
      markHint,
      onHomeRecordAction,
      record,
      replay,
      skip,
      start,
      step,
    ],
  );

  return <FirstRunGuideContext.Provider value={value}>{children}</FirstRunGuideContext.Provider>;
}

export function useFirstRunGuide(): FirstRunGuideValue {
  const value = useContext(FirstRunGuideContext);
  if (!value) {
    return {
      step: "off",
      status: "unset",
      record: null,
      hideHomeMascotLife: false,
      interceptRecord: false,
      cellarHintSeen: true,
      notesHintSeen: true,
      start: () => {},
      skip: () => {},
      onHomeRecordAction: () => {},
      backToHomeRecord: () => {},
      finishPractice: () => {},
      finishDone: () => {},
      replay: () => {},
      markHintSeen: () => {},
      applyActivity: () => {},
    };
  }
  return value;
}
