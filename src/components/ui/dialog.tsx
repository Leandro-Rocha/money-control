"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const overlayClass =
  "fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(overlayClass, className)} {...props} />
));
DialogOverlay.displayName = "DialogOverlay";

export const dialogContentClass =
  "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-tile bg-tile text-ink shadow-tile-up duration-(--dur) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[.97] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[.97]";

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} className={cn(dialogContentClass, "max-w-lg p-6", className)} {...props}>
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-md p-1.5 text-mut transition-colors hover:bg-hover hover:text-ink"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-base font-semibold tracking-tight", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-mut", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";
