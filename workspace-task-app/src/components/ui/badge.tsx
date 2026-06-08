import { clsx } from "clsx";

export function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "border-white/10 bg-white/[0.045] text-foreground-muted",
        tone === "accent" && "border-accent/30 bg-accent/15 text-indigo-100",
        tone === "success" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
        tone === "warning" && "border-amber-400/25 bg-amber-400/10 text-amber-100",
        tone === "danger" && "border-red-400/25 bg-red-400/10 text-red-100"
      )}
    >
      {children}
    </span>
  );
}
