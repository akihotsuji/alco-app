import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/client/lib/utils.ts";

export const buttonVariants = cva(
  "inline-flex items-center justify-center font-semibold transition-[box-shadow,filter,background-color] duration-[120ms] ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-fg shadow-primary active:shadow-primary-pressed active:brightness-[0.92]",
        secondary: "bg-background text-foreground shadow-outset-sm active:shadow-inset-sm",
        destructive: "bg-danger text-danger-fg",
        ghost: "bg-transparent text-muted",
        link: "h-auto min-h-11 w-auto bg-transparent px-0 text-primary",
        icon: "bg-background text-foreground shadow-outset-sm active:shadow-inset-sm",
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
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
