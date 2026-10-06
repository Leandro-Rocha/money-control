"use client";

import { useEffect, useState } from "react";
import { Account } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { Landmark, RefreshCw, Link2, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPluggyCredentialsAction, PluggyCredentialSummary } from "@/lib/actions/pluggy";

interface OpenFinanceTabProps {
  accounts: Account[];
  onRefresh: () => void;
}

export function OpenFinanceTab({ accounts, onRefresh }: OpenFinanceTabProps) {
  const [credentials, setCredentials] = useState<PluggyCredentialSummary[]>([]);

  const loadCredentials = async () => {
    try {
      const res = await getPluggyCredentialsAction();
      if (res.success) {
        setCredentials(res.credentials);
      }
    } catch {
      // Ignora erro não-bloqueante
    }
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  const handleRefresh = () => {
    loadCredentials();
    onRefresh();
  };

  const connectedAccounts = accounts.filter((a) => a.pluggyItemId);

  const grouped = connectedAccounts.reduce((acc, account) => {
    const itemId = account.pluggyItemId!;
    if (!acc[itemId]) {
      acc[itemId] = [];
    }
    acc[itemId].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-foreground">Conexões Open Finance</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie as integrações ativas com suas instituições financeiras.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar status
        </Button>
      </div>

      {/* Sumário de Contas / Credenciais Pluggy configuradas */}
      {credentials.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-medium text-foreground">
                Contas Pluggy Configuradas ({credentials.length})
              </h4>
            </div>
            <span className="text-xs text-muted-foreground">
              Configuradas no .env
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-1.5">
                      <span>{cred.label}</span>
                      {cred.isDefault && (
                        <Badge variant="secondary" className="text-2xs px-1 py-0 h-3.5">
                          Padrão
                        </Badge>
                      )}
                    </div>
                    <div className="text-2xs text-muted-foreground font-mono">
                      ID: {cred.id}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-foreground">
                    {cred.connectedItemsCount}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {cred.connectedItemsCount === 1 ? "instituição" : "instituições"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {connectedAccounts.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Nenhuma conexão ativa"
          description="Você ainda não possui contas conectadas via Open Finance. Retorne à aba 'Contas e Cartões' para vincular uma instituição."
        />
      ) : (
        <div className="grid gap-4">
          {Object.entries(grouped).map(([itemId, itemAccounts]) => {
            // Utiliza a primeira palavra do nome da primeira conta como "Instituição" se não tivermos a real
            const institutionNameFallback = itemAccounts[0].name.split(" ")[0];

            const itemCredentialId =
              itemAccounts.find((a) => a.pluggyCredentialId)?.pluggyCredentialId || "default";
            const credProfile = credentials.find((c) => c.id === itemCredentialId);
            const itemCredentialLabel =
              credProfile?.label ||
              (itemCredentialId === "default" ? "Pluggy Principal" : `Pluggy ${itemCredentialId}`);

            return (
              <div key={itemId} className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Landmark className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">
                        Instituição ({institutionNameFallback})
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                          Conectado / Ativo
                        </span>
                        <span>•</span>
                        <Badge variant="outline" className="text-2xs px-1.5 py-0 font-normal">
                          {itemCredentialLabel}
                        </Badge>
                        <span>•</span>
                        <span className="font-mono text-2xs">Item: {itemId.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="text-sm font-medium text-muted-foreground">
                    Contas Vinculadas ({itemAccounts.length})
                  </h5>
                  <div className="space-y-2">
                    {itemAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: account.color }}
                          />
                          <span className="font-medium text-foreground">{account.name}</span>
                        </div>
                        <div className="text-muted-foreground text-xs text-right">
                          <div>Account ID</div>
                          <div className="font-mono">{account.pluggyAccountId || "N/A"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
