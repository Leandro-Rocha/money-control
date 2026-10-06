import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export interface MoneyProps {
  value: number;
  tone?: "neutral" | "balance";
  cushion?: number;
  projected?: boolean;
  sign?: boolean;
  currency?: boolean;
  className?: string;
}

/**
 * Único jeito de mostrar dinheiro. Negativo entre parênteses; lançamento
 * nunca tem cor; só saldo (tone="balance") fica vermelho (< 0) ou âmbar
 * (abaixo do colchão). Positivo leva um ")" invisível para os dígitos
 * alinharem com os negativos numa coluna.
 */
export function Money({
  value,
  tone = "neutral",
  cushion,
  projected = false,
  sign = false,
  currency = false,
  className,
}: MoneyProps) {
  const base = "font-mono tabular-nums whitespace-nowrap privacy-sensitive";

  if (!Number.isFinite(value)) {
    return <span className={cn(base, "text-faint", className)}>—</span>;
  }

  const v = Math.abs(value) < 0.005 ? 0 : value;
  const negative = v < 0;
  let text = formatCurrency(v, sign);
  if (currency) text = negative ? `(R$ ${text.slice(1)}` : `R$ ${text}`;

  const color = projected
    ? "text-faint"
    : tone === "balance" && negative
      ? "text-negative"
      : tone === "balance" && cushion != null && v < cushion
        ? "text-caution"
        : undefined;

  return (
    <span className={cn(base, color, className)}>
      {text}
      {!negative && (
        <span data-money-pad aria-hidden="true" className="invisible">
          )
        </span>
      )}
    </span>
  );
}
