import { cn } from "@/lib/utils";

export function LiveChip({
  at,
  syncing = false,
  className,
}: {
  at: Date | string | null;
  syncing?: boolean;
  className?: string;
}) {
  const time = at
    ? new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const text = syncing ? "sincronizando…" : time ? `ao vivo · ${time}` : "sem sincronização";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent-ink",
        !time && !syncing && "bg-hover text-mut",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full bg-accent", (time || syncing) && "animate-live-pulse", !time && !syncing && "bg-faint")}
      />
      {text}
    </span>
  );
}
