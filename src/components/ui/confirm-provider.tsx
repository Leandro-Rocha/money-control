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

const fallback: Ask = async (req) => window.confirm(typeof req === "string" ? req : req.title);

const ConfirmContext = React.createContext<Ask>(fallback);

export function useConfirm(): Ask {
  return React.useContext(ConfirmContext);
}

interface Pending {
  req: Exclude<ConfirmRequest, string>;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const settled = React.useRef(false);

  const ask = React.useCallback<Ask>(
    (req) =>
      new Promise<boolean>((resolve) => {
        settled.current = false;
        setPending({ req: typeof req === "string" ? { title: req } : req, resolve });
      }),
    [],
  );

  const settle = (v: boolean) => {
    if (!pending || settled.current) return;
    settled.current = true;
    pending.resolve(v);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <ConfirmDialog
        open={pending != null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
        title={pending?.req.title ?? ""}
        description={pending?.req.description}
        confirmLabel={pending?.req.confirmLabel}
        cancelLabel={pending?.req.cancelLabel}
        variant={pending?.req.variant ?? "destructive"}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}
