import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button, type ButtonProps } from "@/client/components/ui/button.tsx";

type IconButtonProps = {
  label: string;
  children: ReactNode;
  className?: string;
  size?: Extract<ButtonProps["size"], "icon" | "icon-lg">;
  asChild?: boolean;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled" | "type">;

export function IconButton({
  label,
  children,
  className,
  size = "icon",
  type = "button",
  asChild,
  ...props
}: IconButtonProps) {
  return (
    <Button
      type={type}
      variant="icon"
      size={size}
      className={className}
      aria-label={label}
      asChild={asChild}
      {...props}
    >
      {children}
    </Button>
  );
}
