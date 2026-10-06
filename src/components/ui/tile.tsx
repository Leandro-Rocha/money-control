import * as React from "react";
import { cn } from "@/lib/utils";

export interface TileProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article" | "li" | "aside";
  flat?: boolean;
}

export function Tile({ as: Comp = "section", flat = false, className, ...props }: TileProps) {
  return (
    <Comp
      className={cn(
        "rounded-tile bg-tile p-4 shadow-tile",
        !flat &&
          "transition-[translate,box-shadow] duration-(--dur) ease-out hover:-translate-y-0.5 hover:shadow-tile-up",
        className,
      )}
      {...props}
    />
  );
}
