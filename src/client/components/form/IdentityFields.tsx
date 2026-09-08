import { FieldWithAiMark } from "@/client/components/form/FieldWithAiMark.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { IDENTITY_FIELD_LABELS, IDENTITY_TEXT_MAX_LENGTH } from "@/shared/identity.ts";

export type IdentityFieldValues = {
  vintage: string;
  variety: string;
  producer: string;
  origin: string;
};

export type IdentityFieldKey = keyof IdentityFieldValues;

type IdentityFieldsProps = {
  values: IdentityFieldValues;
  errors?: Partial<Record<IdentityFieldKey, string>>;
  aiMarks?: ReadonlySet<string>;
  idPrefix?: string;
  onChange: (field: IdentityFieldKey, value: string) => void;
};

export function IdentityFields({
  values,
  errors,
  aiMarks,
  idPrefix = "identity",
  onChange,
}: IdentityFieldsProps) {
  return (
    <div className="identity-fields">
      <div className="bottle-details-pair">
        <IdentityInput
          id={`${idPrefix}-vintage`}
          label={IDENTITY_FIELD_LABELS.vintage}
          value={values.vintage}
          inputMode="numeric"
          placeholder="NV"
          error={errors?.vintage}
          aiMarked={aiMarks?.has("vintage") ?? false}
          onChange={(value) => onChange("vintage", value)}
        />
        <IdentityInput
          id={`${idPrefix}-variety`}
          label={IDENTITY_FIELD_LABELS.variety}
          value={values.variety}
          maxLength={IDENTITY_TEXT_MAX_LENGTH}
          error={errors?.variety}
          aiMarked={aiMarks?.has("variety") ?? false}
          onChange={(value) => onChange("variety", value)}
        />
      </div>
      <IdentityInput
        id={`${idPrefix}-producer`}
        label={IDENTITY_FIELD_LABELS.producer}
        value={values.producer}
        maxLength={IDENTITY_TEXT_MAX_LENGTH}
        error={errors?.producer}
        aiMarked={aiMarks?.has("producer") ?? false}
        onChange={(value) => onChange("producer", value)}
      />
      <IdentityInput
        id={`${idPrefix}-origin`}
        label={IDENTITY_FIELD_LABELS.origin}
        value={values.origin}
        maxLength={IDENTITY_TEXT_MAX_LENGTH}
        error={errors?.origin}
        aiMarked={aiMarks?.has("origin") ?? false}
        onChange={(value) => onChange("origin", value)}
      />
    </div>
  );
}

function IdentityInput({
  id,
  label,
  value,
  onChange,
  error,
  maxLength,
  inputMode,
  placeholder,
  aiMarked,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  maxLength?: number;
  inputMode?: "numeric";
  placeholder?: string;
  aiMarked: boolean;
}) {
  return (
    <section className="log-form-section">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FieldWithAiMark marked={aiMarked}>
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldWithAiMark>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
