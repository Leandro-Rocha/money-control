"use client";

import { useEffect, useState } from "react";
import { CreditCard, Database, Landmark, LineChart, Palette, Repeat, Shield, Tags, Wand2 } from "lucide-react";
import { Account, Category, RecurringEntryUI } from "@/lib/types";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

import { AppearanceTab } from "./AppearanceTab";
import { AccountsTab } from "./AccountsTab";
import { RecurringTab } from "./RecurringTab";
import { CategoriesTab } from "./CategoriesTab";
import { RulesTab } from "./RulesTab";
import { PrivacyTab } from "./PrivacyTab";
import { DataBackupsTab } from "./DataBackupsTab";
import { OpenFinanceTab } from "./OpenFinanceTab";
import { ForecastSettingsTab } from "./ForecastSettingsTab";

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  recurring: RecurringEntryUI[];
  onRefresh: () => void;
  initialAccountType?: "bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable" | null;
  /** Aba aberta ao abrir o painel (ex.: "recurring" pelo menu do celular). */
  initialTab?: SettingsTab | null;
}

export type SettingsTab =
  | "appearance"
  | "accounts"
  | "categories"
  | "recurring"
  | "forecast"
  | "rules"
  | "data-backups"
  | "privacy"
  | "open-finance";

const TABS: { id: SettingsTab; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "accounts", label: "Contas e Cartões", icon: CreditCard },
  { id: "open-finance", label: "Open Finance", icon: Landmark },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "recurring", label: "Recorrentes", icon: Repeat },
  { id: "forecast", label: "Previsão", icon: LineChart },
  { id: "rules", label: "Regras", icon: Wand2 },
  { id: "data-backups", label: "Dados & Backups", icon: Database },
  { id: "privacy", label: "Privacidade", icon: Shield },
];

export function SettingsDrawer({
  open,
  onOpenChange,
  accounts,
  categories,
  recurring,
  onRefresh,
  initialAccountType,
  initialTab,
}: SettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialAccountType ? "accounts" : (initialTab ?? "appearance"),
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open && initialAccountType) setActiveTab("accounts");
    else if (open && initialTab) setActiveTab(initialTab);
  }, [open, initialAccountType, initialTab]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 p-0",
          isMobile ? "h-[92vh] max-h-[92vh]" : "w-full sm:max-w-2xl lg:max-w-3xl",
        )}
      >
        <header className="border-b border-line px-5 pb-3 pt-5">
          <SheetTitle className="text-base">Configurações</SheetTitle>
          <SheetDescription className="text-xs">Aparência, contas, categorias, recorrências e segurança.</SheetDescription>
          <div role="tablist" aria-label="Seções" className="-mx-5 mt-4 flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors duration-(--dur-fast)",
                  activeTab === id ? "bg-accent-soft font-semibold text-accent-ink" : "text-mut hover:bg-hover hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </header>

        <div role="tabpanel" className="flex-1 overflow-y-auto p-5">
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "accounts" && (
            <AccountsTab
              accounts={accounts}
              onRefresh={onRefresh}
              initialType={initialAccountType}
              initialIsAdding={Boolean(initialAccountType)}
            />
          )}
          {activeTab === "open-finance" && <OpenFinanceTab accounts={accounts} onRefresh={onRefresh} />}
          {activeTab === "categories" && <CategoriesTab categories={categories} onRefresh={onRefresh} />}
          {activeTab === "recurring" && (
            <RecurringTab entries={recurring} accounts={accounts} categories={categories} onRefresh={onRefresh} />
          )}
          {activeTab === "forecast" && <ForecastSettingsTab onRefresh={onRefresh} />}
          {activeTab === "rules" && <RulesTab categories={categories} />}
          {activeTab === "data-backups" && <DataBackupsTab />}
          {activeTab === "privacy" && <PrivacyTab />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
