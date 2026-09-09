import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/client/components/ui/input.tsx";

type PasswordFieldProps = {
  id: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function PasswordField({
  id,
  autoComplete,
  value,
  onChange,
  minLength,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="auth-password mb-4">
      <Input
        id={id}
        className="pr-[52px]"
        type={showPassword ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={() => setShowPassword((current) => !current)}
        aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
      >
        {showPassword ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
      </button>
    </div>
  );
}
