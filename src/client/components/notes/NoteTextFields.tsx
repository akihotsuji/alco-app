import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/client/components/ui/input.tsx";
import { NOTE_TEXT_MAX_LENGTH } from "@/shared/tasting-notes.ts";

type NoteTextFieldsProps = {
  taste: string;
  appearance: string;
  aroma: string;
  finish: string;
  errors: {
    taste?: string;
    appearance?: string;
    aroma?: string;
    finish?: string;
  };
  defaultOpen?: boolean;
  onChange: (field: "taste" | "appearance" | "aroma" | "finish", value: string) => void;
};

function Remaining({ value }: { value: string }) {
  const remaining = NOTE_TEXT_MAX_LENGTH - value.length;
  return (
    <p className={remaining < 0 ? "memo-count field-error" : "memo-count"}>残り {remaining} 文字</p>
  );
}

export function NoteTextFields({
  taste,
  appearance,
  aroma,
  finish,
  errors,
  defaultOpen = false,
  onChange,
}: NoteTextFieldsProps) {
  const [open, setOpen] = useState(defaultOpen);
  const tasteId = useId();
  const expanded = open || defaultOpen;

  return (
    <>
      {expanded ? null : (
        <section className="log-form-section">
          <label className="field-label" htmlFor={`${tasteId}-one`}>
            一言
          </label>
          <Input
            id={`${tasteId}-one`}
            value={taste}
            maxLength={NOTE_TEXT_MAX_LENGTH}
            aria-invalid={errors.taste ? true : undefined}
            onChange={(event) => onChange("taste", event.target.value)}
          />
          {errors.taste ? (
            <p className="field-error" role="alert">
              {errors.taste}
            </p>
          ) : null}
        </section>
      )}
      <section className="log-form-section">
        <button
          type="button"
          className={expanded ? "form-row form-row-toggle is-open" : "form-row form-row-toggle"}
          aria-expanded={expanded}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="form-row-label">詳しく書く</span>
          <span className="form-row-value" />
          <ChevronDown size={20} className="form-row-chevron" aria-hidden />
        </button>
        {expanded ? (
          <>
            <NoteTextarea
              label="外観"
              value={appearance}
              error={errors.appearance}
              onChange={(value) => onChange("appearance", value)}
            />
            <NoteTextarea
              label="香り"
              value={aroma}
              error={errors.aroma}
              onChange={(value) => onChange("aroma", value)}
            />
            <NoteTextarea
              label="味わい"
              value={taste}
              error={errors.taste}
              onChange={(value) => onChange("taste", value)}
            />
            <NoteTextarea
              label="余韻"
              value={finish}
              error={errors.finish}
              onChange={(value) => onChange("finish", value)}
            />
          </>
        ) : null}
      </section>
    </>
  );
}

function NoteTextarea({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="log-form-section">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="memo-textarea"
        maxLength={NOTE_TEXT_MAX_LENGTH}
        rows={3}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <Remaining value={value} />
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
