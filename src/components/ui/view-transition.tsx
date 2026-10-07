"use client";

import * as React from "react";

interface ViewTransitionProps {
  children: React.ReactNode;
  name?: string;
  share?: string;
  enter?: string;
  exit?: string;
  default?: string;
}

// O React do App Router (canary) exporta ViewTransition; o React estável dos testes não.
const ViewTransition = (React as unknown as { ViewTransition?: React.ComponentType<ViewTransitionProps> })
  .ViewTransition;

/**
 * Troca de tela com crossfade (View Transitions API). Só anima quando a troca
 * acontece dentro de startTransition. Sem suporte (React ou navegador), só troca.
 */
export function ScreenTransition({
  screenKey,
  name = "screen",
  children,
}: {
  screenKey: string;
  /** Único por página: desktop e celular ficam montados juntos até a hidratação. */
  name?: string;
  children: React.ReactNode;
}) {
  if (!ViewTransition) return <React.Fragment key={screenKey}>{children}</React.Fragment>;
  return (
    <ViewTransition key={screenKey} name={name} share="auto" enter="auto" default="none">
      {children}
    </ViewTransition>
  );
}
