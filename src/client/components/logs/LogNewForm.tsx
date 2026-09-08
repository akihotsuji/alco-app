import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { AbvField } from "@/client/components/logs/AbvField.tsx";
import {
  BottlePickerRow,
  TargetBottleChip,
  usePrefillBottle,
} from "@/client/components/logs/BottlePickerRow.tsx";
import { DrinkTypeSelect } from "@/client/components/logs/DrinkTypeSelect.tsx";
import { DrunkAtRow } from "@/client/components/logs/DrunkAtRow.tsx";
import { MemoField } from "@/client/components/logs/MemoField.tsx";
import { VolumeField } from "@/client/components/logs/VolumeField.tsx";
import { CompactPhotoField } from "@/client/components/photo/CompactPhotoField.tsx";
import { useCreateDrinkLog } from "@/client/hooks/use-drink-logs.ts";
import { logDayHref } from "@/client/lib/app-routes.ts";
import {
  applyRecognizeToLogForm,
  countDrinkRecognizeFields,
  DRINK_RECOGNIZE_BANNER,
  type DrinkRecognizeTouched,
} from "@/client/lib/drink-recognize.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { drinkLogUndoState, isPhotoHandoff } from "@/client/lib/history-state.ts";
import {
  applyDrinkType,
  applySelectedBottle,
  canSubmitLogForm,
  clearSelectedBottle,
  describeSaveFailure,
  initialLogFormState,
  isLogFormDirty,
  type LogFormErrors,
  type LogFormField,
  logSaveDisabledHint,
  type PhotoSaveStatus,
  saveButtonLabel,
  shouldPreserveBottlePrefill,
  toCreateDrinkLogBody,
  validateLogForm,
  visibleLogFormErrors,
} from "@/client/lib/log-form.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { parseFormOrigin } from "@/client/lib/opened-followup.ts";
import { startDrinkRecognition } from "@/client/lib/recognize-session.ts";
import { DRINK_LOG_MESSAGES } from "@/shared/drink-logs.ts";

const DISCARD_TITLE = "入力を破棄しますか";
const DISCARD_BODY = "入力した内容は保存されません";
const DISCARD_BODY_WITH_PHOTO = "入力した内容は保存されず、写真も削除されます";

/**
 * `log-new`（spec/screen-designs/03-log.md）。種類 → 保存の 2 タップを守り、写真・メモは任意の上乗せ。
 * 撮影は「写真を撮る」「写真を選ぶ」の明示タップだけ。`?camera=1` では起動しない。
 */
