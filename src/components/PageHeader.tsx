import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * Standard page header component.
 * Guarantees visual hierarchy, consistent margins, and responsive action placement.
 */
export function PageHeader({
  title,
  description,
  badge,
  icon,
  actions,
  children,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border/40 pb-5 mb-6 md:flex-row md:items-center md:justify-between",
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="text-muted-foreground shrink-0 flex items-center">
              {icon}
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}

      {children}
    </div>
  );
}
