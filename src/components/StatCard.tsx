import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface StatCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  variant?: "default" | "income" | "expense" | "warning";
}

const variantStyles = {
  default: "text-foreground",
  income: "text-emerald-600 dark:text-emerald-400",
  expense: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
};

/**
 * Standard metric/KPI card for financial statistics.
 * Automatically ensures tabular font numerals and uniform padding/hierarchy.
 */
export function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  variant = "default",
  className,
  ...props
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden transition-colors", className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold tracking-tight tabular-nums",
            variantStyles[variant]
          )}
        >
          {value}
        </div>
        {(description || trend) && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {trend && (
              <span
                className={cn(
                  "font-medium",
                  trend.isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {trend.value}
              </span>
            )}
            {trend?.label && <span>{trend.label}</span>}
            {description && !trend && <span>{description}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
