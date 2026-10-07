"use client";

import * as React from "react";
import { ConfirmDialog } from "./confirm-dialog";

export type ConfirmRequest =
  | string
  | {
      title: string;
      description?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: "destructive" | "default";
    };

type Ask = (req: ConfirmRequest) => Promise<boolean>;

const fallback: Ask = async () => {
  console.error("useConfirm usado fora do ConfirmProvider; a ação foi cancelada.");
  return false;
};

const ConfirmContext = React.createContext<Ask>(fallback);

export function useConfirm(): Ask {
  return React.useContext(ConfirmContext);
}

interface Pending {
  id: number;
  req: Exclude<ConfirmRequest, string>;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  // Fonte da verdade fora do ciclo de render: callbacks atrasados do diálogo
  // (onOpenChange depois de onConfirm) não podem fechar um pedido mais novo.
  const current = React.useRef<Pending | null>(null);
  const nextId = React.useRef(1);

  const settle = React.useCallback((id: number, v: boolean) => {
    const p = current.current;
    if (!p || p.id !== id) return;
    current.current = null;
    p.resolve(v);
    setPending(null);
  }, []);

  const ask = React.useCallback<Ask>(
    (req) =>
      new Promise<boolean>((resolve) => {
        // Um pedido por vez: o anterior, se houver, conta como cancelado.
        if (current.current) settle(current.current.id, false);
        const p = { id: nextId.current++, req: typeof req === "string" ? { title: req } : req, resolve };
        current.current = p;
        setPending(p);
      }),
    [settle],
  );

  const id = pending?.id ?? 0;

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <ConfirmDialog
        open={pending != null}
        onOpenChange={(open) => {
          if (!open) settle(id, false);
        }}
        title={pending?.req.title ?? ""}
        description={pending?.req.description}
        confirmLabel={pending?.req.confirmLabel}
        cancelLabel={pending?.req.cancelLabel}
        variant={pending?.req.variant ?? "destructive"}
        onConfirm={() => settle(id, true)}
      />
    </ConfirmContext.Provider>
  );
}
