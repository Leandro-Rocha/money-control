## Context

Ver `proposal.md` para motivação e contexto do problema.
O projeto utiliza Next.js (App Router), Tailwind CSS e componentes base do Shadcn UI com Lucide Icons. Atualmente o `MonthHeader.tsx` recebe callbacks para as ações de transferências, projeções, importação, insights, exportação e logout.

## Goals / Non-Goals

**Goals:**
- Estruturar o cluster de botões do `MonthHeader` com clara hierarquia: primário para importação, secundários neutros para transferências/projeções e agrupamento em dropdown para análises (Insights + Exportar IA).
- Migrar o botão de Configurações do FAB no rodapé para o cabeçalho superior direito.
- Aplicar classes de alinhamento tabular (`font-mono tabular-nums text-right`) nas tabelas financeiras para garantir alinhamento vertical dos centavos.
- Aprimorar a barra de filtros com contagem de filtros ativos e ação de "Limpar Filtros".
- Garantir suporte e consistência visual tanto no modo claro quanto escuro.

**Non-Goals:**
- Não alterar as regras de cálculo financeiro, backend, Drizzle ORM ou schemas de banco de dados.
- Não alterar o layout de colunas paralelas (Contas vs Cartões de Crédito), preservando a dinâmica operacional estabelecida.
- Não alterar o funcionamento interno dos modais existentes (`InsightsModal`, `ExportPeriodModal`, `ImportStagingModal`, etc.).

## Decisions

### 1. Dropdown "Análises" no Header
- **Decisão**: Criar um componente de dropdown leve (ou menu suspenso nativo com acessibilidade e fechamento via click-outside/Escape) agrupando:
  - *Visão Geral de Gastos* (ícone `PieChart`, aciona `onOpenInsights`).
  - *Exportar para IA* (ícone `Sparkles`, aciona `onOpenExport`).
- **Alternativa considerada**: Manter dois botões separados com nomes maiores. *Descartada* porque polui o header e causa quebra em telas menores.

### 2. Destaque Primário para Importação
- **Decisão**: Botão `Importar` com estilo `variant="default"` (fundo escuro/primário e texto claro), ícone `UploadCloud` e label "Importar".
- **Alternativa considerada**: Manter como `variant="outline"`. *Descartada* pois importação é a principal porta de entrada mensal de novos dados.

### 3. Eliminação do FAB de Configurações
- **Decisão**: Passar callback `onOpenSettings` para o `MonthHeader` e renderizar o ícone de engrenagem em grupo utilitário com `Sair`, removendo o botão flutuante fixo.
- **Alternativa considerada**: Manter o FAB e esconder em telas menores. *Descartada* porque o FAB sobrepõe linhas de saldo da tabela de contas.

### 4. Alinhamento Tabular (`tabular-nums`)
- **Decisão**: Utilizar `tabular-nums font-mono` nas colunas de valores em `BankAccountColumn.tsx` e `CreditCardColumn.tsx`, mantendo alinhamento à direita.
- **Alternativa considerada**: Manter fontes padrão proporcionais. *Descartada* pois gera desalinhamento de casas decimais ao comparar valores na vertical.

## Risks / Trade-offs

- [Redução de visibilidade imediata de "Exportar IA"] → Mitigado por estar no primeiro nível do menu "Análises" com ícone `Sparkles` e descrição contextual clara.
- [Adaptação do usuário ao novo local de Configurações] → Mitigado por posicionar no padrão universal web (canto superior direito do cabeçalho).
