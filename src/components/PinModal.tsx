"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePrivacy } from "@/context/PrivacyContext";
import { Lock, Eye, EyeOff, Loader2, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 no-privacy-blur"
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-card text-card-foreground w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 no-privacy-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Lock className="w-5 h-5" />
            </div>
            <button
              onClick={closePinModal}
              className="text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-lg font-bold tracking-tight">Desbloquear Valores</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-5">
            Digite seu PIN numérico para visualizar os valores da tela.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="flex items-center gap-2 pt-2">
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
          </form>

          <div className="mt-4 pt-3 border-t border-border/50 text-center">
            <span className="text-[11px] text-muted-foreground">
              Esqueceu o PIN? A senha mestra também pode ser usada.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
