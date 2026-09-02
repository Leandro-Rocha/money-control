"use client";

import { useState, useEffect } from "react";
import { Settings, CreditCard, Tags, Repeat, Wand2 } from "lucide-react";
import { Account, Category, RecurringEntryUI } from "@/lib/types";

import { AccountsTab } from "./AccountsTab";
import { RecurringTab } from "./RecurringTab";
import { CategoriesTab } from "./CategoriesTab";
import { RulesTab } from "./RulesTab";

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  recurring: RecurringEntryUI[];
  onRefresh: () => void;
}

type TabType = "accounts" | "categories" | "recurring" | "rules";

export function SettingsDrawer({
  open,
  onOpenChange,
  accounts,
  categories,
  recurring,
  onRefresh,
}: SettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("accounts");

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
          <div className="bg-background w-full sm:max-w-xl md:max-w-2xl rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col h-[75vh] min-h-[500px] max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 border-b">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold tracking-tight">Configurações</h2>
                  </div>
                  <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-slate-100 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie suas contas, categorias e despesas recorrentes.
                </p>
              </div>

          {/* Custom Tabs Navigation */}
          <div className="flex items-center gap-6 mt-6">
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
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {activeTab === "accounts" && (
            <AccountsTab accounts={accounts} onRefresh={onRefresh} />
          )}
          {activeTab === "categories" && (
            <CategoriesTab categories={categories} onRefresh={onRefresh} />
          )}
          {activeTab === "recurring" && (
            <RecurringTab entries={recurring} accounts={accounts} categories={categories} onRefresh={onRefresh} />
          )}
          {activeTab === "rules" && (
            <RulesTab categories={categories} />
          )}
        </div>
          </div>
        </div>
      )}
    </>
  );
}
