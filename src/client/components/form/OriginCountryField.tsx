import { Check, X } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { FieldError, fieldDescribedBy } from "@/client/components/form/FieldError.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { AiMarkPill, aiStateClassName } from "@/client/components/form/FieldWithAiMark.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { haptic } from "@/client/lib/haptic.ts";
import { IDENTITY_FIELD_LABELS, IDENTITY_TEXT_MAX_LENGTH } from "@/shared/identity.ts";
import {
  FREQUENT_ORIGIN_COUNTRIES_JA,
  isAllowedOriginJa,
  searchOriginCountries,
} from "@/shared/origin-countries.ts";

type OriginCountryFieldProps = {
  id: string;
  value: string;
  error?: string;
  aiMarked?: boolean;
  aiPending?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export const ORIGIN_FIELD_PLACEHOLDER = "国名を入力して選ぶ";
export const ORIGIN_FREQUENT_LABEL = "よく使う国";
export const ORIGIN_CLEAR_LABEL = "生産国を消す";

/**
 * 生産国（spec/screen-designs/03-log.md N8b）。`datalist` は端末によって全 200 か国が
 * キーボード上に並んで意味が取れないので使わない。
 * 空のときは「よく使う国」チップで 1 タップ、打ち始めたら前方一致の候補（≦8）を欄の下に出す。
 * 保存できるのは実在国の日本語名だけ（候補から選ぶか、完全一致で打つ）。
 */
export function OriginCountryField({
  id,
  value,
  error,
  aiMarked = false,
  aiPending = false,
  disabled = false,
  onChange,
}: OriginCountryFieldProps) {
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = value.trim();
  const isValid = trimmed.length > 0 && isAllowedOriginJa(trimmed);
  const options =
    focused && !dismissed && trimmed.length > 0 && !isValid ? searchOriginCountries(trimmed) : [];
  const open = options.length > 0;
  const showFrequent = trimmed.length === 0 && !disabled;

  function select(name: string) {
    haptic("light");
    onChange(name);
    setDismissed(true);
    setActiveIndex(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const picked = options[activeIndex];
      if (picked) {
        select(picked.ja);
      }
      return;
    }
    if (event.key === "Escape") {
      setDismissed(true);
    }
  }

  return (
    <section className="log-form-section origin-field">
      <FieldLabel htmlFor={id}>{IDENTITY_FIELD_LABELS.origin}</FieldLabel>
      <div className={aiStateClassName("origin-combobox", aiMarked, aiPending)}>
        <Input
          id={id}
          className={
            trimmed.length > 0 ? "origin-combobox-input has-clear" : "origin-combobox-input"
          }
          value={value}
          maxLength={IDENTITY_TEXT_MAX_LENGTH}
          placeholder={ORIGIN_FIELD_PLACEHOLDER}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(id, error)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setActiveIndex(-1);
          }}
          onKeyDown={onKeyDown}
          onChange={(event) => {
            setDismissed(false);
            setActiveIndex(-1);
            onChange(event.target.value);
          }}
        />
        <div className="origin-combobox-end">
          <AiMarkPill marked={aiMarked} pending={aiPending} />
          {isValid && !aiMarked && !aiPending ? (
            <Check size={16} className="origin-combobox-check" aria-hidden />
          ) : null}
          {trimmed.length > 0 && !disabled ? (
            <button
              type="button"
              className="origin-combobox-clear"
              aria-label={ORIGIN_CLEAR_LABEL}
              onClick={() => {
                onChange("");
                setDismissed(false);
              }}
            >
              <X size={16} aria-hidden />
            </button>
          ) : null}
        </div>
        {open ? (
          <div
            id={listId}
            className="origin-options"
            role="listbox"
            aria-label={`${IDENTITY_FIELD_LABELS.origin}の候補`}
            onPointerDown={(event) => event.preventDefault()}
          >
            {options.map((country, index) => (
              <button
                key={country.code}
                type="button"
                id={`${listId}-option-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                className={index === activeIndex ? "origin-option is-active" : "origin-option"}
                onClick={() => select(country.ja)}
              >
                {country.ja}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {showFrequent ? (
        <div className="origin-frequent">
          <span className="origin-frequent-label">{ORIGIN_FREQUENT_LABEL}</span>
          <div className="chip-row origin-frequent-chips">
            {FREQUENT_ORIGIN_COUNTRIES_JA.map((name) => (
              <Chip key={name} onSelect={() => select(name)}>
                {name}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      <FieldError id={id} error={error} />
    </section>
  );
}
