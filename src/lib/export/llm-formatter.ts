import { ExportPeriodData } from "../types";
import { formatMonthLabel } from "../format";

export function formatBRL(value: number, showSign = false): string {
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (value < 0) {
    return `-R$ ${formatted}`;
  }
  if (showSign && value > 0) {
    return `+R$ ${formatted}`;
  }
  return `R$ ${formatted}`;
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatPeriodForLLM(data: ExportPeriodData): string {
  const startLabel = formatMonthLabel(data.startMonth);
  const endLabel = formatMonthLabel(data.endMonth);
  const periodLabel = data.startMonth === data.endMonth ? startLabel : `${startLabel} a ${endLabel}`;
  const monthsCount = data.months.length;

  let savingsRateStr = "N/A";
  if (data.totalIncome > 0) {
    const rate = Math.round((data.netBalance / data.totalIncome) * 1000) / 10;
    savingsRateStr = `${rate.toFixed(1)}%`;
  }

  const lines: string[] = [];

  // 1. Header & System Prompt
  lines.push(`# Dados Financeiros para Análise - ${periodLabel}`);
  lines.push("");
  lines.push("## 1. Instruções para a IA (System Prompt)");
  lines.push("Você é um consultor financeiro pessoal e analista de dados experiente.");
  lines.push("Analise os dados financeiros consolidados abaixo para o período especificado e forneça:");
  lines.push("1. **Diagnóstico da Saúde Financeira**: Equilíbrio entre receitas e despesas, taxa de economia/sobra e comprometimento de renda.");
  lines.push("2. **Principais Categorias de Gastos**: Destaque dos maiores centros de custo, despesas recorrentes e eventuais anomalias.");
  lines.push("3. **Recomendações e Plano de Ação**: Oportunidades de economia, cortes viáveis e sugestões de alocação orçamentária.");
  if (monthsCount > 1) {
    lines.push("4. **Evolução no Período**: Variação mensal de receitas, despesas e comportamento de consumo ao longo dos meses.");
  }
  lines.push("Seja objetivo, claro e oriente com recomendações práticas e acionáveis.");
  lines.push("");
  lines.push("---");
  lines.push("");

  // 2. Executive Summary
  lines.push("## 2. Resumo Executivo");
  lines.push(`- **Período**: ${periodLabel} (${monthsCount} ${monthsCount === 1 ? "mês" : "meses"})`);
  lines.push(`- **Total de Receitas**: ${formatBRL(data.totalIncome)}`);
  lines.push(`- **Total de Despesas**: ${formatBRL(data.totalExpense)}`);
  lines.push(`- **Saldo Líquido**: ${formatBRL(data.netBalance, true)}`);
  lines.push(`- **Taxa de Poupança/Sobra**: ${savingsRateStr}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // 3. Accounts Summary
  if (data.accounts.length > 0) {
    lines.push("## 3. Resumo por Contas e Cartões");
    lines.push("| Conta / Instituição | Tipo | Entradas | Saídas | Saldo Líquido |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const acc of data.accounts) {
      const typeLabel =
        acc.accountType === "credit_card"
          ? "Cartão de Crédito"
          : acc.accountType === "bank_account"
          ? "Conta Bancária"
          : acc.accountType === "investment"
          ? "Investimento"
          : "Outro";
      lines.push(
        `| ${acc.accountName} | ${typeLabel} | ${formatBRL(acc.totalIncome)} | ${formatBRL(acc.totalExpense)} | ${formatBRL(acc.netBalance, true)} |`
      );
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // 4. Categories Summary
  lines.push("## 4. Distribuição por Categorias");
  if (data.categories.length === 0) {
    lines.push("Nenhuma categoria registrada no período.");
  } else {
    lines.push("| Categoria Principal | Despesas | % Despesas | Receitas | Detalhamento de Subcategorias |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const cat of data.categories) {
      const subDetails =
        cat.subcategories.length > 0
          ? cat.subcategories
              .map((s) => `${s.name} (${formatBRL(s.totalAmount)} - ${s.percentage.toFixed(1)}%)`)
              .join("; ")
          : "-";
      lines.push(
        `| ${cat.categoryName} | ${formatBRL(cat.totalExpense)} | ${cat.expensePercentage.toFixed(1)}% | ${formatBRL(cat.totalIncome)} | ${subDetails} |`
      );
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // 5. Chronological Transactions
  const txCount = data.transactions.length;
  lines.push(`## 5. Extrato Cronológico de Transações (${txCount} lançamentos)`);
  if (txCount === 0) {
    lines.push("Nenhuma transação registrada no período.");
  } else {
    lines.push("| Data | Conta | Descrição | Categoria | Valor | Parcela | Observações |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const tx of data.transactions) {
      const catLabel = tx.parentCategoryName
        ? `${tx.parentCategoryName} > ${tx.categoryName}`
        : tx.categoryName;
      const installment = tx.installmentInfo || "-";
      const notes = [
        tx.notes || "",
        tx.isProjected ? "[Projetado]" : "",
      ]
        .filter(Boolean)
        .join(" ");

      lines.push(
        `| ${tx.date} | ${tx.accountName} | ${tx.description} | ${catLabel} | ${formatBRL(tx.amount, true)} | ${installment} | ${notes || "-"} |`
      );
    }
  }
  lines.push("");

  return lines.join("\n");
}
