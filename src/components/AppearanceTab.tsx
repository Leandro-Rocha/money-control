"use client";

import { useId, useState } from "react";
import {
  ACCENT_PRESETS,
  applyAccent,
  applyCountUp,
  applyMotion,
  parseAccent,
  type AccentId,
  type CountUpPref,
  type MotionPref,
} from "@/lib/appearance";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { LiveChip } from "@/components/ui/live-chip";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

const PREVIEW_SYNC = new Date(2026, 0, 1, 9, 41);

function htmlHas(cls: string): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains(cls);
}

export function AppearanceTab() {
  const [accent, setAccent] = useState<AccentId>(() =>
    parseAccent(typeof document === "undefined" ? null : document.documentElement.dataset.accent),
  );
  const [motion, setMotion] = useState<MotionPref>(() => (htmlHas("motion-off") ? "off" : "on"));
  const [countUp, setCountUp] = useState<CountUpPref>(() => (htmlHas("countup-off") ? "off" : "on"));

  return (
    <div className="flex max-w-xl flex-col gap-7">
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">Cor de destaque</h3>
          <p className="text-xs text-mut">Abas, gráfico, selos e barras. Vermelho e âmbar de alerta não mudam.</p>
        </div>
        <div role="radiogroup" aria-label="Cor de destaque" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={accent === p.id}
              onClick={() => {
                applyAccent(p.id);
                setAccent(p.id);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors duration-(--dur-fast)",
                accent === p.id ? "border-ink font-semibold text-ink" : "border-line text-mut hover:bg-hover hover:text-ink",
              )}
            >
              <span aria-hidden className="size-4 shrink-0 rounded-full" style={{ backgroundColor: p.accent }} />
              {p.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Prévia" className="flex flex-wrap items-center gap-3 rounded-lg bg-hover p-3">
          <LiveChip at={PREVIEW_SYNC} />
          <Button size="sm" variant="accent" type="button" tabIndex={-1}>
            Botão
          </Button>
          <Tag variant="reimbursable">reemb.</Tag>
          <Money value={-188} tone="balance" className="ml-auto text-sm" />
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <Eyebrow as="h3">Movimento</Eyebrow>
        <Toggle
          label="Animações e transições"
          on={motion === "on"}
          onChange={(on) => {
            const pref: MotionPref = on ? "on" : "off";
            applyMotion(pref);
            setMotion(pref);
          }}
        />
        <Toggle
          label="Contar saldo ao abrir"
          on={countUp === "on"}
          onChange={(on) => {
            const pref: CountUpPref = on ? "on" : "off";
            applyCountUp(pref);
            setCountUp(pref);
          }}
        />
      </section>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
      <span id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-(--dur-fast)",
          on ? "bg-accent" : "bg-line",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 top-0.5 size-4 rounded-full bg-tile shadow-tile transition-transform duration-(--dur-fast)",
            on && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}
