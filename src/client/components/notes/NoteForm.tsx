import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { DetailSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import {
  type PhotoAttachment,
  usePhotoEdit,
} from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { BottlePickerRow } from "@/client/components/logs/BottlePickerRow.tsx";
import { DrinkTypeChips } from "@/client/components/logs/DrinkTypeChips.tsx";
import { NoteTextFields } from "@/client/components/notes/NoteTextFields.tsx";
import { RatingField } from "@/client/components/notes/RatingField.tsx";
import { TastedOnRow } from "@/client/components/notes/TastedOnRow.tsx";
import { PhotoTile } from "@/client/components/photo/PhotoTile.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useBottle } from "@/client/hooks/use-bottles.ts";
import { useCaptureOnCameraQuery } from "@/client/hooks/use-capture-on-camera-query.ts";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import {
  useCreateTastingNote,
  useDeleteTastingNote,
  useTastingNote,
  useUpdateTastingNote,
} from "@/client/hooks/use-tasting-notes.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { notesListHref } from "@/client/lib/app-routes.ts";
import { isUuid } from "@/client/lib/bottle-form.ts";
import { haptic } from "@/client/lib/haptic.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import {
  applySelectedBottle,
  bottleRowLabel,
  canSubmitNoteForm,
  clearSelectedBottle,
  describeNoteSaveFailure,
  initialNoteFormState,
  isNoteFormDirty,
  type NoteFormErrors,
  type NoteFormState,
  noteDetailOpen,
  noteFormStateFromNote,
  noteSaveButtonLabel,
  type PhotoSaveStatus,
  toCreateTastingNoteBody,
  toUpdateTastingNoteBody,
  validateNoteForm,
} from "@/client/lib/note-form.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import type { TastingNote } from "@/shared/tasting-notes.ts";
import { NOTE_DRINK_NAME_MAX_LENGTH } from "@/shared/tasting-notes.ts";

const DISCARD_TITLE = "入力を破棄しますか";
const DISCARD_BODY = "入力した内容は保存されません";
const DISCARD_BODY_WITH_PHOTO = "入力した内容は保存されず、写真も削除されます";

export function NoteNewForm() {
  const [searchParams] = useSearchParams();
  const bottleId = searchParams.get("bottleId");
  if (bottleId && !isUuid(bottleId)) {
    return <NotFoundPage />;
  }
  if (bottleId) {
    return <NoteNewWithBottle bottleId={bottleId} />;
  }
  return <NoteNewFields />;
}

function NoteNewWithBottle({ bottleId }: { bottleId: string }) {
  const query = useBottle(bottleId);
  if (query.isPending) {
    return <DetailSkeleton />;
  }
  if (query.isError) {
    return isApiClientError(query.error) && query.error.code === "not_found" ? (
      <NotFoundPage />
    ) : (
      <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
    );
  }
  return (
    <NoteNewFields
      prefill={applySelectedBottle(initialNoteFormState(), {
        id: query.data.id,
        name: query.data.name,
        drinkType: query.data.drinkType,
        status: query.data.status,
      })}
    />
  );
}

