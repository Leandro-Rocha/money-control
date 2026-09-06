"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isPending) return;

    setError(null);
    startTransition(async () => {
      const res = await loginAction(password);
      if (res.success) {
        router.push(from);
        router.refresh();
      } else {
        setError(res.error || "Senha incorreta. Tente novamente.");
      }
    });
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto shadow-sm">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Money Control
        </h1>
        <p className="text-sm text-slate-500">
          Digite sua senha para acessar suas finanças
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Input
            type="password"
            placeholder="Sua senha de acesso"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            autoFocus
            className="h-11 text-base px-4 rounded-xl border-slate-300 focus-visible:ring-primary"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-base font-semibold rounded-xl shadow-md gap-2"
          disabled={isPending || !password}
        >
          {isPending ? (
            "Verificando..."
          ) : (
            <>
              Entrar <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Sessão segura de 90 dias neste dispositivo</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-200">
      <Suspense fallback={<div className="text-slate-400 text-sm">Carregando...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
