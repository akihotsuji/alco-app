type SwitchProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

export function Switch({ label, checked, disabled = false, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      className={checked ? "switch is-on" : "switch"}
      onClick={() => onChange(!checked)}
    />
  );
}
