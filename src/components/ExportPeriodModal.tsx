"use client";

import { useState, useEffect, useCallback } from "react";
import { ModalShell } from "./ModalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getExportDataForPeriod } from "@/lib/actions/export";
import { formatPeriodForLLM, estimateTokenCount } from "@/lib/export/llm-formatter";
import { addMonths } from "@/lib/date-helpers";
import { copyToClipboard } from "@/lib/clipboard";
import { ExportPeriodData } from "@/lib/types";
import {
  Sparkles,
  Copy,
  Check,
  Download,
  Loader2,
  Calendar,
  FileText,
  Clock,
  Layers,
} from "lucide-react";

interface ExportPeriodModalProps {
  currentMonth: string;
  onClose: () => void;
}

type PeriodPreset = "current" | "last3" | "year" | "custom";

export function ExportPeriodModal({ currentMonth, onClose }: ExportPeriodModalProps) {
  const [preset, setPreset] = useState<PeriodPreset>("current");
  const [startMonth, setStartMonth] = useState<string>(currentMonth);
  const [endMonth, setEndMonth] = useState<string>(currentMonth);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exportData, setExportData] = useState<ExportPeriodData | null>(null);
  const [markdownText, setMarkdownText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Apply presets
  const handlePresetSelect = (selectedPreset: PeriodPreset) => {
    setPreset(selectedPreset);
    if (selectedPreset === "current") {
      setStartMonth(currentMonth);
      setEndMonth(currentMonth);
    } else if (selectedPreset === "last3") {
      setStartMonth(addMonths(currentMonth, -2));
      setEndMonth(currentMonth);
    } else if (selectedPreset === "year") {
      const year = currentMonth.split("-")[0];
      setStartMonth(`${year}-01`);
      setEndMonth(`${year}-12`);
    }
  };

  // Fetch data whenever startMonth or endMonth change
  const fetchData = useCallback(async () => {
    if (!startMonth || !endMonth) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getExportDataForPeriod(startMonth, endMonth);
      setExportData(data);
      const md = formatPeriodForLLM(data);
      setMarkdownText(md);
    } catch (err: any) {
      console.error("Erro ao carregar dados de exportação:", err);
      setError(err?.message || "Falha ao compilar dados do período.");
    } finally {
      setIsLoading(false);
    }
  }, [startMonth, endMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Copy
  const handleCopy = async () => {
    if (!markdownText) return;
    const success = await copyToClipboard(markdownText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle Download .md
  const handleDownload = () => {
    if (!markdownText) return;
    const filename =
      startMonth === endMonth
        ? `relatorio-financeiro-${startMonth}.md`
        : `relatorio-financeiro-${startMonth}-a-${endMonth}.md`;

    const blob = new Blob([markdownText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const charCount = markdownText.length;
  const tokenEstimate = estimateTokenCount(markdownText);
  const txCount = exportData?.transactions.length || 0;
  const monthsCount = exportData?.months.length || 1;

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      maxWidth="max-w-4xl"
      title="Exportar para IA (LLM)"
      subtitle="Exporte os dados financeiros consolidados em Markdown formatado para análise no Claude, ChatGPT ou Gemini."
      icon={<Sparkles className="w-5 h-5 text-indigo-500" />}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={isLoading || !markdownText}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar .md
            </Button>

            <Button
              variant="default"
              onClick={handleCopy}
              disabled={isLoading || !markdownText}
              className={`gap-2 min-w-[170px] ${
                copied
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar para Clipboard
                </>
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Controls Section: Presets & Date Pickers */}
        <div className="bg-card p-4 rounded-lg border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Período de Análise
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant={preset === "current" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetSelect("current")}
                className="h-8 text-xs"
              >
                Mês Atual
              </Button>
              <Button
                type="button"
                variant={preset === "last3" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetSelect("last3")}
                className="h-8 text-xs"
              >
                Últimos 3 Meses
              </Button>
              <Button
                type="button"
                variant={preset === "year" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetSelect("year")}
                className="h-8 text-xs"
              >
                Ano Vigente
              </Button>
              <Button
                type="button"
                variant={preset === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset("custom")}
                className="h-8 text-xs"
              >
                Personalizado
              </Button>
            </div>
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
              <div className="flex flex-col gap-1">
                <Label htmlFor="startMonth" className="text-2xs text-muted-foreground">
                  De:
                </Label>
                <Input
                  id="startMonth"
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="h-8 text-xs w-[140px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="endMonth" className="text-2xs text-muted-foreground">
                  Até:
                </Label>
                <Input
                  id="endMonth"
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="h-8 text-xs w-[140px]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats & Token Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card px-3.5 py-2 rounded-lg border border-border shadow-xs flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
            <div>
              <p className="text-2xs text-muted-foreground font-medium uppercase">Duração</p>
              <p className="text-sm font-semibold text-foreground">
                {monthsCount} {monthsCount === 1 ? "mês" : "meses"}
              </p>
            </div>
          </div>

          <div className="bg-card px-3.5 py-2 rounded-lg border border-border shadow-xs flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-2xs text-muted-foreground font-medium uppercase">Transações</p>
              <p className="text-sm font-semibold text-foreground">{txCount} itens</p>
            </div>
          </div>

          <div className="bg-card px-3.5 py-2 rounded-lg border border-border shadow-xs flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-2xs text-muted-foreground font-medium uppercase">Caracteres</p>
              <p className="text-sm font-semibold text-foreground">
                {charCount.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>

          <div className="bg-card px-3.5 py-2 rounded-lg border border-border shadow-xs flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-2xs text-muted-foreground font-medium uppercase">Tokens Estimados</p>
              <p className="text-sm font-semibold text-foreground">
                ~{tokenEstimate.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex flex-col gap-1.5 flex-1 min-h-[340px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Pré-visualização do Prompt Markdown
            </span>
            {isLoading && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Atualizando...
              </span>
            )}
          </div>

          <div className="relative flex-1 rounded-lg border border-border bg-slate-900 text-slate-100 overflow-hidden shadow-inner flex flex-col">
            {isLoading ? (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <p className="text-xs text-slate-300">Carregando e agregando transações...</p>
              </div>
            ) : error ? (
              <div className="p-6 text-center text-rose-400 text-sm">{error}</div>
            ) : null}

            <textarea
              readOnly
              value={markdownText}
              className="w-full h-[360px] p-4 font-mono text-xs leading-relaxed bg-transparent text-slate-200 resize-none outline-hidden overflow-y-auto selection:bg-indigo-500 selection:text-white"
              placeholder="O prompt em Markdown aparecerá aqui..."
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
