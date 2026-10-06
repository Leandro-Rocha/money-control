"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalShellProps {
  /** Rendered when true (same pattern as TransferAssistantModal) */
  open?: boolean;
  onClose: () => void;
  /** Optional back handler (renders a back arrow in the header) */
  onBack?: () => void;
  /** Modal max-width class, e.g. "max-w-2xl" (default: "max-w-2xl") */
  maxWidth?: string;
  title: string;
  subtitle?: string;
  /** Icon rendered next to the title (e.g. <ArrowRightLeft className="w-5 h-5" /> or ArrowRightLeft) */
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  /** Color class applied to the title, e.g. "text-blue-600" */
  titleColor?: string;
  /** Slot for the footer row (buttons etc.) */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /**
   * When true (default), pressing Escape triggers onClose.
   * Pass false to override (e.g. ImportStagingModal has its own confirm logic).
   */
  escapeCloses?: boolean;
}

/**
 * Shared modal shell used by all full-screen modals, on top of Radix Dialog
 * (focus trap, aria, animação). Clique no fundo não fecha — como antes.
 */
export function ModalShell({
  open = true,
  onClose,
  onBack,
  maxWidth = "max-w-2xl",
  title,
  subtitle,
  icon,
  titleColor = "text-ink",
  footer,
  children,
  escapeCloses = true,
}: ModalShellProps) {
  const renderedIcon = (() => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const Comp = icon as React.ComponentType<{ className?: string }>;
      return <Comp className="w-5 h-5" />;
    }
    return icon as React.ReactNode;
  })();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        {/* Centraliza por flex, sem transform no conteúdo: popups em portal dentro
            dele (CategoryPicker) usam position: fixed relativo à tela. */}
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPrimitive.Content
          className={cn(
            "pointer-events-auto relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-tile bg-tile text-ink shadow-tile-up",
            "duration-(--dur) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            maxWidth,
          )}
          onEscapeKeyDown={(e) => {
            if (!escapeCloses) e.preventDefault();
          }}
          onInteractOutside={(e) => e.preventDefault()}
          {...(subtitle ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
            <div className="flex items-center gap-2">
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="-ml-1.5 h-8 w-8 rounded-full text-mut hover:text-ink"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <DialogPrimitive.Title className={cn("flex items-center gap-2 text-lg font-semibold tracking-tight", titleColor)}>
                  {renderedIcon}
                  {title}
                </DialogPrimitive.Title>
                {subtitle && (
                  <DialogPrimitive.Description className="mt-0.5 text-sm text-mut">{subtitle}</DialogPrimitive.Description>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full" aria-label="Fechar">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto bg-bg/50 p-6">{children}</div>

          {footer && (
            <div className="flex shrink-0 items-center justify-between border-t border-line px-6 py-4">{footer}</div>
          )}
        </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