function NoteNewFields({ prefill }: { prefill?: NoteFormState }) {
  const navigate = useNavigate();
  const { setGuard } = useLeaveGuard();
  const { showToast } = useToast();
  const { releaseAttachment, editAttachment } = usePhotoEdit();
  const { startCapture, attachments, retryUpload, clearAttachment } = useCaptureOnCameraQuery(
    "note",
    true,
  );
  const create = useCreateTastingNote();
  const [now] = useState(() => new Date());
  const [initial] = useState(() => prefill ?? initialNoteFormState(now));
  const [state, setState] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<NoteFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [discardOpen, setDiscardOpen] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const attachment = attachments.note;
  const photoStatus: PhotoSaveStatus = attachment ? attachment.status : "none";
  const errors: NoteFormErrors = { ...validateNoteForm(state), ...serverErrors };
  const canSubmit = canSubmitNoteForm(state, errors, photoStatus);
  const dirty = isNoteFormDirty(state, initial) || attachment !== undefined;

  const clearRef = useRef(clearAttachment);
  clearRef.current = clearAttachment;
  const hadStale = useRef(attachment !== undefined);
  useEffect(() => {
    if (hadStale.current) {
      hadStale.current = false;
      void clearRef.current("note");
    }
  }, []);

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

  function update(patch: Partial<NoteFormState>) {
    setState((current) => ({ ...current, ...patch }));
    setServerErrors({});
    setFormError(null);
  }

  function submit() {
    const body = toCreateTastingNoteBody(state, attachment?.photoId ?? null);
    if (!body || !canSubmit || create.isPending) {
      return;
    }
    setFormError(null);
    setServerErrors({});
    setSaveState("loading");
    create.mutate(body, {
      onSuccess: (note) => {
        savedRef.current = true;
        setGuard(null);
        haptic("success");
        releaseAttachment("note");
        navigate(`/notes/${note.id}`, { replace: true });
        showToast({ message: TOAST_MESSAGES.saved });
      },
      onError: (error) => {
        const failure = describeNoteSaveFailure(error, navigator.onLine, {
          hasPhoto: Boolean(attachment?.photoId),
          hasBottle: Boolean(state.bottleId),
        });
        setSaveState("error");
        setFormError(failure.formMessage);
        setServerErrors(failure.fieldErrors);
        if (failure.dropPhoto) {
          releaseAttachment("note");
        }
        if (failure.dropBottle) {
          setState((current) => clearSelectedBottle(current));
        }
      },
    });
  }

  async function discard() {
    await clearAttachment("note");
    savedRef.current = true;
    setGuard(null);
    setDiscardOpen(false);
    pendingLeave.current?.();
    pendingLeave.current = null;
  }

  return (
    <NoteFormFields
      state={state}
      errors={errors}
      formError={formError}
      photoStatus={photoStatus}
      canSubmit={canSubmit}
      pending={create.isPending}
      saveState={create.isPending ? "loading" : saveState}
      attachment={attachment}
      existingPhotoId={null}
      onStartCapture={() => void startCapture("note")}
      onEdit={() => void editAttachment("note")}
      onRetry={() => void retryUpload("note")}
      onClearPhoto={() => void clearAttachment("note")}
      onRemoveExisting={undefined}
      onUpdate={update}
      onSave={submit}
      discardOpen={discardOpen}
      discardBody={attachment ? DISCARD_BODY_WITH_PHOTO : DISCARD_BODY}
      onDiscard={() => void discard()}
      onCloseDiscard={() => {
        setDiscardOpen(false);
        pendingLeave.current = null;
      }}
    />
  );
}

export function NoteEditForm({ noteId }: { noteId: string | undefined }) {
  if (!noteId || !isUuid(noteId)) {
    return <NotFoundPage />;
  }
  return <LoadedNoteEditForm noteId={noteId} />;
}

function LoadedNoteEditForm({ noteId }: { noteId: string }) {
  const query = useTastingNote(noteId);
  if (query.isPending) {
    return <DetailSkeleton />;
  }
  if (query.isError) {
    return isApiClientError(query.error) && query.error.code === "not_found" ? (
      <NotFoundPage />
    ) : (
      <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
    );
  }
  return <LoadedNoteEdit key={query.data.id} note={query.data} />;
}

