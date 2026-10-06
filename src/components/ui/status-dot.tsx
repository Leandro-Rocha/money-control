import { cn } from "@/lib/utils";

export type DotStatus = "realized" | "projected" | "overdue";

const STYLE: Record<DotStatus, string> = {
  realized: "bg-accent",
  projected: "ring-[1.5px] ring-inset ring-faint",
  overdue: "bg-caution shadow-[0_0_0_3px_var(--caution-soft)]",
};

export function StatusDot({ status, label, className }: { status: DotStatus; label?: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", STYLE[status], className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
