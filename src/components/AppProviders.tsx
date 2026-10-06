"use client";

import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <ConfirmProvider>
        {children}
        <Toaster />
      </ConfirmProvider>
    </TooltipProvider>
  );
}
