"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
import { Tile } from "@/components/ui/tile";
import { BrandMark } from "@/components/ui/brand-mark";

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
      try {
        const res = await loginAction(password);
        if (res.success) {
          router.push(from);
          router.refresh();
        } else {
          setError(res.error || "Senha incorreta. Tente novamente.");
        }
      } catch (err) {
        console.error("Erro ao entrar:", err);
        setError("Não foi possível entrar agora. Tente de novo.");
      }
    });
  };

  return (
    <Tile as="div" flat className="w-full max-w-sm space-y-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-10 rounded-xl after:inset-x-2.5 after:bottom-2.5 after:h-1" />
        <h1 className="text-xl font-semibold tracking-tight">Money Control</h1>
        <p className="text-sm text-mut">Digite sua senha para acessar suas finanças</p>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2.5 rounded-lg bg-negative-soft p-3 text-sm text-negative">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="password"
          aria-label="Senha"
          placeholder="Sua senha de acesso"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          autoFocus
          className="h-11 rounded-lg px-4 text-base"
        />
        <Button type="submit" variant="accent" className="h-11 w-full gap-2 text-base font-semibold" disabled={isPending || !password}>
          {isPending ? (
            "Verificando..."
          ) : (
            <>
              Entrar <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      <p className="flex items-center justify-center gap-2 border-t border-line pt-3 text-xs text-mut">
        <ShieldCheck className="size-4 text-accent" />
        Sessão segura de 90 dias neste dispositivo
      </p>
    </Tile>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg p-4">
      <Suspense fallback={<p className="text-sm text-mut">Carregando...</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
