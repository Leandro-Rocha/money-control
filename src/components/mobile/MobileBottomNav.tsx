"use client";

import { useState } from "react";
import {
  Wallet,
  Landmark,
  Plus,
  MoreHorizontal,
  ArrowRightLeft,
  PieChart,
  FileDown,
  Repeat,
  LogOut,
  X,
  TrendingUp,
  Sun,
  ClipboardCheck,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/hooks/useDashboard";

const LEFT_TABS: { mode: ViewMode; label: string; icon: typeof Wallet }[] = [
  { mode: "today", label: "Hoje", icon: Sun },
  { mode: "cashflow", label: "Extrato", icon: Wallet },
];
const RIGHT_TABS: { mode: ViewMode; label: string; icon: typeof Wallet }[] = [
  { mode: "plan", label: "Plano", icon: TrendingUp },
];

interface MobileBottomNavProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenQuickAdd: () => void;
  onOpenTransfers: () => void;
  onOpenInsights: () => void;
  onOpenExport: () => void;
  onOpenRecurring: () => void;
  onLogout?: () => void;
}

export function MobileBottomNav({
  viewMode,
  onViewModeChange,
  onOpenQuickAdd,
  onOpenTransfers,
  onOpenInsights,
  onOpenExport,
  onOpenRecurring,
  onLogout,
}: MobileBottomNavProps) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Navegação móvel"
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-2 flex items-center justify-around pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {LEFT_TABS.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-1 transition-colors ${
              viewMode === mode ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] leading-none">{label}</span>
          </button>
        ))}

        {/* Botão Central Quick Add (FAB) */}
        <div className="relative -top-3">
          <button
            type="button"
            onClick={onOpenQuickAdd}
            className="w-13 h-13 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Lançar nova transação rápida"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

        {RIGHT_TABS.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-1 transition-colors ${
              viewMode === mode ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] leading-none">{label}</span>
          </button>
        ))}

        {/* Menu Mais */}
        <button
          type="button"
          onClick={() => setMoreMenuOpen(true)}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] leading-none">Mais</span>
        </button>
      </nav>

      {/* Sheet de Ações Secundárias ("Mais") */}
      <Sheet open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl max-h-[85vh]">
          <div className="p-4 border-b border-border">
            <SheetHeader className="flex flex-row items-center justify-between space-y-0">
              <SheetTitle className="text-base font-bold">Mais Opções</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full"
                onClick={() => setMoreMenuOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </SheetHeader>
          </div>

          <div className="p-4 grid grid-cols-2 gap-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <Button
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1 text-xs border-border"
              onClick={() => {
                setMoreMenuOpen(false);
                onOpenInsights();
              }}
            >
              <PieChart className="w-5 h-5 text-indigo-500" />
              <span>Análises (Gastos)</span>
            </Button>

            <Button
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1 text-xs border-border"
              onClick={() => {
                setMoreMenuOpen(false);
                onOpenTransfers();
              }}
            >
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <span>Transferências</span>
            </Button>

            <Button
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1 text-xs border-border"
              onClick={() => {
                setMoreMenuOpen(false);
                onViewModeChange("wealth");
              }}
            >
              <Landmark className="w-5 h-5 text-indigo-500" />
              <span>Patrimônio</span>
            </Button>

            <Button
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1 text-xs border-border"
              onClick={() => {
                setMoreMenuOpen(false);
                onViewModeChange("review");
              }}
            >
              <ClipboardCheck className="w-5 h-5 text-amber-500" />
              <span>Revisar</span>
            </Button>

            <Button
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1 text-xs border-border"
              onClick={() => {
                setMoreMenuOpen(false);
                onOpenRecurring();
              }}
            >
              <Repeat className="w-5 h-5 text-blue-500" />
              <span>Recorrências</span>
            </Button>

            <Button
              variant="outline"
              className="h-16 flex flex-col items-center justify-center gap-1 text-xs border-border"
              onClick={() => {
                setMoreMenuOpen(false);
                onOpenExport();
              }}
            >
              <FileDown className="w-5 h-5 text-emerald-500" />
              <span>Exportar Período</span>
            </Button>

            {onLogout && (
              <Button
                variant="outline"
                className="h-16 flex flex-col items-center justify-center gap-1 text-xs text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900/40"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onLogout();
                }}
              >
                <LogOut className="w-5 h-5 text-rose-500" />
                <span>Sair da Conta</span>
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
