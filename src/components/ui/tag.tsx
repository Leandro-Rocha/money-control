import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type TagVariant = "neutral" | "projected" | "overdue" | "reimbursable" | "bill" | "accent";

const tagVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-2xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-hover text-mut",
        projected: "border border-dashed border-edge text-mut",
        overdue: "bg-caution-soft text-caution-ink",
        reimbursable: "border border-edge text-ink",
        bill: "bg-ink text-tile",
        accent: "bg-accent-soft text-accent-ink",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Tag({
  variant,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: TagVariant }) {
  return <span className={cn(tagVariants({ variant }), className)} {...props} />;
}
