"use client";

import React from "react";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  EyeOff,
  KeyRound,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrivacyTab() {
  const { hideValues, isPrivate } = usePrivacy();

  return (
    <div className="space-y-6 max-w-xl">
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
                O PIN é gerenciado via variável de ambiente{" "}
                <code className="font-mono font-semibold text-foreground bg-muted px-1 py-0.5 rounded">APP_PIN</code> no
                arquivo <code className="font-mono text-foreground">.env</code>.
              </p>
              <p>
                Como mecanismo de recuperação seguro, a senha mestra da aplicação (
                <code className="font-mono font-semibold text-foreground bg-muted px-1 py-0.5 rounded">
                  APP_PASSWORD
                </code>
                ) também pode ser usada para desbloquear caso você esqueça o PIN.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Teste Rápido */}
      <div className="bg-card border rounded-xl p-5 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-semibold text-foreground">Ocultar Valores</h4>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Oculta os valores manualmente. O desbloqueio exige o PIN.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={hideValues} disabled={isPrivate} className="shrink-0 gap-1.5">
          <EyeOff className="w-4 h-4" />
          {isPrivate ? "Valores Já Ocultos" : "Ocultar Agora"}
        </Button>
      </div>
    </div>
  );
}
