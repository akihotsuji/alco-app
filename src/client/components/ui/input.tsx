import type { ComponentProps } from "react";
import { cn } from "@/client/lib/utils.ts";

/** React 19 では `ref` を通常の props として受け取れる（年齢確認の欄送りで使う） */
export type InputProps = ComponentProps<"input">;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "h-12 w-full rounded-[var(--radius)] border-none bg-background px-4 text-base text-foreground shadow-inset-sm outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
