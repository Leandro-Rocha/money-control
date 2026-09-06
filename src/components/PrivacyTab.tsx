"use client";

import React from "react";
import { usePrivacy } from "@/context/PrivacyContext";
import { Shield, Clock, EyeOff, Check, KeyRound, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

const TIMEOUT_OPTIONS = [
  { value: 1, label: "1 minuto" },
  { value: 2, label: "2 minutos" },
  { value: 5, label: "5 minutos (Padrão)" },
  { value: 10, label: "10 minutos" },
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 0, label: "Desativado (Nunca)" },
];

export function PrivacyTab() {
  const { inactivityMinutes, setInactivityMinutes, hideValues, isPrivate } = usePrivacy();

  return (
    <div className="space-y-6 max-w-xl">
      {/* Seção Inatividade */}
      <div className="bg-card border rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bloqueio Automático por Inatividade</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Oculta todos os valores caso não haja interação (movimento do mouse, cliques ou toques).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {TIMEOUT_OPTIONS.map((opt) => {
            const isSelected = inactivityMinutes === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setInactivityMinutes(opt.value)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-all text-left ${
                  isSelected
                    ? "border-primary bg-primary/5 text-foreground font-semibold shadow-xs"
                    : "border-border/60 hover:border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seção PIN e Segurança */}
      <div className="bg-card border rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Autenticação do PIN</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              O PIN numérico para revelação dos valores é configurado de forma segura no servidor.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-muted/50 border text-xs text-muted-foreground space-y-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                O PIN é gerenciado via variável de ambiente <code className="font-mono font-semibold text-foreground bg-muted px-1 py-0.5 rounded">APP_PIN</code> no arquivo <code className="font-mono text-foreground">.env</code>.
              </p>
              <p>
                Como mecanismo de recuperação seguro, a senha mestra da aplicação (<code className="font-mono font-semibold text-foreground bg-muted px-1 py-0.5 rounded">APP_PASSWORD</code>) também pode ser usada para desbloquear caso você esqueça o PIN.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Teste Rápido */}
      <div className="bg-card border rounded-xl p-5 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-semibold text-foreground">Testar Modo Privacidade</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Oculte os valores imediatamente para testar o blur e o desbloqueio com PIN.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={hideValues}
          disabled={isPrivate}
          className="shrink-0 gap-1.5"
        >
          <EyeOff className="w-4 h-4" />
          {isPrivate ? "Valores Já Ocultos" : "Ocultar Agora"}
        </Button>
      </div>
    </div>
  );
}
