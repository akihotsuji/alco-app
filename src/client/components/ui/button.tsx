import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import type { MotionState } from "@/client/lib/motion.ts";
import { cn } from "@/client/lib/utils.ts";

/**
 * 押下（M-01 / M-02）・水位線（M-04〜M-06）は styles.css の `.app-btn` / `.btn-primary` /
 * `.btn-soft` が担う。時間・イージングはモーショントークンのみ（その場の duration は書かない）。
 */
export const buttonVariants = cva(
  "app-btn inline-flex items-center justify-center font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "btn-primary bg-primary text-primary-fg shadow-primary",
        secondary: "btn-soft bg-background text-foreground shadow-outset-sm",
        destructive: "btn-primary bg-danger text-danger-fg shadow-primary",
        ghost: "bg-transparent text-muted",
        link: "h-auto min-h-11 w-auto bg-transparent px-0 text-primary",
        icon: "btn-soft bg-background text-foreground shadow-outset-sm",
      },
      size: {
        default: "h-[52px] w-full rounded-[var(--radius)] px-4",
        icon: "size-10 shrink-0 rounded-full p-0",
        "icon-lg": "size-[52px] shrink-0 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** `idle | loading | error` を `data-state` に写す。React はアニメーションを制御しない */
    state?: MotionState;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  state,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      data-state={state && state !== "idle" ? state : undefined}
      {...props}
    />
  );
}
