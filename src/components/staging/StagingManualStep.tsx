"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface StagingManualStepProps {
  promptText: string;
  pastedText: string;
  onPastedTextChange: (text: string) => void;
  isBankAccount: boolean;
  copied: boolean;
  onCopyPrompt: () => void;
}

export function StagingManualStep({
  promptText,
  pastedText,
  onPastedTextChange,
  isBankAccount,
  copied,
  onCopyPrompt,
}: StagingManualStepProps) {
  return (
    <>
      <div className="bg-muted/50 p-3 rounded-lg border border-border">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <h3 className="font-semibold text-sm">Instruções para a IA</h3>
            <p className="text-xs text-muted-foreground">
              Copie o prompt e cole no Gemini ou ChatGPT junto com seu PDF/Extrato.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onCopyPrompt}
            className="shrink-0 h-8 text-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copied ? "Copiado!" : "Copiar Prompt"}
          </Button>
        </div>
        <div className="bg-background p-2.5 rounded text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap border max-h-24 overflow-y-auto">
          {promptText}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 flex items-center justify-between">
          <span>Cole o TSV gerado aqui</span>
        </label>
        <textarea
          value={pastedText}
          onChange={(e) => onPastedTextChange(e.target.value)}
          className="w-full h-48 rounded-md border border-input bg-background p-3 text-sm font-mono placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder={
            isBankAccount
              ? `02/07/2026\tPIX TRANSF LEANDRO\tPix Transf Leandro\t5917.92\tTransferência\t\t\t02/07/2026\n03/08/2026\tPIX TRANSF D20 SOC\tPix Transf D20 Soc\t-5800.00\tTransferência\t\t\t03/08/2026`
              : `12\tPGTO *MERCADO EXTRA\tMercado Extra\t-150.00\tMercado\n15\tTED SALARIO\tSalário\t5000.00\tReceita`
          }
        />
      </div>
    </>
  );
}
