import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = {
  label: string;
  children: ReactNode;
  className?: string;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled" | "type">;

export function IconButton({
  label,
  children,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={className ? `icon-btn ${className}` : "icon-btn"}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}
