"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Pencil, Check, X, Building, CreditCard, TrendingUp, Receipt, Archive, ArchiveRestore, ChevronDown, ChevronRight, HandCoins, RefreshCw, AlertCircle, PiggyBank, Layers, KeyRound } from "lucide-react";
import { Account } from "@/lib/types";
import { createAccount, updateAccount, deleteAccount, archiveAccount, restoreAccount } from "@/lib/actions/accounts";
import {
  fetchPluggyAccountsForItem,
  getConnectedPluggyItemsAction,
  fetchPluggyInvestmentsForItemAction,
  ConnectedPluggyItem,
  PluggyInvestmentSummary,
} from "@/lib/actions/pluggy";
import type { PluggyAccount } from "@/lib/integrations/pluggy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ModalShell } from "@/components/ModalShell";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface AccountsTabProps {
  accounts: Account[];
  onRefresh: () => void;
  initialType?: "bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable" | null;
  initialIsAdding?: boolean;
}

function formatPluggyAccountBadge(pluggyAccountId: string | null | undefined): string {
  if (!pluggyAccountId) return "Pluggy Custódia Total";
  if (pluggyAccountId.startsWith("group:name:")) {
    return `Pluggy Grupo: ${pluggyAccountId.replace("group:name:", "")}`;
  }
  if (
    pluggyAccountId.startsWith("group:type:MUTUAL_FUND") ||
    pluggyAccountId.startsWith("group:subtype:MUTUAL_FUND")
  ) {
    return "Pluggy Grupo: Todos os Fundos";
  }
  if (pluggyAccountId.startsWith("group:subtype:TREASURY")) {
    return "Pluggy Grupo: Todo o Tesouro Direto";
  }
  if (pluggyAccountId.startsWith("group:subtype:CDB")) {
    return "Pluggy Grupo: Todos os CDBs";
  }
  if (pluggyAccountId.startsWith("group:subtype:")) {
    return `Pluggy Grupo: ${pluggyAccountId.replace("group:subtype:", "")}`;
  }
  if (pluggyAccountId.startsWith("group:type:")) {
    return `Pluggy Grupo: ${pluggyAccountId.replace("group:type:", "")}`;
  }
  if (pluggyAccountId.includes(",")) {
    const count = pluggyAccountId.split(",").map((s) => s.trim()).filter(Boolean).length;
    return `Pluggy Seleção: ${count} ativos`;
  }
  return `Pluggy Ativo: ${pluggyAccountId.slice(0, 8)}...`;
}

