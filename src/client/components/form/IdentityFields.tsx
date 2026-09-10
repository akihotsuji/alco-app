import { FieldError, fieldDescribedBy } from "@/client/components/form/FieldError.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { FieldWithAiMark } from "@/client/components/form/FieldWithAiMark.tsx";
import { OriginCountryField } from "@/client/components/form/OriginCountryField.tsx";
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
  /** 読み取り中に AI が入れる可能性のある欄（「読み取り中」ピル） */
  aiPending?: ReadonlySet<string>;
  idPrefix?: string;
  onChange: (field: IdentityFieldKey, value: string) => void;
};

export function IdentityFields({
  values,
  errors,
  aiMarks,
  aiPending,
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
          aiPending={aiPending?.has("vintage") ?? false}
          onChange={(value) => onChange("vintage", value)}
        />
        <IdentityInput
          id={`${idPrefix}-variety`}
          label={IDENTITY_FIELD_LABELS.variety}
          value={values.variety}
          maxLength={IDENTITY_TEXT_MAX_LENGTH}
          error={errors?.variety}
          aiMarked={aiMarks?.has("variety") ?? false}
          aiPending={aiPending?.has("variety") ?? false}
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
        aiPending={aiPending?.has("producer") ?? false}
        onChange={(value) => onChange("producer", value)}
      />
      <OriginCountryField
        id={`${idPrefix}-origin`}
        value={values.origin}
        error={errors?.origin}
        aiMarked={aiMarks?.has("origin") ?? false}
        aiPending={aiPending?.has("origin") ?? false}
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
  aiPending,
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
  aiPending: boolean;
}) {
  return (
    <section className="log-form-section">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FieldWithAiMark marked={aiMarked} pending={aiPending}>
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(id, error)}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldWithAiMark>
      <FieldError id={id} error={error} />
    </section>
  );
}
