"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getForecastSettingsAction, saveForecastSettingsAction } from "@/lib/actions/forecast";
import { parseNumberInput } from "@/lib/format";

type Settings = Awaited<ReturnType<typeof getForecastSettingsAction>>;

const FIELDS: { key: keyof Settings; label: string; help: string; min: number; max: number }[] = [
  {
    key: "cushion",
    label: "Colchão (R$)",
    help: "Quanto você quer manter sempre nas contas. O “livre para gastar” já desconta esse valor.",
    min: 0,
    max: 1_000_000,
  },
  {
    key: "horizonDays",
    label: "Horizonte (dias)",
    help: "Até quantos dias à frente a previsão é calculada.",
    min: 30,
    max: 400,
  },
  {
    key: "reimbursementLagDays",
    label: "Prazo de reembolso (dias)",
    help: "Quantos dias depois da despesa reembolsável o crédito costuma cair.",
    min: 0,
    max: 180,
  },
  {
    key: "overdueLookbackDays",
    label: "Tolerância de atraso (dias)",
    help: "Itens previstos que não apareceram no extrato há até N dias continuam contando (como se fossem hoje). Mais antigos são ignorados.",
    min: 0,
    max: 60,
  },
];

export function ForecastSettingsTab({ onRefresh }: { onRefresh: () => void }) {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getForecastSettingsAction().then((s) => setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])]))));
  }, []);

  if (!values) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const save = () => {
    const out: Partial<Settings> = {};
    for (const f of FIELDS) {
      const v = parseNumberInput(values[f.key]);
      if (v == null || v < f.min || v > f.max) {
        setError(`${f.label}: valor entre ${f.min} e ${f.max}.`);
        return;
      }
      out[f.key] = v;
    }
    setError(null);
    startTransition(async () => {
      await saveForecastSettingsAction(out);
      setSaved(true);
      onRefresh();
    });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-lg font-medium">Previsão de caixa</h3>
        <p className="text-sm text-muted-foreground">Parâmetros usados nas telas Hoje, Plano e Revisar.</p>
      </div>
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`fs-${f.key}`}>
            {f.label}
          </label>
          <Input
            id={`fs-${f.key}`}
            inputMode="decimal"
            value={values[f.key]}
            onChange={(e) => {
              setSaved(false);
              setValues({ ...values, [f.key]: e.target.value });
            }}
            className="max-w-[180px]"
          />
          <p className="text-xs text-muted-foreground">{f.help}</p>
        </div>
      ))}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        {saved && <span className="text-sm text-emerald-600">Salvo.</span>}
      </div>
    </div>
  );
}
