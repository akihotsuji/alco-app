import { useId } from "react";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { MEMO_MAX_LENGTH } from "@/shared/drink-logs.ts";

type MemoFieldProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

/** N9: ラベル上 + Textarea（0〜500 文字、残数表示） */
export function MemoField({ value, error, onChange }: MemoFieldProps) {
  const textareaId = useId();
  const remaining = MEMO_MAX_LENGTH - value.length;

  return (
    <section className="log-form-section">
      <FieldLabel htmlFor={textareaId} optional>
        メモ
      </FieldLabel>
      <textarea
        id={textareaId}
        className="memo-textarea"
        aria-invalid={error ? true : undefined}
        maxLength={MEMO_MAX_LENGTH}
        rows={3}
        placeholder="飲んだ場所など"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className={remaining < 0 ? "memo-count field-error" : "memo-count"}>
        残り {remaining} 文字
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
