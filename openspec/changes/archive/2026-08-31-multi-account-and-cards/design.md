## Context

See proposal.md for motivation. The current implementation relies on hardcoded data for 'Itaú' (ID 1) and 'Cartão Azul' (ID 2). We are using SQLite with Drizzle ORM.

## Goals / Non-Goals

**Goals:**
- Criar a entidade `accounts` no banco de dados.
- Renderizar o Dashboard com 2 pilares fixos (Contas Correntes e Cartões de Crédito), empilhando as contas verticalmente dentro deles.

**Non-Goals:**
- Sincronização em nuvem ou suporte multi-usuário.

## Decisions

- **Account schema**: A nova tabela `accounts` terá colunas: `id`, `name`, `type` (TEXT check para 'bank_account' ou 'credit_card'), `color` (opcional), e timestamps. 
- **Migration**: Criaremos a tabela, e um script de seed que converterá qualquer menção das antigas contas fixas (IDs 1 e 2) para contas dinâmicas recém criadas, para evitar perda de dados.
- **UI Dashboard**: Manteremos a estrutura de 2 pilares principais (`flex-row`). O primeiro pilar terá um `.map()` empilhando os componentes `BankAccountColumn` verticalmente. O segundo pilar empilhará os componentes `CreditCardColumn`. Cada componente de conta aplicará a cor escolhida pelo usuário como uma borda no topo do Card (`border-t-4`), mantendo o design minimalista.
- **Account Management UI (Central de Configurações)**: Criaremos um `SettingsDrawer` unificado. Ele será acessado por um ícone de engrenagem fixo no canto inferior esquerdo da tela (padrão de interfaces modernas). O Drawer conterá `Tabs` para organizar o gerenciamento de 'Contas e Cartões', 'Categorias', e 'Lançamentos Recorrentes', absorvendo a funcionalidade que antes ficava solta no cabeçalho.

## Risks / Trade-offs

- **Layout vertical longo** → Como empilharemos as contas, usuários com muitos bancos e cartões terão que rolar a tela verticalmente. *Mitigação*: Implementar o recurso de 'Collapse' (sanfona) de contas no futuro, caso a rolagem se torne excessiva.
