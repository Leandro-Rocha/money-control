import { cn } from "@/lib/utils";

/** Marca do app: quadrado no acento com um traço claro embaixo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-block size-4 shrink-0 rounded-[5px] bg-accent after:absolute after:inset-x-1 after:bottom-1 after:h-[3px] after:rounded-sm after:bg-white/85",
        className,
      )}
    />
  );
}
