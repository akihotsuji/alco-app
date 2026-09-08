import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { RecognizeBanner } from "@/client/components/cellar/RecognizeBanner.tsx";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { DetailSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { FieldWithAiMark } from "@/client/components/form/FieldWithAiMark.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { IdentityFields } from "@/client/components/form/IdentityFields.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { BottlePickerRow, TargetBottleChip } from "@/client/components/logs/BottlePickerRow.tsx";
import { DrinkTypeSelect } from "@/client/components/logs/DrinkTypeSelect.tsx";
import { NotePhotoStrip } from "@/client/components/notes/NotePhotoStrip.tsx";
import { NoteTextFields } from "@/client/components/notes/NoteTextFields.tsx";
import { RatingField } from "@/client/components/notes/RatingField.tsx";
import { TastedOnRow } from "@/client/components/notes/TastedOnRow.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useBottle } from "@/client/hooks/use-bottles.ts";
import { useDrinkLog } from "@/client/hooks/use-drink-logs.ts";
import { useNotePhotos } from "@/client/hooks/use-note-photos.ts";
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
  noteFormStateFromDrinkLog,
  type NoteFormErrors,
  type NoteFormField,
  type NoteFormState,
  noteDetailOpen,
  noteFormStateFromNote,
  noteSaveButtonLabel,
  noteSaveDisabledHint,
  type PhotoSaveStatus,
  toCreateTastingNoteBody,
  toUpdateTastingNoteBody,
  validateNoteForm,
  visibleNoteFormErrors,
} from "@/client/lib/note-form.ts";
import type { NotePhotoItem } from "@/client/lib/note-photos.ts";
import {
  applyRecognizeToNoteForm,
  countNoteRecognizeFields,
  NOTE_RECOGNIZE_BANNER,
  type NoteRecognizeTouched,
} from "@/client/lib/note-recognize.ts";
import { parseFormOrigin } from "@/client/lib/opened-followup.ts";
import type { ImagePickSource } from "@/client/lib/photo/pick-image.ts";
import { startNoteRecognition } from "@/client/lib/recognize-session.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import { capturedAtToCalendarDate } from "@/client/lib/photo/captured-at.ts";
import { IDENTITY_FIELD_LABELS } from "@/shared/identity.ts";
import type { TastingNote } from "@/shared/tasting-notes.ts";
import { NOTE_DRINK_NAME_MAX_LENGTH } from "@/shared/tasting-notes.ts";

const DISCARD_TITLE = "入力を破棄しますか";
const DISCARD_BODY = "入力した内容は保存されません";
const DISCARD_BODY_WITH_PHOTO = "入力した内容は保存されず、写真も削除されます";

export function NoteNewForm() {
  const [searchParams] = useSearchParams();
  const fromLog = searchParams.get("fromLog");
  const bottleId = searchParams.get("bottleId");
  const formOrigin = parseFormOrigin(searchParams.get("from"));
  if (fromLog) {
    if (!isUuid(fromLog)) {
      return <NotFoundPage />;
    }
    return <NoteNewWithLog logId={fromLog} />;
  }
  if (bottleId && !isUuid(bottleId)) {
    return <NotFoundPage />;
  }
  if (bottleId) {
    return <NoteNewWithBottle bottleId={bottleId} formOrigin={formOrigin} />;
  }
  return <NoteNewFields />;
}

function NoteNewWithLog({ logId }: { logId: string }) {
  const query = useDrinkLog(logId);
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
  return <NoteNewFields keepPrefillDate prefill={noteFormStateFromDrinkLog(query.data)} />;
}

function NoteNewWithBottle({
  bottleId,
  formOrigin,
}: {
  bottleId: string;
  formOrigin: ReturnType<typeof parseFormOrigin>;
}) {
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
      formOrigin={formOrigin}
      prefill={applySelectedBottle(initialNoteFormState(), {
        id: query.data.id,
        name: query.data.name,
        drinkType: query.data.drinkType,
        status: query.data.status,
        vintage: query.data.vintage,
        producer: query.data.producer,
        origin: query.data.origin,
        variety: query.data.variety,
      })}
    />
  );
}

