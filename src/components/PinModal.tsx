"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePrivacy } from "@/context/PrivacyContext";
import { Lock, Eye, EyeOff, Loader2, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalShell } from "./ModalShell";

export function PinModal() {
  const { isPinModalOpen, closePinModal, verifyAndUnlock } = usePrivacy();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showClearPin, setShowClearPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPinModalOpen) {
      setPin("");
      setError(null);
      setIsLoading(false);
      // Foco automático no input ao abrir
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isPinModalOpen]);

  if (!isPinModalOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyAndUnlock(pin);
      if (!result.success) {
        setError(result.error || "PIN incorreto.");
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Erro ao verificar PIN. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closePinModal();
    }
  };

  return (
    <div className="no-privacy-blur" onKeyDown={handleKeyDown}>
      <ModalShell
        open={isPinModalOpen}
        onClose={closePinModal}
        title="Desbloquear Valores"
        subtitle="Digite seu PIN numérico para visualizar os valores da tela."
        maxWidth="max-w-sm"
        icon={<Lock className="text-primary" />}
        footer={
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closePinModal}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="pin-form"
              className="flex-1"
              disabled={!pin.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Validando...
                </>
              ) : (
                "Desbloquear"
              )}
            </Button>
          </div>
        }
      >
        <form id="pin-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <Input
                ref={inputRef}
                type={showClearPin ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Digite o PIN..."
                className="pr-10 text-center tracking-widest text-lg font-mono"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowClearPin(!showClearPin)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                {showClearPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 mt-2 font-medium animate-in fade-in">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-border/50 text-center">
          <span className="text-[11px] text-muted-foreground">
            Esqueceu o PIN? A senha mestra também pode ser usada.
          </span>
        </div>
      </ModalShell>
    </div>
  );
}