export function LogNewForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setGuard } = useLeaveGuard();
  const {
    releaseAttachment,
    editAttachment,
    pendingRecognizeJpeg,
    startCapture,
    attachments,
    retryUpload,
    clearAttachment,
  } = usePhotoEdit();
  const create = useCreateDrinkLog();

  // 「いま」は開いた時点で固定する（N7 の既定値。ユーザーが変えられる）
  const [now] = useState(() => new Date());
  const [initial] = useState(() => initialLogFormState(searchParams.get("date"), now));
  const [state, setState] = useState(initial);
  const queryBottleId = searchParams.get("bottleId");
  const formOrigin = parseFormOrigin(searchParams.get("from"));
  const fromBottle = Boolean(formOrigin && queryBottleId);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<LogFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<LogFormField, boolean>>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const [recognizeStatus, setRecognizeStatus] = useState<"loading" | "success" | null>(null);
  const touchedRef = useRef<DrinkRecognizeTouched>({
    drinkType: false,
    volumeMl: false,
    abvPercent: false,
  });
  const recognizedJpegRef = useRef<Blob | null>(null);
  const recognizeRequestRef = useRef(0);

  const attachment = attachments.log;
  const photoStatus: PhotoSaveStatus = attachment ? attachment.status : "none";
  const errors: LogFormErrors = { ...validateLogForm(state, new Date()), ...serverErrors };
  const visibleErrors = visibleLogFormErrors(errors, { submitted, touched });
  const canSubmit = canSubmitLogForm(state, errors, photoStatus);
  const dirty = isLogFormDirty(state, initial) || attachment !== undefined;

  // 前回開いたときの未紐付け写真が残っていたら破棄する（ブラウザ戻りで確認を通らなかった分）。
  // 中央タブ / ホームのカメラで撮って「使う」した直後（handoff）はその写真が本命なので消さない
  const clearRef = useRef(clearAttachment);
  clearRef.current = clearAttachment;
  const hadStaleAttachment = useRef(attachment !== undefined && !isPhotoHandoff(location.state));
  useEffect(() => {
    if (hadStaleAttachment.current) {
      hadStaleAttachment.current = false;
      void clearRef.current("log");
    }
  }, []);

  // 未保存で戻るときだけ確認を挟む（状態表「戻る（未保存）」）
  useEffect(() => {
    if (!dirty || savedRef.current) {
      setGuard(null);
      return;
    }
    setGuard((proceed) => {
      pendingLeave.current = proceed;
      setDiscardOpen(true);
    });
    return () => setGuard(null);
  }, [dirty, setGuard]);

  usePrefillBottle(
    queryBottleId,
    (bottle) => {
      if (!bottle) {
        return;
      }
      setState((current) => {
        const preserveEdits = !fromBottle || shouldPreserveBottlePrefill(current, initial);
        if (!preserveEdits) {
          touchedRef.current.drinkType = true;
        }
        return applySelectedBottle(current, bottle, { preserveEdits });
      });
    },
    () => setServerErrors({ bottleId: DRINK_LOG_MESSAGES.bottleNotFound }),
  );

  useEffect(() => {
    if (!pendingRecognizeJpeg) {
      return;
    }
    startDrinkRecognition(pendingRecognizeJpeg).catch(() => {});
  }, [pendingRecognizeJpeg]);

  useEffect(() => {
    const jpeg = attachment?.recognizeJpeg ?? pendingRecognizeJpeg;
    if (!jpeg || recognizedJpegRef.current === jpeg) {
      return;
    }
    recognizedJpegRef.current = jpeg;
    const requestId = recognizeRequestRef.current + 1;
    recognizeRequestRef.current = requestId;
    setRecognizeStatus("loading");
    void startDrinkRecognition(jpeg)
      .then((result) => {
        if (requestId !== recognizeRequestRef.current) {
          return;
        }
        if (countDrinkRecognizeFields(result.fields) === 0) {
          setRecognizeStatus(null);
          return;
        }
        setState((current) => {
          const applied = applyRecognizeToLogForm({
            state: current,
            fields: result.fields,
            touched: touchedRef.current,
          });
          return applied.next;
        });
        setRecognizeStatus("success");
      })
      .catch(() => {
        if (requestId !== recognizeRequestRef.current) {
          return;
        }
        setRecognizeStatus(null);
      });
  }, [attachment?.recognizeJpeg, pendingRecognizeJpeg]);

  function update(patch: Partial<typeof state>, field?: LogFormField) {
    if (field) {
      setTouched((current) => ({ ...current, [field]: true }));
    }
    setState((current) => ({ ...current, ...patch }));
    setServerErrors({});
    setFormError(null);
  }

  function submit() {
    setSubmitted(true);
    const body = toCreateDrinkLogBody(state, attachment?.photoId ?? null);
    if (!body || !canSubmit || create.isPending) {
      return;
    }
    setFormError(null);
    setServerErrors({});
    setSaveState("loading");
    create.mutate(body, {
      onSuccess: (log) => {
        savedRef.current = true;
        setGuard(null);
        haptic("success");
        releaseAttachment("log");
        // M-05: 成功表示は置かず即遷移。到着先で行の挿入とトーストが成功を示す
        navigate(`${logDayHref(log.drunkOn)}?highlight=${log.id}`, {
          replace: true,
          state: drinkLogUndoState(log.id),
        });
      },
      onError: (error) => {
        const failure = describeSaveFailure(error, navigator.onLine, {
          hasPhoto: Boolean(attachment?.photoId),
          hasBottle: Boolean(state.bottleId),
        });
        setSaveState("error");
        setFormError(failure.formMessage);
        setServerErrors(failure.fieldErrors);
        if (failure.dropPhoto) {
          releaseAttachment("log");
        }
        if (failure.dropBottle) {
          setState((current) => clearSelectedBottle(current));
        }
      },
    });
  }

  async function discard() {
    setDiscarding(true);
    try {
      await clearAttachment("log");
    } finally {
      setDiscarding(false);
      setDiscardOpen(false);
      setGuard(null);
      savedRef.current = true;
      pendingLeave.current?.();
      pendingLeave.current = null;
    }
  }

  return (
    <div className="form-page log-form">
      <p className="form-lead">飲んだ量を残す</p>
      {fromBottle && state.bottleName ? <TargetBottleChip name={state.bottleName} /> : null}
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <CompactPhotoField
        onCapture={() => void startCapture("log")}
        onLibrary={() => void startCapture("log", { source: "library" })}
        attachment={attachment}
        onEdit={() => void editAttachment("log")}
        onRetry={() => void retryUpload("log")}
        onClear={() => {
          recognizedJpegRef.current = null;
          setRecognizeStatus(null);
          void clearAttachment("log");
        }}
        error={visibleErrors.photoIds}
        recognizeStatus={recognizeStatus}
        recognizeMessage={recognizeStatus ? DRINK_RECOGNIZE_BANNER[recognizeStatus] : undefined}
      />
      <DrinkTypeSelect
        value={state.drinkType}
        onChange={(drinkType) => {
          touchedRef.current.drinkType = true;
          touchedRef.current.volumeMl = true;
          touchedRef.current.abvPercent = true;
          setState((current) => applyDrinkType(current, drinkType));
          setServerErrors({});
          setFormError(null);
        }}
      />
      <VolumeField
        key={`volume-${state.drinkType}`}
        drinkType={state.drinkType}
        value={state.volumeMl}
        error={visibleErrors.volumeMl}
        onChange={(volumeMl) => {
          touchedRef.current.volumeMl = true;
          update({ volumeMl }, "volumeMl");
        }}
      />
      <AbvField
        key={`abv-${state.drinkType}`}
        value={state.abvPercent}
        volumeMl={state.volumeMl}
        error={visibleErrors.abvPercent}
        onChange={(abvPercent) => {
          touchedRef.current.abvPercent = true;
          update({ abvPercent }, "abvPercent");
        }}
      />
      <DrunkAtRow
        value={state.drunkAt}
        now={now}
        error={visibleErrors.drunkAt}
        onChange={(drunkAt) => update({ drunkAt }, "drunkAt")}
      />
      <MemoField
        value={state.memo}
        error={visibleErrors.memo}
        onChange={(memo) => update({ memo }, "memo")}
      />
      <BottlePickerRow
        placement="optional"
        bottleId={state.bottleId}
        bottleName={state.bottleName}
        error={visibleErrors.bottleId}
        onSelect={(bottle) => {
          setState((current) =>
            bottle
              ? applySelectedBottle(current, bottle, { preserveEdits: true })
              : clearSelectedBottle(current),
          );
          setServerErrors({});
          setFormError(null);
        }}
      />
      <SaveBar
        label={saveButtonLabel(false, photoStatus)}
        pending={create.isPending}
        disabled={!canSubmit}
        hint={!canSubmit ? logSaveDisabledHint(state, errors, photoStatus) : null}
        state={create.isPending ? "loading" : saveState}
        onSave={submit}
      />
      <Dialog
        open={discardOpen}
        title={DISCARD_TITLE}
        body={attachment ? DISCARD_BODY_WITH_PHOTO : DISCARD_BODY}
        primaryLabel="破棄する"
        destructive
        pending={discarding}
        onPrimary={() => void discard()}
        onClose={() => {
          setDiscardOpen(false);
          pendingLeave.current = null;
        }}
      />
    </div>
  );
}