function NoteNewFields({
  prefill,
  formOrigin = null,
  keepPrefillDate = false,
}: {
  prefill?: NoteFormState;
  formOrigin?: ReturnType<typeof parseFormOrigin>;
  keepPrefillDate?: boolean;
}) {
  const navigate = useNavigate();
  const { setGuard } = useLeaveGuard();
  const { showToast } = useToast();
  const photos = useNotePhotos([]);
  const create = useCreateTastingNote();
  const [now] = useState(() => new Date());
  const [initial] = useState(() => prefill ?? initialNoteFormState(now));
  const [state, setState] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<NoteFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<NoteFormField, boolean>>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const photoStatus: PhotoSaveStatus = photos.photoStatus;
  const errors: NoteFormErrors = { ...validateNoteForm(state), ...serverErrors };
  const visibleErrors = visibleNoteFormErrors(errors, { submitted, touched });
  const canSubmit = canSubmitNoteForm(state, errors, photoStatus);
  const dirty = isNoteFormDirty(state, initial) || photos.items.length > 0;

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

  function update(patch: Partial<NoteFormState>, field?: NoteFormField) {
    if (field) {
      setTouched((current) => ({ ...current, [field]: true }));
    }
    setState((current) => ({ ...current, ...patch }));
    setServerErrors({});
    setFormError(null);
  }

  function submit() {
    setSubmitted(true);
    const body = toCreateTastingNoteBody(state, photos.photoIds);
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
        photos.releaseLocal();
        navigate(`/notes/${note.id}`, { replace: true });
        showToast({ message: TOAST_MESSAGES.saved });
      },
      onError: (error) => {
        const failure = describeNoteSaveFailure(error, navigator.onLine, {
          hasPhoto: photos.photoIds.length > 0,
          hasBottle: Boolean(state.bottleId),
        });
        setSaveState("error");
        setFormError(failure.formMessage);
        setServerErrors(failure.fieldErrors);
        if (failure.dropBottle) {
          setState((current) => clearSelectedBottle(current));
        }
      },
    });
  }

  async function discard() {
    await photos.discardUnpersisted();
    photos.releaseLocal();
    savedRef.current = true;
    setGuard(null);
    setDiscardOpen(false);
    pendingLeave.current?.();
    pendingLeave.current = null;
  }

  return (
    <NoteFormFields
      state={state}
      errors={visibleErrors}
      saveHint={noteSaveDisabledHint(state, errors, photoStatus)}
      lead="香りや味わいを残す"
      targetName={formOrigin && state.bottleName ? state.bottleName : null}
      formError={formError}
      photoStatus={photoStatus}
      canSubmit={canSubmit}
      pending={create.isPending}
      saveState={create.isPending ? "loading" : saveState}
      photos={photos}
      keepPrefillDate={keepPrefillDate}
      onUpdate={update}
      onSave={submit}
      discardOpen={discardOpen}
      discardBody={photos.items.length > 0 ? DISCARD_BODY_WITH_PHOTO : DISCARD_BODY}
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
  const photos = useNotePhotos(note.photos);
  const updateNote = useUpdateTastingNote();
  const deleteNote = useDeleteTastingNote();
  const [initial] = useState(() => noteFormStateFromNote(note));
  const [state, setState] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<NoteFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<NoteFormField, boolean>>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const photoStatus: PhotoSaveStatus = photos.photoStatus;
  const errors = { ...validateNoteForm(state), ...serverErrors };
  const visibleErrors = visibleNoteFormErrors(errors, { submitted, touched });
  const dirty = isNoteFormDirty(state, initial) || photos.photosDirty;
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

  function update(patch: Partial<NoteFormState>, field?: NoteFormField) {
    if (field) {
      setTouched((current) => ({ ...current, [field]: true }));
    }
    setState((current) => ({ ...current, ...patch }));
    setServerErrors({});
    setFormError(null);
  }

  function submit() {
    setSubmitted(true);
    const body = toUpdateTastingNoteBody(
      state,
      initial,
      photos.photosDirty ? photos.photoIds : undefined,
    );
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
          photos.releaseLocal();
          navigate(`/notes/${updated.id}`, { replace: true });
          showToast({ message: TOAST_MESSAGES.saved });
        },
        onError: (error) => {
          const failure = describeNoteSaveFailure(error, navigator.onLine, {
            hasPhoto: photos.photoIds.length > 0,
            hasBottle: Boolean(state.bottleId),
          });
          setSaveState("error");
          setFormError(failure.formMessage);
          setServerErrors(failure.fieldErrors);
          if (failure.dropBottle) {
            setState((current) => clearSelectedBottle(current));
          }
        },
      },
    );
  }

  async function discard() {
    await photos.discardUnpersisted();
    photos.releaseLocal();
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
        photos.releaseLocal();
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
        errors={visibleErrors}
        saveHint={noteSaveDisabledHint(state, errors, photoStatus)}
        formError={formError}
        photoStatus={photoStatus}
        canSubmit={canSubmit}
        pending={updateNote.isPending}
        saveState={updateNote.isPending ? "loading" : saveState}
        photos={photos}
        keepPrefillDate
        onUpdate={update}
        onSave={submit}
        discardOpen={discardOpen}
        discardBody={photos.hasUnpersisted ? DISCARD_BODY_WITH_PHOTO : DISCARD_BODY}
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
  saveHint,
  lead,
  targetName,
  formError,
  photoStatus,
  canSubmit,
  pending,
  saveState,
  photos,
  keepPrefillDate = false,
  onUpdate,
  onSave,
  discardOpen,
  discardBody,
  onDiscard,
  onCloseDiscard,
}: {
  state: NoteFormState;
  errors: NoteFormErrors;
  saveHint: string | null;
  lead?: string;
  targetName?: string | null;
  formError: string | null;
  photoStatus: PhotoSaveStatus;
  canSubmit: boolean;
  pending: boolean;
  saveState: MotionState;
  photos: {
    items: readonly NotePhotoItem[];
    canAdd: boolean;
    addPhoto: (source?: ImagePickSource) => Promise<void>;
    editPhoto: (key: string) => Promise<void>;
    retryPhoto: (key: string) => Promise<void>;
    removePhoto: (key: string) => Promise<void>;
    makeFirst: (key: string) => void;
  };
  keepPrefillDate?: boolean;
  onUpdate: (patch: Partial<NoteFormState>, field?: NoteFormField) => void;
  onSave: () => void;
  discardOpen: boolean;
  discardBody: string;
  onDiscard: () => void;
  onCloseDiscard: () => void;
}) {
  const { pendingRecognizeJpeg } = usePhotoEdit();
  const [recognizeStatus, setRecognizeStatus] = useState<"loading" | "success" | "failure" | null>(
    null,
  );
  const [aiMarks, setAiMarks] = useState<Set<string>>(new Set());
  const touchedRef = useRef<NoteRecognizeTouched>({
    drinkName: false,
    drinkType: false,
    vintage: false,
    producer: false,
    origin: false,
    variety: false,
  });
  const dateTouchedRef = useRef(keepPrefillDate);
  const appliedCapturedAtRef = useRef<string | null>(null);
  const recognizedJpegRef = useRef<Blob | null>(null);
  const recognizeRequestRef = useRef(0);
  const stateRef = useRef(state);
  const onUpdateRef = useRef(onUpdate);
  stateRef.current = state;
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!pendingRecognizeJpeg) {
      return;
    }
    startNoteRecognition(pendingRecognizeJpeg).catch(() => {});
  }, [pendingRecognizeJpeg]);

  useEffect(() => {
    const jpeg =
      photos.items.find((item) => item.recognizeJpeg)?.recognizeJpeg ?? pendingRecognizeJpeg;
    if (!jpeg || recognizedJpegRef.current === jpeg) {
      return;
    }
    recognizedJpegRef.current = jpeg;
    const requestId = recognizeRequestRef.current + 1;
    recognizeRequestRef.current = requestId;
    setRecognizeStatus("loading");
    void startNoteRecognition(jpeg)
      .then((result) => {
        if (requestId !== recognizeRequestRef.current) {
          return;
        }
        if (countNoteRecognizeFields(result.fields) === 0) {
          setRecognizeStatus("failure");
          return;
        }
        const applied = applyRecognizeToNoteForm({
          state: stateRef.current,
          fields: result.fields,
          touched: touchedRef.current,
        });
        onUpdateRef.current(applied.next);
        setAiMarks(new Set(applied.applied));
        setRecognizeStatus("success");
      })
      .catch(() => {
        if (requestId !== recognizeRequestRef.current) {
          return;
        }
        setRecognizeStatus("failure");
      });
  }, [pendingRecognizeJpeg, photos.items]);

  useEffect(() => {
    const capturedAt = photos.items.find((item) => item.capturedAt)?.capturedAt;
    if (!capturedAt || appliedCapturedAtRef.current === capturedAt) {
      return;
    }
    if (dateTouchedRef.current) {
      appliedCapturedAtRef.current = capturedAt;
      return;
    }
    appliedCapturedAtRef.current = capturedAt;
    onUpdateRef.current({ tastedOn: capturedAtToCalendarDate(capturedAt, new Date()) });
  }, [photos.items]);

  function markIdentity(field: keyof NoteRecognizeTouched, value: string) {
    touchedRef.current[field] = true;
    setAiMarks((current) => {
      if (!current.has(field)) {
        return current;
      }
      const next = new Set(current);
      next.delete(field);
      return next;
    });
    onUpdate({ [field]: value }, field);
  }

  return (
    <div className="form-page log-form">
      {lead ? <p className="form-lead">{lead}</p> : null}
      {targetName ? <TargetBottleChip name={targetName} /> : null}
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <NotePhotoStrip
        items={photos.items}
        canAdd={photos.canAdd}
        error={errors.photoIds}
        onAdd={() => void photos.addPhoto()}
        onLibrary={() => void photos.addPhoto("library")}
        onEdit={(key) => void photos.editPhoto(key)}
        onRetry={(key) => void photos.retryPhoto(key)}
        onRemove={(key) => {
          recognizedJpegRef.current = null;
          setRecognizeStatus(null);
          void photos.removePhoto(key);
        }}
        onMakeFirst={photos.makeFirst}
      />
      {recognizeStatus ? (
        <RecognizeBanner status={recognizeStatus} messages={NOTE_RECOGNIZE_BANNER} />
      ) : null}
      <section className="log-form-section">
        <FieldLabel htmlFor="note-drink-name" required>
          {IDENTITY_FIELD_LABELS.drinkName}
        </FieldLabel>
        <FieldWithAiMark marked={aiMarks.has("drinkName")}>
          <Input
            id="note-drink-name"
            value={state.drinkName}
            maxLength={NOTE_DRINK_NAME_MAX_LENGTH}
            placeholder="例：Planeta"
            aria-invalid={errors.drinkName ? true : undefined}
            onChange={(event) => {
              markIdentity("drinkName", event.target.value);
            }}
          />
        </FieldWithAiMark>
        {errors.drinkName ? (
          <p className="field-error" role="alert">
            {errors.drinkName}
          </p>
        ) : null}
      </section>
      <DrinkTypeSelect
        required
        value={state.drinkType}
        error={errors.drinkType}
        onChange={(drinkType) => {
          touchedRef.current.drinkType = true;
          onUpdate({ drinkType }, "drinkType");
        }}
      />
      <BottlePickerRow
        placement="optional"
        bottleId={state.bottleId}
        bottleName={state.bottleName}
        valueLabel={
          state.bottleName ? bottleRowLabel(state.bottleName, state.bottleStatus) : undefined
        }
        error={errors.bottleId}
        onSelect={(bottle) => {
          if (bottle) {
            onUpdate(applySelectedBottle(state, bottle, { preserveEdits: true }));
          } else {
            onUpdate(clearSelectedBottle(state));
          }
        }}
      />
      <IdentityFields
        idPrefix="note"
        values={{
          vintage: state.vintage,
          variety: state.variety,
          producer: state.producer,
          origin: state.origin,
        }}
        errors={{
          vintage: errors.vintage,
          variety: errors.variety,
          producer: errors.producer,
          origin: errors.origin,
        }}
        aiMarks={aiMarks}
        onChange={(field, value) => markIdentity(field, value)}
      />
      <TastedOnRow
        value={state.tastedOn}
        now={new Date()}
        error={errors.tastedOn}
        onChange={(tastedOn) => {
          dateTouchedRef.current = true;
          onUpdate({ tastedOn }, "tastedOn");
        }}
      />
      <RatingField
        value={state.ratingX10}
        error={errors.ratingX10}
        onChange={(ratingX10) => onUpdate({ ratingX10 }, "ratingX10")}
      />
      <NoteTextFields
        taste={state.taste}
        appearance={state.appearance}
        aroma={state.aroma}
        finish={state.finish}
        errors={errors}
        defaultOpen={noteDetailOpen(state)}
        onChange={(field, value) => onUpdate({ [field]: value }, field)}
      />
      <SaveBar
        label={noteSaveButtonLabel(pending, photoStatus)}
        pending={pending}
        disabled={!canSubmit}
        hint={!canSubmit ? saveHint : null}
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