export function AccountsTab({ accounts, onRefresh, initialType, initialIsAdding }: AccountsTabProps) {
  const [isAdding, setIsAdding] = useState(Boolean(initialIsAdding || initialType));
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"bank_account" | "credit_card" | "investment" | "financing" | "loan_receivable">(initialType || "bank_account");

  useEffect(() => {
    if (initialType) {
      setNewType(initialType);
      setIsAdding(true);
    } else if (initialIsAdding !== undefined) {
      setIsAdding(initialIsAdding);
    }
  }, [initialType, initialIsAdding]);
  const [newColor, setNewColor] = useState("#f97316"); // orange-500 default
  const [newDueDay, setNewDueDay] = useState<number | "">("");
  const [newPaymentAccountId, setNewPaymentAccountId] = useState<number | "">("");

  // Bank account initial balance & Pluggy
  const [newInitialBankBalance, setNewInitialBankBalance] = useState<number | "">("");
  const [newPluggyAccountId, setNewPluggyAccountId] = useState("");
  const [newPluggyItemId, setNewPluggyItemId] = useState("");
  const [newPluggyCredentialId, setNewPluggyCredentialId] = useState("");

  // Financing specific fields
  const [newFinancingTotal, setNewFinancingTotal] = useState<number | "">("");
  const [newFinancingRemaining, setNewFinancingRemaining] = useState<number | "">("");
  const [newFinancingInstallmentsTotal, setNewFinancingInstallmentsTotal] = useState<number | "">("");
  const [newFinancingInstallmentsPaid, setNewFinancingInstallmentsPaid] = useState<number | "">("");
  const [newFinancingInstallmentAmount, setNewFinancingInstallmentAmount] = useState<number | "">("");
  
  // Investment specific fields
  const [newInitialInvestmentBalance, setNewInitialInvestmentBalance] = useState<number | "">("");
  const [showArchived, setShowArchived] = useState(false);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<Account["type"]>("bank_account");
  const [editDueDay, setEditDueDay] = useState<number | "">("");
  const [editPaymentAccountId, setEditPaymentAccountId] = useState<number | "">("");
  const [editFinancingRemaining, setEditFinancingRemaining] = useState<number | "">("");
  const [editFinancingPaid, setEditFinancingPaid] = useState<number | "">("");
  const [editFinancingInstallmentAmount, setEditFinancingInstallmentAmount] = useState<number | "">("");
  const [editFinancingInstallmentsTotal, setEditFinancingInstallmentsTotal] = useState<number | "">("");
  const [editPluggyAccountId, setEditPluggyAccountId] = useState("");
  const [editPluggyItemId, setEditPluggyItemId] = useState("");
  const [editPluggyCredentialId, setEditPluggyCredentialId] = useState("");

  // Pluggy discovery modal state
  const [isPluggyPickerOpen, setIsPluggyPickerOpen] = useState(false);
  const [pluggyPickerTarget, setPluggyPickerTarget] = useState<"edit" | "create">("edit");
  const [pickerActiveTab, setPickerActiveTab] = useState<"accounts" | "investments">("accounts");
  const [pickerItemId, setPickerItemId] = useState("");
  const [pickerCredentialId, setPickerCredentialId] = useState("");
  const [pickerCredentialLabel, setPickerCredentialLabel] = useState("");
  const [connectedItemsList, setConnectedItemsList] = useState<ConnectedPluggyItem[]>([]);
  const [pluggyAccountsList, setPluggyAccountsList] = useState<PluggyAccount[]>([]);
  const [pluggyInvestmentsList, setPluggyInvestmentsList] = useState<PluggyInvestmentSummary[]>([]);
  const [isSearchingPluggy, setIsSearchingPluggy] = useState(false);
  const [pluggySearchError, setPluggySearchError] = useState<string | null>(null);
  const [showZeroedInvestments, setShowZeroedInvestments] = useState(false);
  const [expandedGroupNames, setExpandedGroupNames] = useState<Record<string, boolean>>({});
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([]);

  const toggleContractSelection = (id: string) => {
    setSelectedContractIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleGroupContractSelection = (ids: string[]) => {
    setSelectedContractIds((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !ids.includes(id));
      } else {
        const toAdd = ids.filter((id) => !prev.includes(id));
        return [...prev, ...toAdd];
      }
    });
  };

  const toggleGroupExpanded = (groupName: string) => {
    setExpandedGroupNames((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const [activeFilter, setActiveFilter] = useState<"all" | "banks" | "assets">("all");
  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirmar",
    action: async () => {}
  });

  const activeAccounts = accounts.filter((a) => a.isActive !== 0);
  const banksCount = activeAccounts.filter(a => a.type === 'bank_account' || a.type === 'credit_card').length;
  const assetsCount = activeAccounts.filter(a => a.type === 'investment' || a.type === 'financing' || a.type === 'loan_receivable').length;
  
  const filteredAccounts = activeAccounts.filter(acc => {
    if (activeFilter === "banks") return acc.type === 'bank_account' || acc.type === 'credit_card';
    if (activeFilter === "assets") return acc.type === 'investment' || acc.type === 'financing' || acc.type === 'loan_receivable';
    return true;
  });

  const openPluggyPicker = async (target: "edit" | "create") => {
    setPluggyPickerTarget(target);
    const initialItem = target === "edit" ? editPluggyItemId : newPluggyItemId;
    const initialAccountId = target === "edit" ? editPluggyAccountId : newPluggyAccountId;
    const initialCredId = target === "edit" ? editPluggyCredentialId : newPluggyCredentialId;
    setPickerCredentialId(initialCredId || "");
    setPickerCredentialLabel("");
    if (initialAccountId && !initialAccountId.startsWith("group:") && initialAccountId.includes(",")) {
      setSelectedContractIds(initialAccountId.split(",").map((s) => s.trim()).filter(Boolean));
    } else {
      setSelectedContractIds([]);
    }
    setIsPluggyPickerOpen(true);
    setPluggySearchError(null);
    setPluggyAccountsList([]);
    setPluggyInvestmentsList([]);

    const currentAccountName = (
      target === "edit"
        ? accounts.find((a) => a.id === editingId)?.name || ""
        : newName
    ).toLowerCase();

    const currentType = target === "edit"
      ? (editType || accounts.find((a) => a.id === editingId)?.type)
      : newType;

    const isExplicitInvestment =
      currentType === "investment" ||
      currentAccountName.includes("caixinha") ||
      currentAccountName.includes("fundo") ||
      currentAccountName.includes("cdb") ||
      currentAccountName.includes("tesouro") ||
      currentAccountName.includes("kisu");

    setPickerActiveTab(isExplicitInvestment ? "investments" : "accounts");

    // Busca conexões Pluggy já existentes no sistema
    let targetItemId = initialItem;
    const itemsRes = await getConnectedPluggyItemsAction();
    if (itemsRes.success && itemsRes.items.length > 0) {
      setConnectedItemsList(itemsRes.items);
      if (!targetItemId) {
        const matchedItem = itemsRes.items.find((item) =>
          currentAccountName && (
            currentAccountName.includes(item.name.toLowerCase()) ||
            item.accounts.some((acc) => currentAccountName.includes(acc.toLowerCase()))
          )
        );

        targetItemId = matchedItem ? matchedItem.id : itemsRes.items[0].id;
      }
      const matched = itemsRes.items.find((item) => item.id === targetItemId);
      if (matched) {
        if (matched.credentialId) setPickerCredentialId(matched.credentialId);
        if (matched.credentialLabel) setPickerCredentialLabel(matched.credentialLabel);
      }
    } else {
      setConnectedItemsList([]);
    }

    setPickerItemId(targetItemId);
    handleSearchPluggyAccounts(targetItemId);
  };

  const handleSearchPluggyAccounts = async (itemIdToUse?: string) => {
    setIsSearchingPluggy(true);
    setPluggySearchError(null);
    try {
      const targetId = itemIdToUse !== undefined ? itemIdToUse : pickerItemId;
      if (!targetId || !targetId.trim()) {
        setPluggyAccountsList([]);
        setPluggyInvestmentsList([]);
        setIsSearchingPluggy(false);
        return;
      }

      const [accountsRes, investmentsRes] = await Promise.all([
        fetchPluggyAccountsForItem(targetId),
        fetchPluggyInvestmentsForItemAction(targetId),
      ]);

      const credId =
        (accountsRes.success ? accountsRes.credentialId : "") ||
        (investmentsRes.success ? investmentsRes.credentialId : "") ||
        "";
      const credLabel =
        (accountsRes.success ? accountsRes.credentialLabel : "") ||
        (investmentsRes.success ? investmentsRes.credentialLabel : "") ||
        "";
      if (credId) {
        setPickerCredentialId(credId);
        setPickerCredentialLabel(credLabel);
      }

      if (accountsRes.success) {
        setPluggyAccountsList(accountsRes.accounts || []);
      } else {
        setPluggyAccountsList([]);
      }

      if (investmentsRes.success) {
        setPluggyInvestmentsList(investmentsRes.investments || []);
      } else {
        setPluggyInvestmentsList([]);
      }

      if (!accountsRes.success && !investmentsRes.success) {
        setPluggySearchError(accountsRes.error || investmentsRes.error || "Erro ao consultar dados no Pluggy.");
      }
    } catch (err: any) {
      setPluggySearchError(err?.message || "Erro inesperado ao consultar dados no Pluggy.");
      setPluggyAccountsList([]);
      setPluggyInvestmentsList([]);
    } finally {
      setIsSearchingPluggy(false);
    }
  };

  const handleSelectPluggyAccount = (item: PluggyAccount) => {
    const isCofrinho =
      item.subtype === "COFRINHO_RESERVA" ||
      item.name.toLowerCase().includes("reserva") ||
      item.name.toLowerCase().includes("cofrinho");
    const matchedCred = pickerCredentialId || connectedItemsList.find((c) => c.id === item.itemId)?.credentialId || "";

    if (pluggyPickerTarget === "edit") {
      setEditPluggyAccountId(item.id);
      setEditPluggyItemId(item.itemId);
      if (matchedCred) setEditPluggyCredentialId(matchedCred);
      if (isCofrinho) {
        setEditType("investment");
      }
    } else {
      setNewPluggyAccountId(item.id);
      setNewPluggyItemId(item.itemId);
      if (matchedCred) setNewPluggyCredentialId(matchedCred);
      if (isCofrinho) {
        setNewType("investment");
      }
      if (!newName.trim()) {
        setNewName(item.name);
      }
    }
    setIsPluggyPickerOpen(false);
  };

  const handleSelectPluggyInvestment = (inv: PluggyInvestmentSummary) => {
    const matchedCred = pickerCredentialId || connectedItemsList.find((c) => c.id === pickerItemId.trim())?.credentialId || "";
    if (pluggyPickerTarget === "edit") {
      setEditPluggyItemId(pickerItemId.trim());
      setEditPluggyAccountId(inv.id);
      if (matchedCred) setEditPluggyCredentialId(matchedCred);
      setEditType("investment");
    } else {
      setNewPluggyItemId(pickerItemId.trim());
      setNewPluggyAccountId(inv.id);
      if (matchedCred) setNewPluggyCredentialId(matchedCred);
      setNewType("investment");
      if (!newName.trim()) {
        setNewName(inv.name);
      }
    }
    setIsPluggyPickerOpen(false);
  };

  const handleSelectPluggyCustodiaTotal = () => {
    const matchedCred = pickerCredentialId || connectedItemsList.find((c) => c.id === pickerItemId.trim())?.credentialId || "";
    if (pluggyPickerTarget === "edit") {
      setEditPluggyItemId(pickerItemId.trim());
      setEditPluggyAccountId("");
      if (matchedCred) setEditPluggyCredentialId(matchedCred);
      setEditType("investment");
    } else {
      setNewPluggyItemId(pickerItemId.trim());
      setNewPluggyAccountId("");
      if (matchedCred) setNewPluggyCredentialId(matchedCred);
      setNewType("investment");
    }
    setIsPluggyPickerOpen(false);
  };

  const handleSelectPluggyGroup = (groupKey: string, defaultName: string) => {
    const matchedCred = pickerCredentialId || connectedItemsList.find((c) => c.id === pickerItemId.trim())?.credentialId || "";
    if (pluggyPickerTarget === "edit") {
      setEditPluggyItemId(pickerItemId.trim());
      setEditPluggyAccountId(groupKey);
      if (matchedCred) setEditPluggyCredentialId(matchedCred);
      setEditType("investment");
    } else {
      setNewPluggyItemId(pickerItemId.trim());
      setNewPluggyAccountId(groupKey);
      if (matchedCred) setNewPluggyCredentialId(matchedCred);
      setNewType("investment");
      if (!newName.trim()) {
        setNewName(defaultName);
      }
    }
    setIsPluggyPickerOpen(false);
  };

  const handleSelectManualIds = (selectedIds: string[], institutionName: string) => {
    if (selectedIds.length === 0) return;
    const joined = selectedIds.join(",");
    const suggestedName = `${institutionName} (${selectedIds.length} ${selectedIds.length === 1 ? "ativo" : "ativos"})`;
    const matchedCred = pickerCredentialId || connectedItemsList.find((c) => c.id === pickerItemId.trim())?.credentialId || "";

    if (pluggyPickerTarget === "edit") {
      setEditPluggyItemId(pickerItemId.trim());
      setEditPluggyAccountId(joined);
      if (matchedCred) setEditPluggyCredentialId(matchedCred);
      setEditType("investment");
    } else {
      setNewPluggyItemId(pickerItemId.trim());
      setNewPluggyAccountId(joined);
      if (matchedCred) setNewPluggyCredentialId(matchedCred);
      setNewType("investment");
      if (!newName.trim()) {
        setNewName(suggestedName);
      }
    }
    setIsPluggyPickerOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const isContract = newType === 'financing' || newType === 'loan_receivable';
    const isPluggyType = newType === 'bank_account' || newType === 'credit_card' || newType === 'investment';
    await createAccount({ 
      name: newName, 
      type: newType, 
      color: newColor,
      dueDay: (newType === 'credit_card' || isContract) ? (newDueDay || null) : null,
      defaultPaymentAccountId: newType === 'credit_card' ? (newPaymentAccountId || null) : null,
      financingTotalAmount: isContract && newFinancingTotal !== "" ? Number(newFinancingTotal) : null,
      financingRemainingAmount: isContract && newFinancingRemaining !== "" ? Number(newFinancingRemaining) : (isContract && newFinancingTotal !== "" ? Number(newFinancingTotal) : null),
      financingInstallmentsTotal: isContract && newFinancingInstallmentsTotal !== "" ? Number(newFinancingInstallmentsTotal) : null,
      financingInstallmentsPaid: isContract && newFinancingInstallmentsPaid !== "" ? Number(newFinancingInstallmentsPaid) : 0,
      financingInstallmentAmount: isContract && newFinancingInstallmentAmount !== "" ? Number(newFinancingInstallmentAmount) : null,
      initialInvestmentBalance: newType === 'investment' && newInitialInvestmentBalance !== "" ? Number(newInitialInvestmentBalance) : null,
      initialBalance: newType === 'bank_account' && newInitialBankBalance !== "" ? Number(newInitialBankBalance) : null,
      pluggyAccountId: isPluggyType && newPluggyAccountId.trim() ? newPluggyAccountId.trim() : null,
      pluggyItemId: isPluggyType && newPluggyItemId.trim() ? newPluggyItemId.trim() : null,
      pluggyCredentialId: isPluggyType && newPluggyCredentialId.trim() ? newPluggyCredentialId.trim() : null,
    });

    setNewName("");
    setNewType("bank_account");
    setNewDueDay("");
    setNewPaymentAccountId("");
    setNewInitialBankBalance("");
    setNewPluggyAccountId("");
    setNewPluggyItemId("");
    setNewPluggyCredentialId("");
    setNewFinancingTotal("");
    setNewFinancingRemaining("");
    setNewFinancingInstallmentsTotal("");
    setNewFinancingInstallmentsPaid("");
    setNewFinancingInstallmentAmount("");
    setNewInitialInvestmentBalance("");
    setIsAdding(false);
    onRefresh();
  };

  const handleArchive = (id: number) => {
    setConfirmDialogState({
      isOpen: true,
      title: "Arquivar conta",
      description: "Arquivar esta conta? Ela não aparecerá no fluxo ativo de meses atuais/futuros, mas todo o seu histórico passado será preservado.",
      confirmLabel: "Arquivar",
      action: async () => {
        await archiveAccount(id);
        onRefresh();
      }
    });
  };

  const handleRestore = async (id: number) => {
    await restoreAccount(id);
    onRefresh();
  };

  const handleDelete = (id: number) => {
    setConfirmDialogState({
      isOpen: true,
      title: "Excluir permanentemente",
      description: "ATENÇÃO: Excluir definitivamente apagará todas as transações desta conta no banco de dados. Para manter o histórico, use 'Arquivar'. Deseja realmente excluir permanentemente?",
      confirmLabel: "Excluir",
      action: async () => {
        await deleteAccount(id);
        onRefresh();
      }
    });
  };

  const handleUpdate = async (id: number, data: any) => {
    await updateAccount(id, data);
    onRefresh();
  };

  const startEdit = (acc: Account) => {
    setEditingId(acc.id);
    setEditName(acc.name);
    setEditType(acc.type);
    setEditDueDay(acc.dueDay || "");
    setEditPaymentAccountId(acc.defaultPaymentAccountId || "");
    setEditFinancingRemaining(acc.financingRemainingAmount ?? "");
    setEditFinancingPaid(acc.financingInstallmentsPaid ?? "");
    setEditFinancingInstallmentAmount(acc.financingInstallmentAmount ?? "");
    setEditFinancingInstallmentsTotal(acc.financingInstallmentsTotal ?? "");
    setEditPluggyAccountId(acc.pluggyAccountId || "");
    setEditPluggyItemId(acc.pluggyItemId || "");
    setEditPluggyCredentialId(acc.pluggyCredentialId || "");
  };

  const saveEdit = async (acc: Account) => {
    if (editingId && editName.trim()) {
      const effectiveType = editType || acc.type;
      const isContract = effectiveType === 'financing' || effectiveType === 'loan_receivable';
      const patch: any = { 
        name: editName,
        type: effectiveType,
        dueDay: (effectiveType === 'credit_card' || isContract) ? (editDueDay || null) : null,
        defaultPaymentAccountId: effectiveType === 'credit_card' ? (editPaymentAccountId || null) : null,
      };
      if (effectiveType === 'bank_account' || effectiveType === 'credit_card' || effectiveType === 'investment') {
        patch.pluggyAccountId = editPluggyAccountId.trim() || null;
        patch.pluggyItemId = editPluggyItemId.trim() || null;
        patch.pluggyCredentialId = editPluggyCredentialId.trim() || null;
      }
      if (isContract) {
        if (editFinancingRemaining !== "") patch.financingRemainingAmount = Number(editFinancingRemaining);
        if (editFinancingPaid !== "") patch.financingInstallmentsPaid = Number(editFinancingPaid);
        if (editFinancingInstallmentAmount !== "") patch.financingInstallmentAmount = Number(editFinancingInstallmentAmount);
        if (editFinancingInstallmentsTotal !== "") patch.financingInstallmentsTotal = Number(editFinancingInstallmentsTotal);
      }
      await handleUpdate(editingId, patch);
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Contas</h2>
          <p className="text-sm text-slate-500">Gerencie suas contas, cartões, investimentos e dívidas</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"}>
          {isAdding ? "Cancelar" : <><Plus className="w-4 h-4 mr-2" /> Nova Conta</>}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="p-4 bg-slate-50 border rounded-lg space-y-4 animate-in fade-in slide-in-from-top-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome da Conta / Contrato</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Nubank, Financiamento Caixa..." autoFocus />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Tipo</label>
              <select 
                value={newType} 
                onChange={(e: any) => setNewType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
              >
                <option value="bank_account">Conta Corrente (Fluxo)</option>
                <option value="credit_card">Cartão de Crédito (Fluxo)</option>
                <option value="investment">Investimento / Caixinha (Patrimônio)</option>
                <option value="loan_receivable">Crédito a Receber (Patrimônio)</option>
                <option value="financing">Financiamento / Dívida (Patrimônio)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Cor de Identificação</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-9 h-9 rounded cursor-pointer border-none p-0" />
                <span className="text-xs text-muted-foreground">{newColor}</span>
              </div>
            </div>
          </div>
          
          {newType === 'credit_card' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Dia de Vencimento</label>
                <Input type="number" min={1} max={31} value={newDueDay} onChange={e => setNewDueDay(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 5" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Conta para Pagamento</label>
                <select 
                  value={newPaymentAccountId} 
                  onChange={e => setNewPaymentAccountId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                >
                  <option value="">Selecione...</option>
                  {accounts.filter(a => a.type === 'bank_account').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {newType === 'bank_account' && (
            <div className="p-3 bg-card border border-border rounded-lg space-y-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Saldo de Partida</h4>
              <div>
                <label className="text-xs font-medium mb-1 block">Saldo Inicial de Abertura (R$)</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={newInitialBankBalance} 
                  onChange={e => setNewInitialBankBalance(e.target.value ? Number(e.target.value) : "")} 
                  placeholder="Ex: 5000.00" 
                  className="font-mono tabular-nums"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Opcional. Se esta conta já possui saldo na vida real, informe o valor para iniciar o saldo acumulado.
                </p>
              </div>
            </div>
          )}

          {(newType === 'bank_account' || newType === 'credit_card') && (
            <div className="p-3 bg-card border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Sincronização Bancária (Pluggy)</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openPluggyPicker("create")}
                  className="h-7 text-xs gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Buscar no Pluggy
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Pluggy Account ID</label>
                  <Input 
                    value={newPluggyAccountId} 
                    onChange={e => setNewPluggyAccountId(e.target.value)} 
                    placeholder="Ex: 5b4c10..." 
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    ID da conta ou cartão no Pluggy para importação automática.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Pluggy Item ID</label>
                  <Input 
                    value={newPluggyItemId} 
                    onChange={e => setNewPluggyItemId(e.target.value)} 
                    placeholder="Ex: 9a2f3e... (opcional)" 
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    ID do item/conexão no Pluggy (opcional para rastreabilidade).
                  </p>
                </div>
              </div>
            </div>
          )}

          {newType === 'investment' && (
            <>
              <div className="p-3 bg-card border border-border rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Saldo de Partida</h4>
                <div>
                  <label className="text-xs font-medium mb-1 block">Saldo Inicial em Custódia (R$)</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={newInitialInvestmentBalance} 
                    onChange={e => setNewInitialInvestmentBalance(e.target.value ? Number(e.target.value) : "")} 
                    placeholder="Ex: 50000.00" 
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Opcional. Informe o valor que você já possui investido nesta conta para iniciar o patrimônio.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-card border border-border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Sincronização de Custódia (Pluggy)</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openPluggyPicker("create")}
                    className="h-7 text-xs gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Buscar no Pluggy
                  </Button>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Pluggy Item ID (Conexão)</label>
                  <Input 
                    value={newPluggyItemId} 
                    onChange={e => setNewPluggyItemId(e.target.value)} 
                    placeholder="Ex: 9a2f3e... (ID da conexão Pluggy)" 
                    className="font-mono text-xs"
                  />
                  {newPluggyAccountId && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground font-mono">
                      <span>Ativo vinculado:</span>
                      <Badge variant="outline" className="text-[10px] font-mono text-primary">
                        {formatPluggyAccountBadge(newPluggyAccountId)}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => setNewPluggyAccountId("")}
                        className="text-muted-foreground hover:text-destructive text-[11px] underline"
                        title="Remover filtro e sincronizar custódia total"
                      >
                        (remover e usar total)
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {newPluggyAccountId
                      ? "Esta conta será atualizada pelo ativo específico selecionado no Pluggy."
                      : "ID da conexão com a instituição no Pluggy para sincronização de custódia total ou selecione um ativo no buscador."}
                  </p>
                </div>
              </div>
            </>
          )}

          {newType === 'loan_receivable' && (
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Dados do Crédito a Receber</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Valor Total Emprestado (R$)</label>
                  <Input type="number" step="0.01" value={newFinancingTotal} onChange={e => setNewFinancingTotal(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 10000" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Saldo Restante a Receber (R$)</label>
                  <Input type="number" step="0.01" value={newFinancingRemaining} onChange={e => setNewFinancingRemaining(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 8000" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Valor da Parcela (R$)</label>
                  <Input type="number" step="0.01" value={newFinancingInstallmentAmount} onChange={e => setNewFinancingInstallmentAmount(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 1000" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Total de Parcelas</label>
                  <Input type="number" min={1} value={newFinancingInstallmentsTotal} onChange={e => setNewFinancingInstallmentsTotal(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 10" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Parcelas Já Recebidas</label>
                  <Input type="number" min={0} value={newFinancingInstallmentsPaid} onChange={e => setNewFinancingInstallmentsPaid(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 2" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Dia Previsto Pagamento</label>
                  <Input type="number" min={1} max={31} value={newDueDay} onChange={e => setNewDueDay(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 15" />
                </div>
              </div>
            </div>
          )}

          {newType === 'financing' && (
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Dados do Financiamento</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Valor Total do Contrato (R$)</label>
                  <Input type="number" step="0.01" value={newFinancingTotal} onChange={e => setNewFinancingTotal(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 200000" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Saldo Devedor Restante (R$)</label>
                  <Input type="number" step="0.01" value={newFinancingRemaining} onChange={e => setNewFinancingRemaining(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 165000" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Valor da Parcela (R$)</label>
                  <Input type="number" step="0.01" value={newFinancingInstallmentAmount} onChange={e => setNewFinancingInstallmentAmount(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 1850" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Total de Parcelas</label>
                  <Input type="number" min={1} value={newFinancingInstallmentsTotal} onChange={e => setNewFinancingInstallmentsTotal(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 360" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Parcelas Já Pagas</label>
                  <Input type="number" min={0} value={newFinancingInstallmentsPaid} onChange={e => setNewFinancingInstallmentsPaid(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 72" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Dia de Vencimento</label>
                  <Input type="number" min={1} max={31} value={newDueDay} onChange={e => setNewDueDay(e.target.value ? Number(e.target.value) : "")} placeholder="Ex: 10" />
                </div>
              </div>
            </div>
          )}
          
          <Button type="submit" className="w-full">Salvar Conta</Button>
        </form>
      )}

      {/* Quick Filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <Button
          type="button"
          variant={activeFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("all")}
          className="rounded-full text-xs"
        >
          Todas ({activeAccounts.length})
        </Button>
        <Button
          type="button"
          variant={activeFilter === "banks" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("banks")}
          className="rounded-full text-xs"
        >
          Bancos & Cartões ({banksCount})
        </Button>
        <Button
          type="button"
          variant={activeFilter === "assets" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("assets")}
          className="rounded-full text-xs"
        >
          Patrimônio & Dívidas ({assetsCount})
        </Button>
      </div>

      <div className="space-y-4">
        {filteredAccounts.length === 0 ? (
          <EmptyState
            icon={Building}
            title={`Nenhuma conta em "${activeFilter === 'banks' ? 'Bancos & Cartões' : activeFilter === 'assets' ? 'Patrimônio & Dívidas' : 'Todas'}"`}
            description="Você não possui nenhuma conta deste tipo ou o filtro não retornou resultados."
            action={
              <>
                <Button variant="outline" onClick={() => setActiveFilter("all")}>
                  Limpar filtro
                </Button>
                <Button onClick={() => {
                  setNewType(activeFilter === 'assets' ? 'investment' : 'bank_account');
                  setIsAdding(true);
                }}>
                  Cadastrar {activeFilter === 'assets' ? 'Patrimônio' : 'Conta'}
                </Button>
              </>
            }
          />
        ) : (
          filteredAccounts.map((acc) => (
            <div 
              key={acc.id} 
            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border rounded-lg transition-all gap-3 ${
              editingId === acc.id 
                ? "border-primary/40 bg-accent/20 ring-1 ring-primary/20 shadow-sm" 
                : "hover:border-slate-300 dark:hover:border-slate-700 bg-card"
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-1.5 h-10 rounded-full shrink-0 mt-0.5 sm:mt-0" style={{ backgroundColor: acc.color }} />
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 shrink-0">
                {acc.type === "bank_account" ? (
                  <Building className="w-5 h-5" />
                ) : acc.type === "investment" ? (
                  <TrendingUp className="w-5 h-5" />
                ) : acc.type === "financing" ? (
                  <Receipt className="w-5 h-5 text-rose-500" />
                ) : acc.type === "loan_receivable" ? (
                  <HandCoins className="w-5 h-5 text-sky-500" />
                ) : (
                  <CreditCard className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                {editingId === acc.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Input 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)} 
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(acc);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        placeholder="Nome da conta" 
                        className="h-8 py-0 w-44 font-medium" 
                        autoFocus 
                      />
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as any)}
                        className="h-8 text-xs rounded-md border border-input bg-background px-2 font-medium text-foreground"
                      >
                        <option value="bank_account">Conta Corrente (Fluxo)</option>
                        <option value="credit_card">Cartão de Crédito (Fluxo)</option>
                        <option value="investment">Investimento / Caixinha (Patrimônio)</option>
                        <option value="financing">Financiamento / Dívida (Patrimônio)</option>
                        <option value="loan_receivable">Crédito a Receber (Patrimônio)</option>
                      </select>
                    </div>
                    {editType === 'credit_card' && (
                      <div className="flex items-center gap-2 text-xs">
                        <Input type="number" min={1} max={31} value={editDueDay} onChange={e => setEditDueDay(e.target.value ? Number(e.target.value) : "")} placeholder="Dia Venc." className="h-7 w-20 py-0" />
                        <select value={editPaymentAccountId} onChange={e => setEditPaymentAccountId(e.target.value ? Number(e.target.value) : "")} className="h-7 rounded-md border border-input bg-transparent px-2 w-32">
                          <option value="">Conta Pgto...</option>
                          {accounts.filter(a => a.type === 'bank_account').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    )}
                    {editType === 'bank_account' && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-[11px]">Pluggy Account:</span>
                          <Input
                            value={editPluggyAccountId}
                            onChange={e => setEditPluggyAccountId(e.target.value)}
                            placeholder="ID Conta/Cartão Pluggy"
                            className="h-7 w-44 py-0 font-mono text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-[11px]">Item:</span>
                          <Input
                            value={editPluggyItemId}
                            onChange={e => setEditPluggyItemId(e.target.value)}
                            placeholder="Item ID (opcional)"
                            className="h-7 w-36 py-0 font-mono text-xs"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openPluggyPicker("edit")}
                          className="h-7 text-xs gap-1.5"
                          title="Buscar contas, cofrinhos e cartões no Pluggy"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Buscar no Pluggy
                        </Button>
                      </div>
                    )}
                    {editType === 'investment' && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-[11px]">Pluggy Conexão:</span>
                          <Input
                            value={editPluggyItemId}
                            onChange={e => setEditPluggyItemId(e.target.value)}
                            placeholder="ID Conexão/Item"
                            className="h-7 w-48 py-0 font-mono text-xs"
                          />
                        </div>
                        {editPluggyAccountId && (
                          <div className="flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                            <span className="text-[10px] font-mono text-foreground">
                              {formatPluggyAccountBadge(editPluggyAccountId)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditPluggyAccountId("")}
                              className="text-muted-foreground hover:text-destructive"
                              title="Remover filtro de ativo e sincronizar custódia total"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openPluggyPicker("edit")}
                          className="h-7 text-xs gap-1.5"
                          title="Buscar conexões, ativos e caixinhas no Pluggy"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Buscar no Pluggy
                        </Button>
                      </div>
                    )}
                    {(editType === 'financing' || editType === 'loan_receivable') && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Saldo:</span>
                          <Input type="number" step="0.01" value={editFinancingRemaining} onChange={e => setEditFinancingRemaining(e.target.value ? Number(e.target.value) : "")} placeholder="Saldo" className="h-7 w-28 py-0 font-mono" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Parcela:</span>
                          <Input type="number" step="0.01" value={editFinancingInstallmentAmount} onChange={e => setEditFinancingInstallmentAmount(e.target.value ? Number(e.target.value) : "")} placeholder="Valor Parcela" className="h-7 w-24 py-0 font-mono" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Pagas/Total:</span>
                          <Input type="number" min={0} value={editFinancingPaid} onChange={e => setEditFinancingPaid(e.target.value ? Number(e.target.value) : "")} placeholder="Pagas" className="h-7 w-16 py-0 font-mono" />
                          <span className="text-slate-400">/</span>
                          <Input type="number" min={0} value={editFinancingInstallmentsTotal} onChange={e => setEditFinancingInstallmentsTotal(e.target.value ? Number(e.target.value) : "")} placeholder="Total" className="h-7 w-16 py-0 font-mono" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Dia Venc:</span>
                          <Input type="number" min={1} max={31} value={editDueDay} onChange={e => setEditDueDay(e.target.value ? Number(e.target.value) : "")} placeholder="Dia" className="h-7 w-14 py-0" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h4 
                      className="font-semibold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-primary transition-colors text-sm"
                      onClick={() => startEdit(acc)}
                      title="Clique para editar a conta"
                    >
                      {acc.name}
                    </h4>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>
                    {acc.type === "bank_account"
                      ? "Conta Corrente"
                      : acc.type === "investment"
                      ? "Investimentos"
                      : acc.type === "financing"
                      ? "Financiamento / Dívida"
                      : acc.type === "loan_receivable"
                      ? "Crédito a Receber"
                      : "Cartão de Crédito"}
                  </span>
                  {(acc.type === "bank_account" || acc.type === "credit_card") && acc.pluggyAccountId && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"
                      title={`Pluggy Account ID: ${acc.pluggyAccountId}${acc.pluggyItemId ? `\nItem ID: ${acc.pluggyItemId}` : ""}${acc.pluggyCredentialId ? `\nCredencial: ${acc.pluggyCredentialId}` : ""}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Pluggy: {acc.pluggyAccountId.slice(0, 8)}...
                    </span>
                  )}
                  {acc.type === "investment" && acc.pluggyItemId && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"
                      title={`Pluggy Item ID: ${acc.pluggyItemId}${acc.pluggyAccountId ? `\nAtivo/Grupo: ${acc.pluggyAccountId}` : " (Custódia Total)"}${acc.pluggyCredentialId ? `\nCredencial: ${acc.pluggyCredentialId}` : ""}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {formatPluggyAccountBadge(acc.pluggyAccountId)}
                    </span>
                  )}
                  {acc.type === "investment" && (
                    <label
                      className="inline-flex items-center gap-1 text-[11px] cursor-pointer"
                      title="Liquidez diária: a previsão pode sugerir resgatar daqui quando faltar dinheiro"
                    >
                      <input
                        type="checkbox"
                        checked={acc.isLiquid === 1}
                        onChange={(e) => handleUpdate(acc.id, { isLiquid: e.target.checked ? 1 : 0 })}
                      />
                      Reserva (liquidez diária)
                    </label>
                  )}
                  {(acc.type === "financing" || acc.type === "loan_receivable") && acc.financingRemainingAmount !== null && acc.financingRemainingAmount !== undefined && (
                    <span className={`font-mono tabular-nums privacy-sensitive font-medium ${acc.type === "financing" ? "text-rose-600" : "text-sky-600"}`}>
                      • Saldo: {formatCurrency(acc.financingRemainingAmount)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {editingId === acc.id ? (
                <>
                  <Button 
                    type="button"
                    size="sm" 
                    onClick={() => saveEdit(acc)} 
                    className="h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar</span>
                  </Button>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    onClick={() => setEditingId(null)} 
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(acc)}
                    className="h-8 px-3 gap-1.5 text-xs font-medium border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 shadow-2xs"
                    title="Editar dados da conta"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Editar</span>
                  </Button>

                  <div className="flex items-center gap-1 border-l border-border/60 pl-2">
                    <input 
                      type="color" 
                      value={acc.color} 
                      onChange={(e) => handleUpdate(acc.id, { color: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-none p-0 opacity-0 absolute" 
                      title="Mudar cor"
                    />
                    <div 
                      className="w-6 h-6 rounded border cursor-pointer hover:scale-110 transition-transform shadow-2xs" 
                      style={{ backgroundColor: acc.color }} 
                      onClick={(e) => (e.target as any).previousSibling?.click()} 
                      title="Mudar cor da conta"
                    />
                    
                    <Button variant="ghost" size="icon" onClick={() => handleArchive(acc.id)} className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800" title="Arquivar conta (preserva histórico)">
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" title="Excluir permanentemente">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )))}

        {accounts.some((a) => a.isActive === 0) && (
          <div className="pt-4 border-t space-y-3">
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              {showArchived ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span>Contas Arquivadas ({accounts.filter((a) => a.isActive === 0).length})</span>
            </button>

            {showArchived && (
              <div className="space-y-2">
                {accounts.filter((a) => a.isActive === 0).map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-3 border border-dashed rounded-lg bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-8 rounded-full bg-slate-300" />
                      <div>
                        <h4 className="font-medium text-sm text-slate-600">{acc.name}</h4>
                        <span className="text-[11px] text-slate-400">Arquivada</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(acc.id)}
                        className="h-7 text-xs gap-1.5"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        <span>Reativar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(acc.id)}
                        className="h-7 w-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Excluir permanentemente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isPluggyPickerOpen && (() => {
        const isTargetInvestment =
          pluggyPickerTarget === "edit"
            ? accounts.find((a) => a.id === editingId)?.type === "investment"
            : newType === "investment";

        const selectedItem = connectedItemsList.find((c) => c.id === pickerItemId);
        const selectedInstitutionName = selectedItem ? selectedItem.name : "Conexão informada";
        const totalInvestmentBalance = pluggyInvestmentsList.reduce(
          (sum, inv) => sum + (inv.balance || 0),
          0
        );

        const currentBoundItemId = pluggyPickerTarget === "edit" ? editPluggyItemId : newPluggyItemId;
        const currentBoundAccountId = pluggyPickerTarget === "edit" ? editPluggyAccountId : newPluggyAccountId;

        const activeInvestments = pluggyInvestmentsList.filter(
          (inv) => Math.abs(inv.balance || 0) >= 0.01 || Math.abs(inv.amount || 0) >= 0.01
        );
        const zeroedInvestmentsCount = pluggyInvestmentsList.length - activeInvestments.length;
        const investmentsToDisplay = showZeroedInvestments ? pluggyInvestmentsList : activeInvestments;

        const treasuryInvestments = investmentsToDisplay.filter(
          (inv) =>
            (inv.subtype || "").toUpperCase() === "TREASURY" ||
            (inv.name || "").toLowerCase().includes("tesouro")
        );
        const totalTreasuryBalance = Math.round(
          treasuryInvestments.reduce((sum, inv) => sum + (inv.balance || 0), 0) * 100
        ) / 100;

        const fundInvestments = investmentsToDisplay.filter((inv) => {
          const t = (inv.type || "").toUpperCase();
          const st = (inv.subtype || "").toUpperCase();
          const n = (inv.name || "").toLowerCase();
          return (
            t === "MUTUAL_FUND" ||
            st.includes("FUND") ||
            t === "INVESTMENT_FUND" ||
            n.includes("fundo")
          );
        });
        const totalFundBalance = Math.round(
          fundInvestments.reduce((sum, inv) => sum + (inv.balance || 0), 0) * 100
        ) / 100;

        const cdbInvestments = investmentsToDisplay.filter((inv) => {
          const st = (inv.subtype || "").toUpperCase();
          const n = (inv.name || "").toLowerCase();
          return st === "CDB" || n.includes("cdb");
        });
        const totalCdbBalance = Math.round(
          cdbInvestments.reduce((sum, inv) => sum + (inv.balance || 0), 0) * 100
        ) / 100;

        const selectedTotalBalance = Math.round(
          pluggyInvestmentsList
            .filter((inv) => selectedContractIds.includes(inv.id))
            .reduce((sum, inv) => sum + (inv.balance || 0), 0) * 100
        ) / 100;

        // Agrupamento por nome
        const map = new Map<string, {
          name: string;
          type: string;
          subtype: string | null;
          totalBalance: number;
          totalAmount: number;
          totalProfit: number | null;
          items: PluggyInvestmentSummary[];
        }>();

        for (const inv of investmentsToDisplay) {
          const key = inv.name.trim();
          const existing = map.get(key);
          if (existing) {
            existing.totalBalance = Math.round((existing.totalBalance + (inv.balance || 0)) * 100) / 100;
            existing.totalAmount = Math.round((existing.totalAmount + (inv.amount || inv.balance || 0)) * 100) / 100;
            if (inv.amountProfit != null) {
              existing.totalProfit = Math.round(((existing.totalProfit || 0) + inv.amountProfit) * 100) / 100;
            }
            existing.items.push(inv);
          } else {
            map.set(key, {
              name: inv.name,
              type: inv.type,
              subtype: inv.subtype || null,
              totalBalance: inv.balance || 0,
              totalAmount: inv.amount != null ? inv.amount : (inv.balance || 0),
              totalProfit: inv.amountProfit != null ? inv.amountProfit : null,
              items: [inv],
            });
          }
        }
        const groupedInvestments = Array.from(map.values());

        return (
          <ModalShell
            open={isPluggyPickerOpen}
            onClose={() => setIsPluggyPickerOpen(false)}
            maxWidth="max-w-4xl"
            title="Conectar ao Pluggy Open Finance"
            subtitle="Selecione uma conta corrente, cartão, cofrinho ou custódia de investimento."
            icon={<Building className="w-5 h-5 text-primary" />}
            footer={
              <div className="flex justify-end gap-2 w-full">
                <Button variant="ghost" onClick={() => setIsPluggyPickerOpen(false)}>
                  Fechar
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Seletor Rápido de Instituições Conectadas */}
              {connectedItemsList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Instituições Conectadas ({connectedItemsList.length})
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      Clique para consultar
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {connectedItemsList.map((item) => {
                      const isCurrent = pickerItemId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setPickerItemId(item.id);
                            setPickerCredentialId(item.credentialId || "");
                            setPickerCredentialLabel(item.credentialLabel || "");
                            handleSearchPluggyAccounts(item.id);
                          }}
                          className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between gap-1.5 ${
                            isCurrent
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Building className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                              <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                            </div>
                            {item.credentialLabel && (
                              <div className="mt-1">
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal text-muted-foreground border-border/70 max-w-full truncate">
                                  {item.credentialLabel}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mt-1">
                            <span>{item.id.slice(0, 6)}...</span>
                            <Badge variant={isCurrent ? "default" : "secondary"} className="text-[9px] px-1 py-0 h-4">
                              {item.accounts.length} {item.accounts.length === 1 ? "conta" : "contas"}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opção de Item ID Manual */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50">
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    Ou informe outro Item ID (UUID da conexão Pluggy):
                  </label>
                  <Input
                    value={pickerItemId}
                    onChange={(e) => setPickerItemId(e.target.value)}
                    placeholder="Cole aqui o UUID do Item Pluggy..."
                    className="font-mono text-xs h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchPluggyAccounts(pickerItemId);
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2 sm:self-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSearchPluggyAccounts(pickerItemId)}
                    disabled={isSearchingPluggy || !pickerItemId.trim()}
                    className="h-8 gap-1.5 text-xs w-full sm:w-auto"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSearchingPluggy ? "animate-spin" : ""}`} />
                    {isSearchingPluggy ? "Buscando..." : "Consultar"}
                  </Button>
                </div>
              </div>

              {/* Badge indicando a conta/credencial Pluggy ativa para o item selecionado/consultado */}
              {(pickerCredentialLabel || selectedItem?.credentialLabel) && (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/40 border border-border/40 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                    Conta / Credencial Pluggy:
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {pickerCredentialLabel || selectedItem?.credentialLabel}
                  </Badge>
                </div>
              )}

              {pluggySearchError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Erro ao consultar dados no Pluggy</p>
                    <p className="mt-0.5">{pluggySearchError}</p>
                  </div>
                </div>
              )}

              {isSearchingPluggy ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Consultando contas e investimentos no Pluggy...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Barra de Abas: Contas vs Investimentos */}
                  <div className="flex border-b border-border gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPickerActiveTab("accounts")}
                      className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
                        pickerActiveTab === "accounts"
                          ? "border-primary text-primary font-semibold"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Contas & Cofrinhos</span>
                      <Badge
                        variant={pickerActiveTab === "accounts" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {pluggyAccountsList.length}
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPickerActiveTab("investments")}
                      className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
                        pickerActiveTab === "investments"
                          ? "border-primary text-primary font-semibold"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Investimentos & Caixinhas</span>
                      <Badge
                        variant={pickerActiveTab === "investments" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {showZeroedInvestments ? pluggyInvestmentsList.length : activeInvestments.length}
                      </Badge>
                    </button>
                  </div>

                  {/* CONTEÚDO DA ABA: CONTAS & COFRINHOS */}
                  {pickerActiveTab === "accounts" && (
                    pluggyAccountsList.length === 0 ? (
                      !pluggySearchError && (
                        <EmptyState
                          icon={Building}
                          title="Nenhuma conta encontrada"
                          description="Não foram encontradas contas retornadas pelo Pluggy para a conexão informada."
                          action={
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSearchPluggyAccounts(pickerItemId)}
                            >
                              Tentar Novamente
                            </Button>
                          }
                        />
                      )
                    ) : (
                      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        {pluggyAccountsList.map((item) => {
                          const isReserved =
                            item.subtype === "COFRINHO_RESERVA" ||
                            item.name.toLowerCase().includes("reserva") ||
                            item.name.toLowerCase().includes("cofrinho");
                          const isCard = item.type === "CREDIT" || item.subtype === "CREDIT_CARD";
                          const isSelected =
                            currentBoundItemId === (item.itemId || pickerItemId.trim()) &&
                            currentBoundAccountId === item.id;

                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isSelected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : isReserved
                                  ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10"
                                  : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                    isReserved
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {isReserved ? (
                                    <PiggyBank className="w-4 h-4" />
                                  ) : isCard ? (
                                    <CreditCard className="w-4 h-4" />
                                  ) : (
                                    <Building className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm text-foreground">{item.name}</span>
                                    {isReserved ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                      >
                                        COFRINHO / RESERVA
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px] uppercase">
                                        {item.subtype || item.type}
                                      </Badge>
                                    )}
                                    {item.number && (
                                      <span className="text-xs text-muted-foreground font-mono">
                                        • {item.number}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
                                    <span>ID: {item.id}</span>
                                    {item.balance != null && (
                                      <span className="tabular-nums font-semibold text-foreground">
                                        • Saldo: {formatCurrency(item.balance)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-end shrink-0">
                                <Button
                                  size="sm"
                                  variant={isSelected ? "default" : "outline"}
                                  onClick={() => handleSelectPluggyAccount(item)}
                                  className="h-8 text-xs shrink-0"
                                >
                                  {isSelected ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 mr-1" />
                                      Selecionado
                                    </>
                                  ) : (
                                    "Selecionar"
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* CONTEÚDO DA ABA: INVESTIMENTOS & CAIXINHAS */}
                  {pickerActiveTab === "investments" && (
                    <div className="space-y-3">
                      {/* Opção 1: Vincular a instituição inteira (Consolidado) */}
                      {pickerItemId.trim() && (
                        <div className="p-3.5 rounded-lg border border-primary/40 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {selectedInstitutionName} (Custódia Total)
                              </span>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {pickerItemId.slice(0, 8)}...
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {pluggyInvestmentsList.length > 0 ? (
                                <>
                                  Sincroniza a soma de todos os <strong>{pluggyInvestmentsList.length}</strong> ativos • Total:{" "}
                                  <span className="font-semibold text-foreground tabular-nums">
                                    {formatCurrency(totalInvestmentBalance)}
                                  </span>
                                </>
                              ) : (
                                "Sincroniza o saldo total consolidado desta instituição."
                              )}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={
                              currentBoundItemId === pickerItemId.trim() && !currentBoundAccountId
                                ? "default"
                                : "outline"
                            }
                            onClick={handleSelectPluggyCustodiaTotal}
                            className="h-8 text-xs shrink-0 gap-1.5"
                          >
                            {currentBoundItemId === pickerItemId.trim() && !currentBoundAccountId ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Conexão Vinculada
                              </>
                            ) : (
                              "Vincular Custódia Total"
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Opção: Todos os Fundos de Investimento */}
                      {fundInvestments.length > 0 && (
                        <div className="p-3.5 rounded-lg border border-sky-500/30 bg-sky-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                Todos os Fundos de Investimento ({selectedInstitutionName})
                              </span>
                              <Badge variant="secondary" className="font-mono text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20">
                                MUTUAL_FUND • {fundInvestments.length} {fundInvestments.length === 1 ? "fundo" : "fundos"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Soma todos os fundos de investimento (renda fixa, multimercado e ações) • Total:{" "}
                              <span className="font-semibold text-foreground tabular-nums">
                                {formatCurrency(totalFundBalance)}
                              </span>
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={
                              currentBoundItemId === pickerItemId.trim() &&
                              (currentBoundAccountId === "group:type:MUTUAL_FUND" ||
                                currentBoundAccountId === "group:subtype:MUTUAL_FUND")
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              handleSelectPluggyGroup(
                                "group:type:MUTUAL_FUND",
                                `Fundos (${selectedInstitutionName})`
                              )
                            }
                            className="h-8 text-xs shrink-0 gap-1.5"
                          >
                            {currentBoundItemId === pickerItemId.trim() &&
                            (currentBoundAccountId === "group:type:MUTUAL_FUND" ||
                              currentBoundAccountId === "group:subtype:MUTUAL_FUND") ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Fundos Vinculados
                              </>
                            ) : (
                              "Vincular Todos os Fundos"
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Opção 2: Todo o Tesouro Direto (se houver múltiplos contratos de Tesouro) */}
                      {treasuryInvestments.length > 1 && (
                        <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                Todo o Tesouro Direto ({selectedInstitutionName})
                              </span>
                              <Badge variant="secondary" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                                TREASURY • {treasuryInvestments.length} contratos
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Soma todos os títulos públicos (Selic, IPCA+, etc.) • Total:{" "}
                              <span className="font-semibold text-foreground tabular-nums">
                                {formatCurrency(totalTreasuryBalance)}
                              </span>
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={
                              currentBoundItemId === pickerItemId.trim() &&
                              currentBoundAccountId === "group:subtype:TREASURY"
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              handleSelectPluggyGroup(
                                "group:subtype:TREASURY",
                                `Tesouro Direto (${selectedInstitutionName})`
                              )
                            }
                            className="h-8 text-xs shrink-0 gap-1.5"
                          >
                            {currentBoundItemId === pickerItemId.trim() &&
                            currentBoundAccountId === "group:subtype:TREASURY" ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Tesouro Direto Vinculado
                              </>
                            ) : (
                              "Vincular Todo o Tesouro Direto"
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Opção: Todos os CDBs */}
                      {cdbInvestments.length > 1 && (
                        <div className="p-3.5 rounded-lg border border-purple-500/30 bg-purple-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                Todos os CDBs ({selectedInstitutionName})
                              </span>
                              <Badge variant="secondary" className="font-mono text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20">
                                CDB • {cdbInvestments.length} contratos
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Soma todos os Certificados de Depósito Bancário • Total:{" "}
                              <span className="font-semibold text-foreground tabular-nums">
                                {formatCurrency(totalCdbBalance)}
                              </span>
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={
                              currentBoundItemId === pickerItemId.trim() &&
                              currentBoundAccountId === "group:subtype:CDB"
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              handleSelectPluggyGroup(
                                "group:subtype:CDB",
                                `CDBs (${selectedInstitutionName})`
                              )
                            }
                            className="h-8 text-xs shrink-0 gap-1.5"
                          >
                            {currentBoundItemId === pickerItemId.trim() &&
                            currentBoundAccountId === "group:subtype:CDB" ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                CDBs Vinculados
                              </>
                            ) : (
                              "Vincular Todos os CDBs"
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Banner Informativo de Contratos Zerados/Antigos */}
                      {zeroedInvestmentsCount > 0 && (
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                          <span>
                            {showZeroedInvestments
                              ? `Exibindo todas as posições (${pluggyInvestmentsList.length} contratos, incluindo ${zeroedInvestmentsCount} zerados/antigos).`
                              : `${zeroedInvestmentsCount} contratos antigos ou zerados ocultados.`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowZeroedInvestments(!showZeroedInvestments)}
                            className="text-primary hover:underline font-semibold text-[11px]"
                          >
                            {showZeroedInvestments ? "Ocultar zerados" : "Exibir zerados"}
                          </button>
                        </div>
                      )}

                      {/* Opção 3: Listagem de Ativos Agrupados por Nome */}
                      {groupedInvestments.length === 0 ? (
                        !pluggySearchError && (
                          <EmptyState
                            icon={TrendingUp}
                            title="Nenhum investimento retornado"
                            description={
                              zeroedInvestmentsCount > 0
                                ? "Todos os contratos retornados estão zerados. Clique em 'Exibir zerados' acima para visualizá-los."
                                : "Não foram encontradas posições de investimentos nesta conexão ou a instituição ainda não sincronizou os dados no Pluggy."
                            }
                            action={
                              zeroedInvestmentsCount > 0 ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowZeroedInvestments(true)}
                                >
                                  Exibir Contratos Zerados ({zeroedInvestmentsCount})
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSearchPluggyAccounts(pickerItemId)}
                                >
                                  Tentar Novamente
                                </Button>
                              )
                            }
                          />
                        )
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Ativos & Grupos ({groupedInvestments.length})
                            </label>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                Lotes do mesmo título são consolidados automaticamente
                              </span>
                              {investmentsToDisplay.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allIds = investmentsToDisplay.map((i) => i.id);
                                    const allSelected = allIds.every((id) => selectedContractIds.includes(id));
                                    if (allSelected) {
                                      setSelectedContractIds([]);
                                    } else {
                                      setSelectedContractIds(allIds);
                                    }
                                  }}
                                  className="text-[11px] text-primary hover:underline font-medium"
                                >
                                  {investmentsToDisplay.every((i) => selectedContractIds.includes(i.id))
                                    ? "Desmarcar todos"
                                    : "Selecionar todos"}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                            {groupedInvestments.map((group) => {
                              const isMultiContract = group.items.length > 1;
                              const isCaixinha =
                                group.name.toLowerCase().includes("caixinha") ||
                                group.name.toLowerCase().includes("reserva") ||
                                group.subtype?.toLowerCase().includes("reserva");
                              const isGroupSelected =
                                currentBoundItemId === pickerItemId.trim() &&
                                currentBoundAccountId === `group:name:${group.name}`;
                              const isExpanded = !!expandedGroupNames[group.name];

                              if (isMultiContract) {
                                return (
                                  <div
                                    key={group.name}
                                    className={`p-3.5 rounded-lg border transition-all flex flex-col gap-2.5 ${
                                      isGroupSelected
                                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                                        : isCaixinha
                                        ? "border-amber-500/30 bg-amber-500/5"
                                        : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
                                    }`}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                                        <div className="flex items-center self-center shrink-0 pt-1 sm:pt-0">
                                          <input
                                            type="checkbox"
                                            checked={group.items.length > 0 && group.items.every((i) => selectedContractIds.includes(i.id))}
                                            ref={(el) => {
                                              if (el) {
                                                const someSelected = group.items.some((i) => selectedContractIds.includes(i.id));
                                                const allSelected = group.items.every((i) => selectedContractIds.includes(i.id));
                                                el.indeterminate = someSelected && !allSelected;
                                              }
                                            }}
                                            onChange={() => toggleGroupContractSelection(group.items.map((i) => i.id))}
                                            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                                            title="Selecionar todos os contratos deste ativo para vínculo manual"
                                          />
                                        </div>
                                        <div
                                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                            isCaixinha
                                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                              : "bg-primary/10 text-primary"
                                          }`}
                                        >
                                          <Layers className="w-4 h-4" />
                                        </div>
                                        <div className="space-y-0.5 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-sm text-foreground">{group.name}</span>
                                            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1 font-mono">
                                              <Layers className="w-3 h-3" />
                                              {group.items.length} contratos agrupados
                                            </Badge>
                                            {group.subtype && (
                                              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                                {group.subtype}
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
                                            <span className="tabular-nums font-semibold text-foreground text-sm">
                                              Total: {formatCurrency(group.totalBalance)}
                                            </span>
                                            {group.totalProfit != null && group.totalProfit !== 0 && (
                                              <span
                                                className={`tabular-nums ${
                                                  group.totalProfit >= 0
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-rose-600 dark:text-rose-400"
                                                }`}
                                              >
                                                • Rentabilidade: {group.totalProfit >= 0 ? "+" : ""}
                                                {formatCurrency(group.totalProfit)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-end shrink-0 gap-2">
                                        <Button
                                          size="sm"
                                          variant={isGroupSelected ? "default" : "outline"}
                                          onClick={() => handleSelectPluggyGroup(`group:name:${group.name}`, `${group.name} (${selectedInstitutionName})`)}
                                          className="h-8 text-xs shrink-0"
                                        >
                                          {isGroupSelected ? (
                                            <>
                                              <Check className="w-3.5 h-3.5 mr-1" />
                                              Grupo Vinculado
                                            </>
                                          ) : (
                                            `Vincular Grupo (${group.items.length} contratos)`
                                          )}
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Acordeão para inspecionar os contratos individuais */}
                                    <div className="border-t border-border/40 pt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => toggleGroupExpanded(group.name)}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                                      >
                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        <span>{isExpanded ? "Ocultar contratos individuais" : `Inspecionar ${group.items.length} contratos individuais`}</span>
                                      </button>

                                      {isExpanded && (
                                        <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-primary/20">
                                          {group.items.map((inv) => {
                                            const isItemSingleSelected =
                                              currentBoundItemId === pickerItemId.trim() &&
                                              currentBoundAccountId === inv.id;
                                            return (
                                              <div
                                                key={inv.id}
                                                className="p-2 rounded border border-border/60 bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                              >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                  <input
                                                    type="checkbox"
                                                    checked={selectedContractIds.includes(inv.id)}
                                                    onChange={() => toggleContractSelection(inv.id)}
                                                    className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer shrink-0"
                                                    title="Selecionar este contrato"
                                                  />
                                                  <div className="min-w-0 space-y-0.5">
                                                    <div className="font-mono text-[11px] text-muted-foreground truncate">
                                                      Contrato ID: {inv.id}
                                                    </div>
                                                    <div className="font-semibold tabular-nums text-foreground">
                                                      Saldo: {formatCurrency(inv.balance)}
                                                      {inv.amountProfit != null && inv.amountProfit !== 0 && (
                                                        <span className={`ml-2 text-[11px] ${inv.amountProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                                          ({inv.amountProfit >= 0 ? "+" : ""}{formatCurrency(inv.amountProfit)})
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                                <Button
                                                  size="sm"
                                                  variant={isItemSingleSelected ? "default" : "ghost"}
                                                  onClick={() => handleSelectPluggyInvestment(inv)}
                                                  className="h-7 text-[11px] shrink-0"
                                                >
                                                  {isItemSingleSelected ? (
                                                    <>
                                                      <Check className="w-3 h-3 mr-1" />
                                                      Vinculado Individual
                                                    </>
                                                  ) : (
                                                    "Vincular apenas este contrato"
                                                  )}
                                                </Button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              // Item individual (1 único contrato)
                              const inv = group.items[0];
                              const isSingleSelected =
                                currentBoundItemId === pickerItemId.trim() &&
                                (currentBoundAccountId === inv.id || currentBoundAccountId === `group:name:${inv.name}`);

                              return (
                                <div
                                  key={inv.id}
                                  className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    isSingleSelected
                                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                                      : isCaixinha
                                      ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10"
                                      : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                                  }`}
                                >
                                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                                    <div className="flex items-center self-center shrink-0 pt-1 sm:pt-0">
                                      <input
                                        type="checkbox"
                                        checked={selectedContractIds.includes(inv.id)}
                                        onChange={() => toggleContractSelection(inv.id)}
                                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                                        title="Selecionar este ativo para vínculo manual"
                                      />
                                    </div>
                                    <div
                                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                        isCaixinha
                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {isCaixinha ? (
                                        <PiggyBank className="w-4 h-4" />
                                      ) : (
                                        <TrendingUp className="w-4 h-4 text-primary" />
                                      )}
                                    </div>
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm text-foreground">{inv.name}</span>
                                        {isCaixinha ? (
                                          <Badge
                                            variant="secondary"
                                            className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                          >
                                            CAIXINHA / COFRINHO
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-[10px] uppercase">
                                            {inv.subtype || inv.type}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
                                        <span>ID: {inv.id}</span>
                                        <span className="tabular-nums font-semibold text-foreground">
                                          • Saldo: {formatCurrency(inv.balance)}
                                        </span>
                                        {inv.amountProfit != null && inv.amountProfit !== 0 && (
                                          <span
                                            className={`tabular-nums ${
                                              inv.amountProfit >= 0
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-rose-600 dark:text-rose-400"
                                            }`}
                                          >
                                            • Rentabilidade: {inv.amountProfit >= 0 ? "+" : ""}
                                            {formatCurrency(inv.amountProfit)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end shrink-0">
                                    <Button
                                      size="sm"
                                      variant={isSingleSelected ? "default" : "outline"}
                                      onClick={() => handleSelectPluggyInvestment(inv)}
                                      className="h-8 text-xs shrink-0"
                                    >
                                      {isSingleSelected ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 mr-1" />
                                          Ativo Vinculado
                                        </>
                                      ) : (
                                        "Vincular este Ativo"
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Barra Flutuante de Seleção Manual */}
                          {selectedContractIds.length > 0 && (
                            <div className="sticky bottom-0 z-10 p-3 rounded-lg bg-primary/10 border-2 border-primary/40 backdrop-blur shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
                                  {selectedContractIds.length}
                                </div>
                                <div>
                                  <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                                    <span>{selectedContractIds.length} {selectedContractIds.length === 1 ? "ativo selecionado" : "ativos selecionados"}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Total da seleção manual:{" "}
                                    <span className="font-bold tabular-nums text-foreground">
                                      {formatCurrency(selectedTotalBalance)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedContractIds([])}
                                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Limpar Seleção
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleSelectManualIds(selectedContractIds, selectedInstitutionName)}
                                  className="h-8 text-xs gap-1.5 font-semibold"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Vincular Seleção ({selectedContractIds.length})
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ModalShell>
        );
      })()}

      <ConfirmDialog
        open={confirmDialogState.isOpen}
        onOpenChange={(isOpen) => setConfirmDialogState(prev => ({ ...prev, isOpen }))}
        title={confirmDialogState.title}
        description={confirmDialogState.description}
        confirmLabel={confirmDialogState.confirmLabel}
        onConfirm={confirmDialogState.action}
      />
    </div>
  );
}
