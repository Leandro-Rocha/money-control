import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--hover)_0%,var(--line)_50%,var(--hover)_100%)] bg-size-[200%_100%]",
        className,
      )}
    />
  );
}
