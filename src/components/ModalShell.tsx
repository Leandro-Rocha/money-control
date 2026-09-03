"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ModalShellProps {
  /** Rendered when true (same pattern as TransferAssistantModal) */
  open?: boolean;
  onClose: () => void;
  /** Modal max-width class, e.g. "max-w-2xl" (default: "max-w-2xl") */
  maxWidth?: string;
  title: string;
  subtitle?: string;
  /** Icon rendered next to the title (e.g. <ArrowRightLeft className="w-5 h-5" />) */
  icon?: React.ReactNode;
  /** Color class applied to the title, e.g. "text-blue-600" */
  titleColor?: string;
  /** Slot for the footer row (buttons etc.) */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /**
   * When true (default), pressing Escape triggers onClose.
   * Pass false to override (e.g. ImportStagingModal has its own confirm logic).
   */
  escapeCloses?: boolean;
}

/**
 * Shared modal shell used by all full-screen modals.
 * Provides: backdrop, container, header (title + subtitle + X), scrollable body, footer.
 */
export function ModalShell({
  open = true,
  onClose,
  maxWidth = "max-w-2xl",
  title,
  subtitle,
  icon,
  titleColor = "text-foreground",
  footer,
  children,
  escapeCloses = true,
}: ModalShellProps) {
  useEffect(() => {
    if (!escapeCloses) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, escapeCloses]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div
        className={`bg-background rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-card shrink-0">
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${titleColor}`}>
              {icon}
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t bg-card shrink-0 flex items-center justify-between">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
