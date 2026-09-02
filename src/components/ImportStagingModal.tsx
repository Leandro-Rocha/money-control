"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Category, TransactionWithCategory, Account } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X, Copy, Check, AlertTriangle, ArrowRight, UploadCloud } from "lucide-react";
import { createMultipleTransactions, getTransactionRules } from "@/lib/actions";

interface ImportStagingModalProps {
  month: string;
  accounts: Account[];
  categories: Category[];
  existingTransactions: TransactionWithCategory[];
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  id: string; // temp id
  day: number;
  description: string;
  originalDescription?: string;
  createRule?: boolean;
  rulePattern?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  amount: number;
  categoryId: number | null;
  categoryNameExtracted: string;
  isDuplicate: boolean;
  ignored: boolean;
  isPastMonth: boolean;
}

export function ImportStagingModal({
  month,
  accounts,
  categories,
  existingTransactions,
  onClose,
  onSuccess,
}: ImportStagingModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id || 0);
  const [pastedText, setPastedText] = useState("");
  const [rules, setRules] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -- Prompt Generation
  const promptText = useMemo(() => {
    const catNames = categories.map(c => c.name).join(", ");
    const [y, m] = month.split("-");
    const targetMonth = `${m}/${y}`;
    
    return `Vou colar um extrato ou fatura. Extraia as transações e retorne APENAS uma tabela no formato TSV (Tab-Separated Values) estrito, sem formatação markdown em volta, com exatamente 7 colunas:

Data	Nome Original	Nome Limpo	Valor	Categoria	Parcela Atual	Total Parcelas

Regras:
1. Data: Extraia a data no formato em que aparece, preferencialmente DD/MM (ex: 02/10).
2. Nome Original: Exatamente como aparece no extrato, sem limpar (ex: PGTO *UBER SAOPAULO 02/10).
3. Nome Limpo: Versão amigável e limpa, SEM informações de parcelamento (ex: Uber).
4. Valor: Numérico, sem 'R$'. Saídas/Gastos devem ser negativos.
5. Categoria: Categorize usando ESTRITAMENTE uma destas categorias: [${catNames}]. Se não souber, deixe em branco.
6. Parcela Atual e Total: Se o nome original indicar parcelamento (ex: 02/05, PARC 2/5), extraia o número da parcela atual para a Coluna 6 e o total para a Coluna 7. Se não houver, deixe ambas em branco.
7. Não filtre por mês: extraia ABSOLUTAMENTE TODOS os lançamentos cobrados, independentemente da data da compra original.
8. Ordem: Retorne as linhas ordenadas por Dia (do menor para o maior).`;
  }, [categories, month]);

  useEffect(() => {
    getTransactionRules().then(data => setRules(data.filter((r: any) => r.active === 1)));
  }, []);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pastedText.trim().length > 0 || step === 2) {
          if (window.confirm("Tem certeza que deseja fechar? Os dados da importação serão perdidos.")) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, pastedText, step]);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // -- TSV Parser & Deduplication
  const handleParse = () => {
    if (!pastedText.trim()) return;

    const lines = pastedText.trim().split("\n");
    const rows: ParsedRow[] = [];

    const accountTx = existingTransactions.filter(t => t.accountId === accountId);

    lines.forEach((line, idx) => {
      const parts = line.split("\t");
      if (parts.length < 4) return; // Skip invalid lines
      
            if (parts[0].toLowerCase().includes("data") && (parts[1].toLowerCase().includes("nome") || parts[1].toLowerCase().includes("desc"))) return;

      let dayStr = parts[0].trim();
      let extractedMonth: number | null = null;
      if (dayStr.includes("/")) {
        const dParts = dayStr.split("/");
        dayStr = dParts[0].replace(/\D/g, "");
        const mStr = dParts[1].replace(/\D/g, "");
        if (mStr) extractedMonth = parseInt(mStr, 10);
      } else {
        dayStr = dayStr.replace(/\D/g, "");
      }

      const day = parseInt(dayStr, 10);
      if (isNaN(day)) return;

      const targetMonthNum = parseInt(month.split("-")[1], 10);
      const isPastMonth = extractedMonth !== null && extractedMonth !== targetMonthNum;

      const originalDescription = parts[1].trim();
      let description = parts[2].trim();
      
      let amountStr = parts[3].replace(/[R$\s]/g, "");
      if (amountStr.includes(",") && amountStr.includes(".")) {
        if (amountStr.lastIndexOf(",") > amountStr.lastIndexOf(".")) {
          amountStr = amountStr.replace(/\./g, "").replace(",", ".");
        } else {
          amountStr = amountStr.replace(/,/g, "");
        }
      } else if (amountStr.includes(",")) {
        amountStr = amountStr.replace(",", ".");
      }
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) return;

      let catExtracted = parts[4]?.trim() || "";
      let matchedCatId: number | null = null;
      
      // -- RULE ENGINE (Longest Match Wins) --
      let matchedRule: any = null;
      const lowerOrig = originalDescription.toLowerCase();
      
      rules.forEach(rule => {
        if (lowerOrig.includes(rule.pattern.toLowerCase())) {
          if (!matchedRule || rule.pattern.length > matchedRule.pattern.length) {
            matchedRule = rule;
          }
        }
      });

      if (matchedRule) {
        description = matchedRule.targetDescription;
        matchedCatId = matchedRule.categoryId || null;
        catExtracted = "Definido por Regra";
      } else {
        if (catExtracted && catExtracted.toLowerCase() !== "sem categoria") {
          const found = categories.find(c => c.name.toLowerCase() === catExtracted.toLowerCase());
          if (found) matchedCatId = found.id;
        }
      }

      const isDup = accountTx.some(t => t.day === day && t.amount === amount);

      let instCur: number | undefined;
      let instTot: number | undefined;
      if (parts[5] && parts[5].trim() !== "") {
        const parsed = parseInt(parts[5].trim().replace(/\D/g, ""), 10);
        if (!isNaN(parsed)) instCur = parsed;
      }
      if (parts[6] && parts[6].trim() !== "") {
        const parsed = parseInt(parts[6].trim().replace(/\D/g, ""), 10);
        if (!isNaN(parsed)) instTot = parsed;
      }

      rows.push({
        id: `temp-${idx}`,
        day,
        description,
        originalDescription,
        amount,
        categoryId: matchedCatId,
        categoryNameExtracted: catExtracted,
        isDuplicate: isDup,
        ignored: isDup,
        isPastMonth,
        createRule: false,
        rulePattern: originalDescription,
        installmentCurrent: instCur,
        installmentTotal: instTot,
      });
    });

    setParsedRows(rows);
    setStep(2);
  };

  // -- Review Edits
  const toggleIgnore = (id: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, ignored: !r.ignored } : r));
  };

  const handleSelectAll = () => {
    setParsedRows(prev => prev.map(r => ({ ...r, ignored: false })));
  };

  const handleSelectNone = () => {
    setParsedRows(prev => prev.map(r => ({ ...r, ignored: true })));
  };

  const updateRowCategory = (id: string, catId: number | null) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, categoryId: catId } : r));
  };
  
  const updateRowDescription = (id: string, desc: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, description: desc } : r));
  };

  // -- Commit
  const handleCommit = async () => {
    const toInsert = parsedRows.filter(r => !r.ignored).map(r => ({
      accountId,
      month,
      day: r.day,
      description: r.description,
      originalDescription: r.originalDescription,
      amount: r.amount,
      categoryId: r.categoryId,
      installmentCurrent: r.installmentCurrent,
      installmentTotal: r.installmentTotal,
    }));

    if (toInsert.length === 0) {
      onClose();
      return;
    }

    const newRules = parsedRows
      .filter(r => !r.ignored && r.createRule && r.rulePattern?.trim())
      .map(r => ({
        pattern: r.rulePattern!.trim(),
        targetDescription: r.description,
        categoryId: r.categoryId,
      }));

    setIsSubmitting(true);
    await createMultipleTransactions(toInsert, newRules);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-card shrink-0">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-primary" />
              Importar Transações via IA
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {step === 1 ? "Passo 1: Gere os dados estruturados no Gemini e cole aqui." : "Passo 2: Revise os dados e identifique duplicatas antes de salvar."}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="font-semibold text-sm">Instruções para a IA</h3>
                  <Button size="sm" variant="outline" onClick={handleCopyPrompt} className="shrink-0 h-8 text-xs">
                    {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copied ? "Copiado!" : "Copiar Prompt"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Copie o prompt abaixo e cole no Gemini ou ChatGPT junto com o seu PDF/Extrato. Ele vai gerar os dados formatados exatamente com as suas categorias.</p>
                <div className="bg-background p-3 rounded text-xs font-mono text-slate-700 whitespace-pre-wrap border">
                  {promptText}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Conta de Destino</label>
                  <select 
                    value={accountId} 
                    onChange={e => setAccountId(Number(e.target.value))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Mês de Destino</label>
                  <div className="h-10 rounded-md border border-input bg-muted px-3 flex items-center text-sm font-semibold">
                    {month}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center justify-between">
                  <span>Cole o TSV gerado aqui</span>
                </label>
                <textarea 
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  className="w-full h-48 rounded-md border border-input bg-background p-3 text-sm font-mono placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={`12\tPGTO *MERCADO EXTRA\tMercado Extra\t-150.00\tMercado\n15\tTED SALARIO\tSalário\t5000.00\tReceita`}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">Atenção a duplicatas!</p>
                  <p>Linhas amarelas indicam transações que já parecem existir neste mês (mesmo dia e valor). Elas foram marcadas para ser ignoradas por padrão, mas você pode desmarcá-las se forem legítimas.</p>
                </div>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-sm font-semibold text-slate-700">Transações extraídas ({parsedRows.length})</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-7 text-xs">Selecionar Todas</Button>
                  <Button variant="outline" size="sm" onClick={handleSelectNone} className="h-7 text-xs">Nenhuma</Button>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden bg-card">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-2 w-10 text-center"><Check className="w-4 h-4 mx-auto text-slate-500" /></th>
                      <th className="px-4 py-2 font-semibold">Dia</th>
                      <th className="px-4 py-2 font-semibold">Descrição</th>
                      <th className="px-4 py-2 font-semibold text-right">Valor</th>
                      <th className="px-4 py-2 font-semibold">Categoria</th>
                      <th className="px-4 py-2 font-semibold w-24">Parcela</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    
                    {[
                      { title: "Transações do Mês Alvo", rows: parsedRows.filter(r => !r.isPastMonth) },
                      { title: "Parcelas e Compras Anteriores", rows: parsedRows.filter(r => r.isPastMonth) }
                    ].filter(g => g.rows.length > 0).map((group, groupIdx, arr) => (
                      <React.Fragment key={groupIdx}>
                        {arr.length > 1 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-2 bg-slate-100 font-semibold text-xs text-slate-500 uppercase tracking-wider">
                              {group.title}
                            </td>
                          </tr>
                        )}
                        {group.rows.map(row => (
                      <tr key={row.id} className={`${row.ignored ? 'opacity-50 bg-slate-50' : row.isDuplicate ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-2 text-center align-middle">
                          <input 
                            type="checkbox" 
                            checked={!row.ignored}
                            onChange={() => toggleIgnore(row.id)}
                            className="w-4 h-4 rounded border-slate-300 accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-2 align-middle font-medium text-slate-700">{row.day}</td>
                        <td className="px-4 py-2 align-middle">
                          <input 
                            type="text"
                            value={row.description}
                            onChange={e => updateRowDescription(row.id, e.target.value)}
                            className={`w-full font-medium bg-transparent border-none p-0 h-auto focus:ring-0 ${!row.ignored && row.isDuplicate ? 'text-amber-700' : ''}`}
                            disabled={row.ignored}
                          />
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>{row.originalDescription}</span>
                            {!row.ignored && (
                              <label className="flex items-center gap-1 cursor-pointer hover:text-indigo-500 transition-colors">
                                <input 
                                  type="checkbox" 
                                  className="w-3 h-3 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={row.createRule}
                                  onChange={e => {
                                    setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, createRule: e.target.checked } : r));
                                  }}
                                />
                                Salvar como regra
                              </label>
                            )}
                          </div>
                          {row.createRule && (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase text-indigo-400">Match:</span>
                              <input 
                                type="text"
                                value={row.rulePattern}
                                onChange={e => {
                                  setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, rulePattern: e.target.value } : r));
                                }}
                                className="h-5 text-[10px] px-1 py-0 w-32 border border-indigo-200 rounded text-indigo-700 bg-indigo-50/50"
                                title="Edite o pedaço de texto que servirá como regra (ex: remova datas)"
                              />
                            </div>
                          )}
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold align-middle whitespace-nowrap ${row.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-2 align-middle max-w-[150px]">
                          <select
                            value={row.categoryId || ""}
                            onChange={e => updateRowCategory(row.id, e.target.value ? Number(e.target.value) : null)}
                            className="w-full max-w-full text-xs rounded border-slate-200 py-1 px-2 focus:ring-1 focus:ring-primary bg-white disabled:bg-transparent"
                            disabled={row.ignored}
                          >
                            <option value="">Sem categoria</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          {row.categoryNameExtracted && !row.categoryId && (
                            <p className="text-[10px] text-rose-500 mt-0.5 truncate" title={`A IA sugeriu: ${row.categoryNameExtracted}`}>
                              Não encontrada: {row.categoryNameExtracted}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2 align-middle text-center text-xs text-slate-600 font-medium whitespace-nowrap">
                          {row.installmentCurrent && row.installmentTotal
                            ? `${row.installmentCurrent}/${row.installmentTotal}`
                            : row.installmentCurrent
                              ? row.installmentCurrent
                              : '-'}
                        </td>
                      </tr>
                    ))}
                      </React.Fragment>
                    ))}
                    {parsedRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma transação extraída.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between shrink-0">
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleParse} disabled={!pastedText.trim()}>
                Avançar para Revisão <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)} disabled={isSubmitting}>Voltar</Button>
              <Button onClick={handleCommit} disabled={isSubmitting || parsedRows.filter(r => !r.ignored).length === 0} className="bg-primary text-primary-foreground">
                {isSubmitting ? "Salvando..." : `Salvar ${parsedRows.filter(r => !r.ignored).length} Transações`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
