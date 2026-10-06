import * as React from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({
  as: Comp = "p",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "p" | "span" | "h2" | "h3" }) {
  return (
    <Comp
      className={cn("text-2xs font-medium uppercase tracking-[0.12em] text-mut", className)}
      {...props}
    />
  );
}
