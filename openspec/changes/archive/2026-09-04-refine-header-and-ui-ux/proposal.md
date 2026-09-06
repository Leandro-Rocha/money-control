## Why

A interface atual do Money Control possui alto valor operacional com seu layout paralelo de contas e cartões, mas acumula inconsistências visuais e de usabilidade:
1. O cabeçalho do mês (`MonthHeader`) possui 6 botões soltos com cores arbitrárias e desiguais ("salada de cores"), rótulos ambíguos ("IA" vs "Exportar IA") e flat hierarchy, causando sobrecarga cognitiva e quebras de linha em telas intermediárias.
2. Acessos a utilitários cruciais estão fragmentados, com o botão de Configurações solto em um botão flutuante (FAB) no rodapé esquerdo, cobrindo dados da tabela.
3. Valores monetários nas tabelas não utilizam alinhamento numérico tabular (`tabular-nums`), prejudicando a escaneabilidade financeira vertical.
4. A barra de filtros global carece de feedback de estado ativo e botão direto de limpeza.

Organizar esses elementos eleva o acabamento visual do produto para nível profissional sem alterar a dinâmica de alta produtividade já consolidada.

## What Changes

- **MonthHeader Action Cluster**: Reorganização dos botões em torno de uma hierarquia semântica:
  - Destaque primário sólido para **Importar Extrato/Fatura** (`UploadCloud`).
  - Criação de menu dropdown unificado **Análises** agrupando *Visão Geral de Gastos* (`InsightsModal`) e *Exportar IA* (`ExportPeriodModal`), eliminando o conflito de rótulos com "IA".
  - Botões de apoio neutros e padronizados para **Transferências** e **Projeções** (sem cores de arco-íris concorrentes).
  - Reposicionamento do atalho de **Configurações** no topo direito, ao lado de **Sair**, eliminando o botão flutuante (FAB) no rodapé da página.
  - Correção de conflito de classes nos seletores de navegação de mês (`text-white` com `text-muted-foreground`).
- **Legibilidade Numérica Tabular**: Aplicação de formatação `font-mono tabular-nums text-right` em todas as colunas financeiras de contas e cartões.
- **Barra de Filtros Global**: Adição de ação de limpar filtros ("Limpar") e badge/indicador visual de quantidade de filtros ativos.
- **Destaque do Cabeçalho de Cartões**: Exibição aprimorada do total da fatura e contraste visual no topo da coluna de cartão.

## Capabilities

### New Capabilities
- `ui/header-navigation-and-actions`: Estruturação da navegação mensal, agrupamento de ações de importação, análises e configurações no cabeçalho.
- `ui/design-system-and-readability`: Padrões de alinhamento tabular de valores monetários, paleta semântica coerente e controle integrado da barra de filtros.

### Modified Capabilities
<!-- Nenhuma especificação de regra de negócio existente foi modificada -->

## Impact

- **Componentes Afetados**:
  - `src/components/MonthHeader.tsx`
  - `src/components/Dashboard.tsx`
  - `src/components/BankAccountColumn.tsx`
  - `src/components/CreditCardColumn.tsx`
- **Dependências de UI**: Utilização de dropdown / popover já presente no Shadcn (`components/ui/dropdown-menu` ou similar caso necessário, ou popover/select existente).
- **Sem quebras de API ou banco de dados**: Mudanças estritamente de apresentação, ergonomia e layout no cliente.
