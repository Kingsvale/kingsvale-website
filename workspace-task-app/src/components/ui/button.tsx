import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, variant = "secondary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "icon" && "h-9 w-9 p-0",
        variant === "primary" &&
          "bg-accent text-white shadow-accent hover:bg-accent-bright hover:shadow-[0_0_0_1px_rgba(94,106,210,0.7),0_8px_22px_rgba(94,106,210,0.32),inset_0_1px_0_0_rgba(255,255,255,0.24)]",
        variant === "secondary" &&
          "bg-white/[0.055] text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] hover:bg-white/[0.085]",
        variant === "ghost" && "text-foreground-muted hover:bg-white/[0.055] hover:text-foreground",
        variant === "danger" && "bg-red-500/14 text-red-100 hover:bg-red-500/22",
        className
      )}
      {...props}
    />
  );
}
