"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

/**
 * Dica curta. No mouse abre no hover; no toque, um toque abre e outro fecha
 * (Radix não abre tooltip por toque sozinho).
 */
export function Hint({
  label,
  children,
  side = "top",
}: {
  label: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const [open, setOpen] = React.useState(false);
  const touch = React.useRef(false);
  const skipClose = React.useRef(false);
  return (
    <TooltipPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && skipClose.current) {
          skipClose.current = false;
          return;
        }
        setOpen(o);
      }}
      delayDuration={300}
    >
      <TooltipPrimitive.Trigger
        asChild
        onPointerDown={(e) => {
          skipClose.current = false;
          touch.current = e.pointerType === "touch";
          if (touch.current) setOpen((o) => !o);
        }}
        onClick={() => {
          // Radix fecha no click; o click que segue o toque não deve desfazer o toque.
          // Sem preventDefault, para não bloquear link ou submit do filho.
          skipClose.current = touch.current;
        }}
      >
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 max-w-64 rounded-md bg-ink px-2 py-1 text-xs text-tile shadow-tile-up",
            "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
