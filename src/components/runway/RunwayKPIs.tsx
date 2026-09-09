import { RunwayKPIs, RunwayHorizon } from "@/lib/types";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { AlertTriangle, ShieldCheck, Calendar, Clock, TrendingUp, TrendingDown } from "lucide-react";

interface RunwayKPIsProps {
  kpis: RunwayKPIs;
  horizon: RunwayHorizon;
}

export function RunwayKPIsView({ kpis, horizon }: RunwayKPIsProps) {
  const isValleyDeficit = kpis.criticalPointBalance < 0;
  const isTightLiquidity = !isValleyDeficit && kpis.criticalPointBalance < 1000;

  const valleyVariant = isValleyDeficit ? "expense" : isTightLiquidity ? "warning" : "income";
  const valleyIcon = isValleyDeficit ? (
    <AlertTriangle className="w-4 h-4 text-rose-500" />
  ) : (
    <ShieldCheck className="w-4 h-4 text-emerald-500" />
  );

  const runwayLabel =
    !kpis.isAlwaysPositive
      ? `${kpis.runwayMonths} ${kpis.runwayMonths === 1 ? "mês" : "meses"}`
      : `${horizon}+ meses`;

  const runwayVariant = !kpis.isAlwaysPositive ? "expense" : "income";

  const burnGainVariant = kpis.averageMonthlyBurnOrGain >= 0 ? "income" : "expense";
  const burnGainIcon =
    kpis.averageMonthlyBurnOrGain >= 0 ? (
      <TrendingUp className="w-4 h-4 text-emerald-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-rose-500" />
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Ponto Crítico (Menor Saldo) */}
      <StatCard
        title="Ponto Crítico"
        value={
          <span className="privacy-sensitive tabular-nums">
            {formatCurrency(kpis.criticalPointBalance)}
          </span>
        }
        icon={valleyIcon}
        variant={valleyVariant}
        description={
          isValleyDeficit
            ? "Saldo final negativo projetado"
            : isTightLiquidity
            ? "Margem de liquidez reduzida"
            : "Liquidez confortável no vale"
        }
      />

      {/* 2. Mês do Vale */}
      <StatCard
        title="Mês do Ponto Crítico"
        value={formatMonthLabel(kpis.criticalPointMonth)}
        icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
        variant={isValleyDeficit ? "expense" : "default"}
        description={
          isValleyDeficit
            ? "Mês com déficit projetado"
            : "Mês com menor saldo acumulado"
        }
      />

      {/* 3. Runway Estimado */}
      <StatCard
        title="Runway Estimado"
        value={runwayLabel}
        icon={<Clock className="w-4 h-4 text-muted-foreground" />}
        variant={runwayVariant}
        description={
          !kpis.isAlwaysPositive
            ? `Caixa negativo a partir do mês ${kpis.runwayMonths + 1}`
            : "Fluxo de caixa sustentável no período"
        }
      />

      {/* 4. Geração Média Mensal */}
      <StatCard
        title="Geração Média Mensal"
        value={
          <span className="privacy-sensitive tabular-nums">
            {kpis.averageMonthlyBurnOrGain >= 0 ? "+" : ""}
            {formatCurrency(kpis.averageMonthlyBurnOrGain)}
          </span>
        }
        icon={burnGainIcon}
        variant={burnGainVariant}
        description="Média do resultado líquido mensal"
      />
    </div>
  );
}
