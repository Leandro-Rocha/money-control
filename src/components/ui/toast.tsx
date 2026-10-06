"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastOptions {
  tone?: "default" | "error";
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

const EMPTY: ToastItem[] = [];
let items: ToastItem[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, opts: ToastOptions = {}): number {
  const id = nextId++;
  const duration = opts.duration ?? (opts.tone === "error" ? 6000 : 2600);
  items = [...items, { id, message, ...opts }];
  emit();
  setTimeout(() => dismissToast(id), duration);
  return id;
}

toast.error = (message: string, opts: Omit<ToastOptions, "tone"> = {}) => toast(message, { ...opts, tone: "error" });

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function Toaster() {
  const list = React.useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-60 flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex max-w-md items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm shadow-tile-up",
            "animate-in fade-in-0 slide-in-from-bottom-3 duration-(--dur)",
            t.tone === "error" ? "bg-negative text-white" : "bg-ink text-tile",
          )}
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              className="font-semibold text-accent-soft underline-offset-2 hover:underline"
              onClick={() => {
                t.action!.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button aria-label="Fechar aviso" className="opacity-60 hover:opacity-100" onClick={() => dismissToast(t.id)}>
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
