import { FieldError, fieldDescribedBy } from "@/client/components/form/FieldError.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { FieldWithAiMark } from "@/client/components/form/FieldWithAiMark.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { IDENTITY_FIELD_LABELS, IDENTITY_TEXT_MAX_LENGTH } from "@/shared/identity.ts";
import { ORIGIN_COUNTRIES } from "@/shared/origin-countries.ts";

type OriginCountryFieldProps = {
  id: string;
  value: string;
  error?: string;
  aiMarked?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function OriginCountryField({
  id,
  value,
  error,
  aiMarked = false,
  disabled = false,
  onChange,
}: OriginCountryFieldProps) {
  const listId = `${id}-countries`;
  return (
    <section className="log-form-section">
      <FieldLabel htmlFor={id}>{IDENTITY_FIELD_LABELS.origin}</FieldLabel>
      <FieldWithAiMark marked={aiMarked}>
        <Input
          id={id}
          value={value}
          list={listId}
          maxLength={IDENTITY_TEXT_MAX_LENGTH}
          placeholder="国名を選ぶ"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(id, error)}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldWithAiMark>
      <datalist id={listId}>
        {ORIGIN_COUNTRIES.map((country) => (
          <option key={country.code} value={country.ja} />
        ))}
      </datalist>
      <FieldError id={id} error={error} />
    </section>
  );
}
