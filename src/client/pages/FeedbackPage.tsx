import { Camera, Images } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { FieldError, fieldDescribedBy } from "@/client/components/form/FieldError.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { useSubmitFeedback } from "@/client/hooks/use-feedback.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { type ImagePickSource, pickImages } from "@/client/lib/photo/pick-image.ts";
import { processFeedbackFile, takeFilesForBatch } from "@/client/lib/photo/process-file.ts";
import {
  DEFAULT_FEEDBACK_CATEGORY,
  FEEDBACK_BODY_MAX_LENGTH,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_COPY,
  FEEDBACK_PHOTO_MAX,
  type FeedbackCategory,
} from "@/shared/feedback.ts";

type DraftPhoto = {
  id: string;
  blob: Blob;
  previewUrl: string;
};

export function FeedbackPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const submit = useSubmitFeedback();
  const bodyId = useId();
  const [category, setCategory] = useState<FeedbackCategory>(DEFAULT_FEEDBACK_CATEGORY);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const [bodyError, setBodyError] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [rateHint, setRateHint] = useState<string | null>(null);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  const remaining = FEEDBACK_BODY_MAX_LENGTH - body.length;
  const canSubmit = body.trim().length > 0 && !submit.isPending && !processing;
  const atPhotoLimit = photos.length >= FEEDBACK_PHOTO_MAX;
  const addDisabled = processing || atPhotoLimit || submit.isPending;

  async function addPhotos(source: ImagePickSource) {
    if (addDisabled) {
      return;
    }
    setPhotoError(undefined);
    setProcessing(true);
    const next: DraftPhoto[] = [];
    try {
      const picked = await pickImages(source, { multiple: source === "library" });
      const taken = takeFilesForBatch(picked, FEEDBACK_PHOTO_MAX - photos.length);
      for (const file of taken) {
        const processed = await processFeedbackFile(file);
        next.push({
          id: crypto.randomUUID(),
          blob: processed.blob,
          previewUrl: processed.previewUrl,
        });
      }
      if (next.length > 0) {
        setPhotos((current) => [...current, ...next]);
      }
    } catch {
      for (const photo of next) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      setPhotoError(FEEDBACK_COPY.photoFailed);
    } finally {
      setProcessing(false);
    }
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((photo) => photo.id !== id);
    });
    setPhotoError(undefined);
  }

  async function onSubmit() {
    const trimmed = body.trim();
    if (!trimmed || submit.isPending || processing) {
      return;
    }
    setBodyError(undefined);
    setPhotoError(undefined);
    setFormError(null);
    setRateHint(null);
    try {
      await submit.mutateAsync({
        category,
        body: trimmed,
        photos: photos.map((photo) => photo.blob),
      });
      showToast({ message: FEEDBACK_COPY.sent, cheer: false });
      navigate("/settings", { replace: true });
    } catch (error) {
      if (isApiClientError(error) && error.code === "rate_limited") {
        setRateHint(FEEDBACK_COPY.rateLimited);
        return;
      }
      if (isApiClientError(error) && error.code === "validation_error") {
        setBodyError(error.fields?.body?.[0] ?? FEEDBACK_COPY.sendFailed);
        return;
      }
      setFormError(FEEDBACK_COPY.sendFailed);
    }
  }

  return (
    <div className="form-page feedback-page">
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <fieldset className="log-form-section">
        <legend className="field-label">{FEEDBACK_COPY.categoryLabel}</legend>
        <div className="chip-row chip-row-wrap">
          {FEEDBACK_CATEGORIES.map((value) => (
            <Chip key={value} selected={category === value} onSelect={() => setCategory(value)}>
              {FEEDBACK_CATEGORY_LABELS[value]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <section className="log-form-section">
        <FieldLabel htmlFor={bodyId} required>
          {FEEDBACK_COPY.bodyLabel}
        </FieldLabel>
        <textarea
          id={bodyId}
          className="memo-textarea"
          aria-invalid={bodyError ? true : undefined}
          aria-describedby={fieldDescribedBy(bodyId, bodyError)}
          maxLength={FEEDBACK_BODY_MAX_LENGTH}
          rows={6}
          placeholder={FEEDBACK_COPY.bodyPlaceholder}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setBodyError(undefined);
          }}
        />
        <p className={remaining < 0 ? "memo-count field-error" : "memo-count"}>
          残り {remaining} 文字
        </p>
        <FieldError id={bodyId} error={bodyError} />
      </section>

      <section className="log-form-section">
        <FieldLabel optional>{FEEDBACK_COPY.photosLabel}</FieldLabel>
        {processing ? (
          <p className="bottle-batch-recognize" role="status">
            <span className="recognize-spinner" aria-hidden />
            {FEEDBACK_COPY.photoProcessing}
          </p>
        ) : null}
        <div className="photo-action-row">
          <button
            type="button"
            className="photo-action"
            onClick={() => void addPhotos("camera")}
            disabled={addDisabled}
          >
            <Camera size={18} aria-hidden />
            {FEEDBACK_COPY.capture}
          </button>
          <button
            type="button"
            className="photo-action"
            onClick={() => void addPhotos("library")}
            disabled={addDisabled}
          >
            <Images size={18} aria-hidden />
            {FEEDBACK_COPY.library}
          </button>
        </div>
        {photos.length > 0 ? (
          <ul className="feedback-thumbs">
            {photos.map((photo) => (
              <li key={photo.id} className="feedback-thumb">
                <img src={photo.previewUrl} alt="" className="feedback-thumb-img" />
                <button
                  type="button"
                  className="header-text-link"
                  onClick={() => removePhoto(photo.id)}
                  disabled={submit.isPending}
                >
                  {FEEDBACK_COPY.removePhoto}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <FieldError id={`${bodyId}-photos`} error={photoError} />
      </section>

      <p className="feedback-note">{FEEDBACK_COPY.note}</p>

      <SaveBar
        label={FEEDBACK_COPY.submit}
        pendingLabel={FEEDBACK_COPY.submitting}
        pending={submit.isPending}
        disabled={!canSubmit}
        hint={rateHint}
        onSave={() => void onSubmit()}
      />
    </div>
  );
}
