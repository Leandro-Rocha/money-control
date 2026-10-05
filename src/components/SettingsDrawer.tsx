"use client";

import { useState, useEffect } from "react";
import { Settings, CreditCard, Tags, Repeat, Wand2, Shield, X, Database, Landmark, LineChart } from "lucide-react";
import { Account, Category, RecurringEntryUI } from "@/lib/types";
import { Button } from "@/components/ui/button";

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

export type SettingsTab = "accounts" | "categories" | "recurring" | "forecast" | "rules" | "data-backups" | "privacy" | "open-finance";
type TabType = SettingsTab;

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
  const [activeTab, setActiveTab] = useState<TabType>("accounts");

  useEffect(() => {
    if (open && initialAccountType) {
      setActiveTab("accounts");
    } else if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialAccountType, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);


  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => onOpenChange(false)} />
          <div className="bg-background w-full sm:max-w-2xl md:max-w-4xl rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col h-[85vh] min-h-[550px] max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 border-b">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold tracking-tight">Configurações</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie suas contas, categorias, despesas recorrentes e segurança.
                </p>
              </div>

          {/* Custom Tabs Navigation */}
          <div className="flex items-center gap-6 mt-6 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab("accounts")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "accounts"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Contas e Cartões
            </button>
            <button
              onClick={() => setActiveTab("open-finance")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "open-finance"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Landmark className="w-4 h-4" />
              Open Finance
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "categories"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tags className="w-4 h-4" />
              Categorias
            </button>
            <button
              onClick={() => setActiveTab("recurring")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "recurring"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Repeat className="w-4 h-4" />
              Recorrentes
            </button>
            <button
              onClick={() => setActiveTab("forecast")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "forecast"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <LineChart className="w-4 h-4" />
              Previsão
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "rules"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wand2 className="w-4 h-4" />
              Regras
            </button>
            <button
              onClick={() => setActiveTab("data-backups")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "data-backups"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Database className="w-4 h-4" />
              Dados & Backups
            </button>
            <button
              onClick={() => setActiveTab("privacy")}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "privacy"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield className="w-4 h-4" />
              Privacidade
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {activeTab === "accounts" && (
            <AccountsTab 
              accounts={accounts} 
              onRefresh={onRefresh} 
              initialType={initialAccountType}
              initialIsAdding={Boolean(initialAccountType)}
            />
          )}
          {activeTab === "open-finance" && (
            <OpenFinanceTab accounts={accounts} onRefresh={onRefresh} />
          )}
          {activeTab === "categories" && (
            <CategoriesTab categories={categories} onRefresh={onRefresh} />
          )}
          {activeTab === "recurring" && (
            <RecurringTab entries={recurring} accounts={accounts} categories={categories} onRefresh={onRefresh} />
          )}
          {activeTab === "forecast" && <ForecastSettingsTab onRefresh={onRefresh} />}
          {activeTab === "rules" && (
            <RulesTab categories={categories} />
          )}
          {activeTab === "data-backups" && (
            <DataBackupsTab />
          )}
          {activeTab === "privacy" && (
            <PrivacyTab />
          )}
        </div>
          </div>
        </div>
      )}
    </>
  );
}
