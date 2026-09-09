import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  compact?: boolean;
}

/**
 * Standard empty state component.
 * Prevents blank canvases, explains the current state, and offers a clear next step.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  const renderedIcon = React.useMemo(() => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    if (typeof Icon === "function" || (typeof Icon === "object" && Icon !== null)) {
      const Comp = Icon as React.ComponentType<{ className?: string }>;
      return <Comp className="h-6 w-6" />;
    }
    return Icon as React.ReactNode;
  }, [Icon]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border/80 bg-card/50",
        compact ? "py-8 px-4" : "py-14 px-6",
        className
      )}
      {...props}
    >
      {renderedIcon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/80 text-muted-foreground mb-4">
          {renderedIcon}
        </div>
      )}

      <h3 className="text-base font-semibold text-foreground tracking-tight">
        {title}
      </h3>

      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
