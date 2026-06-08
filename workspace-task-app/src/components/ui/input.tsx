import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "h-10 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm text-foreground placeholder:text-white/35 transition focus:border-accent focus:ring-2 focus:ring-accent/30",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "min-h-28 w-full resize-none rounded-lg border border-white/10 bg-[#0f0f12] px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-white/35 transition focus:border-accent focus:ring-2 focus:ring-accent/30",
        className
      )}
      {...props}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium uppercase tracking-widest text-foreground-muted">{children}</label>;
}
