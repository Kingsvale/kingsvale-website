import { initials } from "@/lib/strings";

export function Avatar({
  name,
  email,
  color,
  size = "md"
}: {
  name: string;
  email?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dimension = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-11 w-11 text-sm" : "h-8 w-8 text-xs";

  return (
    <div
      className={`${dimension} grid shrink-0 place-items-center rounded-full border border-white/10 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]`}
      style={{ background: color || "#5E6AD2" }}
      title={name || email}
    >
      {initials(name || email || "?")}
    </div>
  );
}
