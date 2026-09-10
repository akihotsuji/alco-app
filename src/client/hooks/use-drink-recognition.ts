import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { lookupDrinkProduct } from "@/client/hooks/use-drink-logs.ts";
import {
  applyRecognizeToLogForm,
  DRINK_LOOKUP_FIELDS,
  type DrinkRecognizeStatus,
  type DrinkRecognizeTouched,
  pendingDrinkRecognizeFields,
} from "@/client/lib/drink-recognize.ts";
import { runDrinkRecognizeFlow } from "@/client/lib/drink-recognize-flow.ts";
import type { LogFormState } from "@/client/lib/log-form.ts";
import { startDrinkRecognition } from "@/client/lib/recognize-session.ts";
import type { DrinkRecognizeFields } from "@/shared/drink-recognize.ts";

const EMPTY_PENDING: ReadonlySet<string> = new Set();

type UseDrinkPhotoRecognitionInput = {
  /** 読み取り用 JPEG。変わるたびに（同じ Blob なら 1 回だけ）読み取りを始める */
  jpeg: Blob | null;
  state: LogFormState;
  setState: Dispatch<SetStateAction<LogFormState>>;
  touchedRef: { current: DrinkRecognizeTouched };
  aiMarks: Set<string>;
  setAiMarks: Dispatch<SetStateAction<Set<string>>>;
  /** 保存・破棄後は結果を反映しない */
  savedRef: { current: boolean };
};

export type DrinkPhotoRecognition = {
  status: DrinkRecognizeStatus | null;
  appliedCount: number;
  /** 自動入力できない生産国の候補（N8b「写真からの候補」） */
  originCandidate: string | null;
  /** 「読み取り中」ピルを出す識別欄。照合中は生産国・品種だけ */
  aiPending: ReadonlySet<string>;
  typeAiPending: boolean;
  /** 写真の削除・撮り直し。進行中の結果を捨てて状態行を消す */
  reset: () => void;
};

/**
 * 記録フォーム（新規・編集）で共有する二段階の読み取り（03-log.md N2）。
 * 反映は `setState` の updater で行い、入力中の値を潰さない。件数は直前の描画値から数える。
 */
export function useDrinkPhotoRecognition({
  jpeg,
  state,
  setState,
  touchedRef,
  aiMarks,
  setAiMarks,
  savedRef,
}: UseDrinkPhotoRecognitionInput): DrinkPhotoRecognition {
  const [status, setStatus] = useState<DrinkRecognizeStatus | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const [originCandidate, setOriginCandidate] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const aiMarksRef = useRef<ReadonlySet<string>>(aiMarks);
  aiMarksRef.current = aiMarks;
  const recognizedJpegRef = useRef<Blob | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!jpeg || recognizedJpegRef.current === jpeg) {
      return;
    }
    recognizedJpegRef.current = jpeg;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const isStale = () => requestId !== requestRef.current || savedRef.current;

    const apply = (fields: DrinkRecognizeFields): number => {
      const touched = touchedRef.current;
      const priorMarks = aiMarksRef.current;
      const preview = applyRecognizeToLogForm({
        state: stateRef.current,
        fields,
        touched,
        marks: priorMarks,
      });
      stateRef.current = preview.next;
      aiMarksRef.current = preview.marks;
      setAiMarks(preview.marks);
      setState(
        (current) =>
          applyRecognizeToLogForm({ state: current, fields, touched, marks: priorMarks }).next,
      );
      return preview.applied.length;
    };

    void runDrinkRecognizeFlow(jpeg, {
      recognize: startDrinkRecognition,
      lookup: lookupDrinkProduct,
      snapshot: () => ({ state: stateRef.current, marks: aiMarksRef.current }),
      touched: touchedRef.current,
      isStale,
      apply,
      onStatus: (next, count) => {
        if (isStale()) {
          return;
        }
        setStatus(next);
        setAppliedCount(count);
      },
      onOriginCandidate: (value) => {
        if (!isStale()) {
          setOriginCandidate(value);
        }
      },
    });
  }, [jpeg, savedRef, setAiMarks, setState, touchedRef]);

  useEffect(() => {
    return () => {
      requestRef.current += 1;
    };
  }, []);

  const reset = useCallback(() => {
    requestRef.current += 1;
    recognizedJpegRef.current = null;
    setStatus(null);
    setAppliedCount(0);
    setOriginCandidate(null);
  }, []);

  const touched = touchedRef.current;
  const aiPending =
    status === "loading" || status === "lookup"
      ? pendingDrinkRecognizeFields(
          state,
          touched,
          aiMarks,
          status === "lookup" ? DRINK_LOOKUP_FIELDS : undefined,
        )
      : EMPTY_PENDING;
  const typeAiPending = status === "loading" && !touched.drinkType && !state.bottleId;

  return { status, appliedCount, originCandidate, aiPending, typeAiPending, reset };
}
