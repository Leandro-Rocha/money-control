"use client";

import { useState } from "react";
import { ArrowRightLeft, Eye, EyeOff, FileDown, LogOut, MoreHorizontal, PieChart, Repeat, Search, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandMark } from "@/components/ui/brand-mark";
import { usePrivacy } from "@/context/PrivacyContext";

interface MobileTopBarProps {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenTransfers: () => void;
  onOpenInsights: () => void;
  onOpenExport: () => void;
  onOpenRecurring: () => void;
  onLogout: () => void;
}

const iconBtn = "grid size-10 place-items-center rounded-full text-mut transition-colors hover:bg-hover hover:text-ink";

export function MobileTopBar(props: MobileTopBarProps) {
  const { isPrivate, togglePrivacy } = usePrivacy();
  const [moreOpen, setMoreOpen] = useState(false);

  const actions: { label: string; icon: typeof Search; run: () => void }[] = [
    { label: "Transferências", icon: ArrowRightLeft, run: props.onOpenTransfers },
    { label: "Análises de gastos", icon: PieChart, run: props.onOpenInsights },
    { label: "Recorrências", icon: Repeat, run: props.onOpenRecurring },
    { label: "Exportar período", icon: FileDown, run: props.onOpenExport },
    { label: "Sair da conta", icon: LogOut, run: props.onLogout },
  ];

  return (
    <header className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2 font-semibold tracking-tight text-ink">
        <BrandMark />
        Money Control
      </div>
      <div className="flex items-center">
        <button type="button" aria-label="Buscar" onClick={props.onOpenSearch} className={iconBtn}>
          <Search className="size-5" />
        </button>
        <button
          type="button"
          aria-label={isPrivate ? "Mostrar valores" : "Ocultar valores"}
          aria-pressed={isPrivate}
          onClick={togglePrivacy}
          className={iconBtn}
        >
          {isPrivate ? <EyeOff className="size-5 text-accent-ink" /> : <Eye className="size-5" />}
        </button>
        <button type="button" aria-label="Mais opções" onClick={() => setMoreOpen(true)} className={iconBtn}>
          <MoreHorizontal className="size-5" />
        </button>
        <button type="button" aria-label="Configurações" onClick={props.onOpenSettings} className={iconBtn}>
          <Settings className="size-5" />
        </button>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="p-0">
          <div className="border-b border-line px-5 py-4">
            <SheetTitle className="text-base">Mais opções</SheetTitle>
          </div>
          <ul className="flex flex-col p-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {actions.map(({ label, icon: Icon, run }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    run();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-ink transition-colors hover:bg-hover"
                >
                  <Icon className="size-5 text-mut" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </header>
  );
}