function LoadedNoteEdit({ note }: { note: TastingNote }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setGuard } = useLeaveGuard();
  const {
    attachments,
    startCapture,
    editAttachment,
    retryUpload,
    clearAttachment,
    releaseAttachment,
  } = usePhotoEdit();
  const updateNote = useUpdateTastingNote();
  const deleteNote = useDeleteTastingNote();
  const [initial] = useState(() => noteFormStateFromNote(note));
  const [state, setState] = useState(initial);
  const [existingPhotoId, setExistingPhotoId] = useState(note.thumbPhotoId);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<NoteFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const attachment = attachments.note;
  const photoStatus: PhotoSaveStatus = attachment ? attachment.status : "none";
  const errors = { ...validateNoteForm(state), ...serverErrors };
  const dirty = isNoteFormDirty(state, initial) || attachment !== undefined || photoRemoved;
  const canSubmit = dirty && canSubmitNoteForm(state, errors, photoStatus) && !deleteNote.isPending;

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

  function update(patch: Partial<NoteFormState>) {
    setState((current) => ({ ...current, ...patch }));
    setServerErrors({});
    setFormError(null);
  }

  function submit() {
    const body = toUpdateTastingNoteBody(state, initial, attachment?.photoId ?? null, photoRemoved);
    if (!body || !canSubmit || updateNote.isPending) {
      return;
    }
    setSaveState("loading");
    setFormError(null);
    setServerErrors({});
    updateNote.mutate(
      { id: note.id, body },
      {
        onSuccess: (updated) => {
          savedRef.current = true;
          setGuard(null);
          haptic("success");
          releaseAttachment("note");
          navigate(`/notes/${updated.id}`, { replace: true });
          showToast({ message: TOAST_MESSAGES.saved });
        },
        onError: (error) => {
          const failure = describeNoteSaveFailure(error, navigator.onLine, {
            hasPhoto: Boolean(attachment?.photoId),
            hasBottle: Boolean(state.bottleId),
          });
          setSaveState("error");
          setFormError(failure.formMessage);
          setServerErrors(failure.fieldErrors);
          if (failure.dropPhoto) {
            releaseAttachment("note");
          }
          if (failure.dropBottle) {
            setState((current) => clearSelectedBottle(current));
          }
        },
      },
    );
  }

  function removeExistingPhoto() {
    if (!existingPhotoId) {
      return;
    }
    setExistingPhotoId(null);
    setPhotoRemoved(true);
  }

  async function discard() {
    await clearAttachment("note");
    savedRef.current = true;
    setGuard(null);
    setDiscardOpen(false);
    pendingLeave.current?.();
    pendingLeave.current = null;
  }

  function confirmDelete() {
    deleteNote.mutate(note.id, {
      onSuccess: () => {
        savedRef.current = true;
        setGuard(null);
        releaseAttachment("note");
        navigate(notesListHref(), { replace: true });
        showToast({ message: TOAST_MESSAGES.deleted, cheer: false });
      },
      onError: () => {
        setDeleteOpen(false);
        showToast({ message: TOAST_MESSAGES.saveFailed });
      },
    });
  }

  return (
    <>
      <NoteFormFields
        state={state}
        errors={errors}
        formError={formError}
        photoStatus={photoStatus}
        canSubmit={canSubmit}
        pending={updateNote.isPending}
        saveState={updateNote.isPending ? "loading" : saveState}
        attachment={attachment}
        existingPhotoId={existingPhotoId}
        onStartCapture={() => void startCapture("note")}
        onEdit={() => void editAttachment("note")}
        onRetry={() => void retryUpload("note")}
        onClearPhoto={() => void clearAttachment("note")}
        onRemoveExisting={removeExistingPhoto}
        onUpdate={update}
        onSave={submit}
        discardOpen={discardOpen}
        discardBody={attachment ? DISCARD_BODY_WITH_PHOTO : DISCARD_BODY}
        onDiscard={() => void discard()}
        onCloseDiscard={() => {
          setDiscardOpen(false);
          pendingLeave.current = null;
        }}
      />
      <button type="button" className="log-delete" onClick={() => setDeleteOpen(true)}>
        このノートを削除
      </button>
      <Dialog
        open={deleteOpen}
        title="このノートを削除しますか"
        body="削除したノートは元に戻せません"
        primaryLabel="削除する"
        destructive
        pending={deleteNote.isPending}
        onPrimary={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

function NoteFormFields({
  state,
  errors,
  formError,
  photoStatus,
  canSubmit,
  pending,
  saveState,
  attachment,
  existingPhotoId,
  onStartCapture,
  onEdit,
  onRetry,
  onClearPhoto,
  onRemoveExisting,
  onUpdate,
  onSave,
  discardOpen,
  discardBody,
  onDiscard,
  onCloseDiscard,
}: {
  state: NoteFormState;
  errors: NoteFormErrors;
  formError: string | null;
  photoStatus: PhotoSaveStatus;
  canSubmit: boolean;
  pending: boolean;
  saveState: MotionState;
  attachment?: PhotoAttachment;
  existingPhotoId: string | null;
  onStartCapture: () => void;
  onEdit: () => void;
  onRetry: () => void;
  onClearPhoto: () => void;
  onRemoveExisting?: () => void;
  onUpdate: (patch: Partial<NoteFormState>) => void;
  onSave: () => void;
  discardOpen: boolean;
  discardBody: string;
  onDiscard: () => void;
  onCloseDiscard: () => void;
}) {
  return (
    <div className="form-page log-form">
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      {attachment ? (
        <PhotoTile
          onClick={onStartCapture}
          attachment={attachment}
          onEdit={onEdit}
          onRetry={onRetry}
          onClear={onClearPhoto}
          error={errors.photoIds}
        />
      ) : existingPhotoId ? (
        <div className="photo-thumb-row">
          <div className="photo-thumb photo-thumb-log">
            <img className="photo-thumb-img" src={photoContentUrl(existingPhotoId)} alt="" />
          </div>
          <div className="photo-thumb-actions">
            <button type="button" className="header-text-link" onClick={onStartCapture}>
              編集
            </button>
            {onRemoveExisting ? (
              <button type="button" className="header-text-link" onClick={onRemoveExisting}>
                削除
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <PhotoTile onClick={onStartCapture} />
      )}
      <BottlePickerRow
        bottleId={state.bottleId}
        bottleName={state.bottleName}
        valueLabel={
          state.bottleName ? bottleRowLabel(state.bottleName, state.bottleStatus) : undefined
        }
        clearable
        error={errors.bottleId}
        onSelect={(bottle) => {
          if (bottle) {
            onUpdate(applySelectedBottle(state, bottle));
          } else {
            onUpdate(clearSelectedBottle(state));
          }
        }}
      />
      {state.bottleId ? null : (
        <>
          <section className="log-form-section">
            <label className="field-label" htmlFor="note-drink-name">
              銘柄名
            </label>
            <Input
              id="note-drink-name"
              value={state.drinkName}
              maxLength={NOTE_DRINK_NAME_MAX_LENGTH}
              aria-invalid={errors.drinkName ? true : undefined}
              onChange={(event) => onUpdate({ drinkName: event.target.value })}
            />
            {errors.drinkName ? (
              <p className="field-error" role="alert">
                {errors.drinkName}
              </p>
            ) : null}
          </section>
          <DrinkTypeChips
            value={state.drinkType}
            onChange={(drinkType) => onUpdate({ drinkType })}
          />
          {errors.drinkType ? (
            <p className="field-error" role="alert">
              {errors.drinkType}
            </p>
          ) : null}
        </>
      )}
      <TastedOnRow
        value={state.tastedOn}
        now={new Date()}
        error={errors.tastedOn}
        onChange={(tastedOn) => onUpdate({ tastedOn })}
      />
      <RatingField
        value={state.ratingX10}
        error={errors.ratingX10}
        onChange={(ratingX10) => onUpdate({ ratingX10 })}
      />
      <NoteTextFields
        taste={state.taste}
        appearance={state.appearance}
        aroma={state.aroma}
        finish={state.finish}
        errors={errors}
        defaultOpen={noteDetailOpen(state)}
        onChange={(field, value) => onUpdate({ [field]: value })}
      />
      <SaveBar
        label={noteSaveButtonLabel(pending, photoStatus)}
        pending={pending}
        disabled={!canSubmit}
        state={saveState}
        onSave={onSave}
      />
      <Dialog
        open={discardOpen}
        title={DISCARD_TITLE}
        body={discardBody}
        primaryLabel="破棄する"
        destructive
        onPrimary={onDiscard}
        onClose={onCloseDiscard}
      />
    </div>
  );
}
