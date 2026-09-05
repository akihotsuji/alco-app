type SwitchProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      className={checked ? "switch is-on" : "switch"}
      onClick={() => onChange(!checked)}
    />
  );
}
