import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { MEMO_MAX_LENGTH } from "@/shared/drink-logs.ts";

type MemoFieldProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

/** N9: 折りたたみ + Textarea（0〜500 文字、残数表示）。入力があれば開いたまま */
export function MemoField({ value, error, onChange }: MemoFieldProps) {
  const [open, setOpen] = useState(value.length > 0);
  const textareaId = useId();
  const expanded = open || value.length > 0;
  const remaining = MEMO_MAX_LENGTH - value.length;

  return (
    <section className="log-form-section">
      <button
        type="button"
        className={expanded ? "form-row form-row-toggle is-open" : "form-row form-row-toggle"}
        aria-expanded={expanded}
        aria-controls={textareaId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="form-row-label">メモ</span>
        <span className="form-row-value">{value.length > 0 ? "" : "任意"}</span>
        <ChevronDown size={20} className="form-row-chevron" aria-hidden />
      </button>
      {expanded ? (
        <>
          <textarea
            id={textareaId}
            className="memo-textarea"
            aria-label="メモ"
            aria-invalid={error ? true : undefined}
            maxLength={MEMO_MAX_LENGTH}
            rows={3}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className={remaining < 0 ? "memo-count field-error" : "memo-count"}>
            残り {remaining} 文字
          </p>
        </>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
