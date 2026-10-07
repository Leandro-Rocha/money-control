export interface AllocationSegment {
  key: "liquidity" | "investments" | "receivables" | "debts";
  label: string;
  value: number;
  /** Porcentagem do total bruto (ativos positivos + dívidas). */
  share: number;
}

export interface Allocation {
  netWorth: number;
  segments: AllocationSegment[];
}

/** Barra de alocação do Patrimônio. `liquidity` null = previsão ainda não carregada. */
export function allocation({
  liquidity,
  investments,
  receivables,
  debts,
}: {
  liquidity: number | null;
  investments: number;
  receivables: number;
  debts: number;
}): Allocation {
  const netWorth = (liquidity ?? 0) + investments + receivables - debts;
  const parts: Omit<AllocationSegment, "share">[] = [
    { key: "liquidity", label: "Liquidez", value: liquidity ?? 0 },
    { key: "investments", label: "Investimentos", value: investments },
    { key: "receivables", label: "A receber", value: receivables },
    { key: "debts", label: "Dívidas", value: debts },
  ];
  const visible = parts.filter((p) => p.value > 0);
  const total = visible.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return { netWorth, segments: [] };
  return { netWorth, segments: visible.map((p) => ({ ...p, share: (p.value / total) * 100 })) };
}
