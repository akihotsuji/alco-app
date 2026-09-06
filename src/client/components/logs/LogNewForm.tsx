import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { AbvField } from "@/client/components/logs/AbvField.tsx";
import { BottlePickerRow, usePrefillBottle } from "@/client/components/logs/BottlePickerRow.tsx";
import { DrinkTypeChips } from "@/client/components/logs/DrinkTypeChips.tsx";
import { DrunkAtRow } from "@/client/components/logs/DrunkAtRow.tsx";
import { MemoField } from "@/client/components/logs/MemoField.tsx";
import { VolumeField } from "@/client/components/logs/VolumeField.tsx";
import { PhotoTile } from "@/client/components/photo/PhotoTile.tsx";
import { useCaptureOnCameraQuery } from "@/client/hooks/use-capture-on-camera-query.ts";
import { useCreateDrinkLog } from "@/client/hooks/use-drink-logs.ts";
import { logDayHref } from "@/client/lib/app-routes.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { drinkLogUndoState, isPhotoHandoff } from "@/client/lib/history-state.ts";
import {
  applyDrinkType,
  applySelectedBottle,
  canSubmitLogForm,
  clearSelectedBottle,
  describeSaveFailure,
  formatGrams,
  initialLogFormState,
  isLogFormDirty,
  type LogFormErrors,
  liveAlcoholGrams,
  type PhotoSaveStatus,
  saveButtonLabel,
  toCreateDrinkLogBody,
  validateLogForm,
} from "@/client/lib/log-form.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { DRINK_LOG_MESSAGES } from "@/shared/drink-logs.ts";

const DISCARD_TITLE = "入力を破棄しますか";
const DISCARD_BODY = "入力した内容は保存されません";
const DISCARD_BODY_WITH_PHOTO = "入力した内容は保存されず、写真も削除されます";

/**
 * `log-new`（spec/screen-designs/03-log.md）。種類 → 保存の 2 タップを守り、写真・メモは任意の上乗せ。
 * ボトル行（N8）は 4-02 で有効（spec/features/drink-log.md 3.8）。
 */
export function LogNewForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setGuard } = useLeaveGuard();
  const { releaseAttachment, editAttachment } = usePhotoEdit();
  const { startCapture, attachments, retryUpload, clearAttachment } = useCaptureOnCameraQuery(
    "log",
    true,
  );
  const create = useCreateDrinkLog();

  // 「いま」は開いた時点で固定する（N7 の既定値。ユーザーが変えられる）
  const [now] = useState(() => new Date());
  const [initial] = useState(() => initialLogFormState(searchParams.get("date"), now));
  const [state, setState] = useState(initial);
  const queryBottleId = searchParams.get("bottleId");
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<LogFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);

  const attachment = attachments.log;
  const photoStatus: PhotoSaveStatus = attachment ? attachment.status : "none";
  const errors: LogFormErrors = { ...validateLogForm(state, new Date()), ...serverErrors };
  const canSubmit = canSubmitLogForm(state, errors, photoStatus);
  const dirty = isLogFormDirty(state, initial) || attachment !== undefined;
  const grams = liveAlcoholGrams(state);

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
      setState((current) => applySelectedBottle(current, bottle));
    },
    () => setServerErrors({ bottleId: DRINK_LOG_MESSAGES.bottleNotFound }),
  );

  function update(patch: Partial<typeof state>) {
    setState((current) => ({ ...current, ...patch }));
    setServerErrors({});
    setFormError(null);
  }

  function submit() {
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
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <PhotoTile
        onClick={() => void startCapture("log")}
        attachment={attachment}
        onEdit={() => void editAttachment("log")}
        onRetry={() => void retryUpload("log")}
        onClear={() => void clearAttachment("log")}
        error={attachment ? errors.photoIds : undefined}
      />
      {!attachment && errors.photoIds ? (
        <p className="field-error" role="alert">
          {errors.photoIds}
        </p>
      ) : null}
      <DrinkTypeChips
        value={state.drinkType}
        onChange={(drinkType) => {
          setState((current) => applyDrinkType(current, drinkType));
          setServerErrors({});
          setFormError(null);
        }}
      />
      <VolumeField
        key={`volume-${state.drinkType}`}
        drinkType={state.drinkType}
        value={state.volumeMl}
        error={errors.volumeMl}
        onChange={(volumeMl) => update({ volumeMl })}
      />
      <AbvField
        key={`abv-${state.drinkType}`}
        value={state.abvPercent}
        error={errors.abvPercent}
        onChange={(abvPercent) => update({ abvPercent })}
      />
      <p className="live-grams" aria-live="polite">
        ＝ {formatGrams(grams)} g
      </p>
      <DrunkAtRow
        value={state.drunkAt}
        now={now}
        error={errors.drunkAt}
        onChange={(drunkAt) => update({ drunkAt })}
      />
      <BottlePickerRow
        bottleId={state.bottleId}
        bottleName={state.bottleName}
        error={errors.bottleId}
        onSelect={(bottle) => {
          setState((current) =>
            bottle ? applySelectedBottle(current, bottle) : clearSelectedBottle(current),
          );
          setServerErrors({});
          setFormError(null);
        }}
      />
      <MemoField value={state.memo} error={errors.memo} onChange={(memo) => update({ memo })} />
      <SaveBar
        label={saveButtonLabel(false, photoStatus)}
        pending={create.isPending}
        disabled={!canSubmit}
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
