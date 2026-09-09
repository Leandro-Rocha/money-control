# Catálogo de Primitivas de UI

Referência rápida para uso das primitivas compartilhadas do projeto.

---

## 1. PageHeader

Local: `src/components/PageHeader.tsx`

Usado no topo de abas, páginas e seções principais.

```tsx
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Wallet } from "lucide-react";

<PageHeader
  title="Contas Bancárias"
  description="Gerencie saldos, extratos e conciliação bancária."
  icon={<Wallet className="h-6 w-6" />}
  actions={
    <Button onClick={() => setOpenNew(true)}>
      <Plus className="mr-2 h-4 w-4" /> Nova Conta
    </Button>
  }
/>
```

---

## 2. EmptyState

Local: `src/components/EmptyState.tsx`

Exibido quando não há dados em tabelas, abas, listas ou buscas.

```tsx
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { PlusCircle, SearchX } from "lucide-react";

// Estado vazio padrão com CTA
<EmptyState
  icon={PlusCircle}
  title="Nenhuma transação encontrada"
  description="Você ainda não registrou lançamentos para este mês."
  action={
    <Button size="sm" onClick={() => setOpenModal(true)}>
      Adicionar Transação
    </Button>
  }
/>

// Estado compacto para cards ou buscas filtradas
<EmptyState
  compact
  icon={SearchX}
  title="Nenhum resultado"
  description="Tente ajustar os termos da pesquisa."
/>
```

---

## 3. StatCard

Local: `src/components/StatCard.tsx`

Exibição de métricas numéricas e financeiras com suporte automático a privacidade (`tabular-nums`).

```tsx
import { StatCard } from "@/components/StatCard";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";

<div className="grid gap-4 md:grid-cols-3">
  <StatCard
    title="Saldo Consolidado"
    value="R$ 15.420,50"
    icon={<Wallet className="h-4 w-4" />}
  />

  <StatCard
    title="Receitas Previstas"
    value="R$ 8.500,00"
    icon={<ArrowUpRight className="h-4 w-4" />}
    variant="income"
    trend={{ value: "+12%", isPositive: true, label: "vs mês anterior" }}
  />

  <StatCard
    title="Despesas Previstas"
    value="R$ 4.230,10"
    icon={<ArrowDownRight className="h-4 w-4" />}
    variant="expense"
  />
</div>
```

---

## 4. ModalShell

Local: `src/components/ModalShell.tsx`

Casca padronizada para modais completos. Inclui backdrop, animação, suporte a ESC, título e rodapé fixo.

```tsx
import { ModalShell } from "@/components/ModalShell";
import { Button } from "@/components/ui/button";

<ModalShell
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Editar Categoria"
  subtitle="Altere os limites e regras da categoria selecionada"
  maxWidth="max-w-lg"
  footer={
    <>
      <Button variant="ghost" onClick={() => setIsOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={handleSave}>
        Salvar Alterações
      </Button>
    </>
  }
>
  <div className="space-y-4">
    {/* Formulário / Campos */}
  </div>
</ModalShell>
```
