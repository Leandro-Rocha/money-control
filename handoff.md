# Handoff: Migração de Ambiente (Local -> Servidor Remoto)

## 📌 Estado Atual do Sistema
A arquitetura do projeto foi consolidada ao longo desta sessão. O código atual (já com push na `main`) reflete um sistema de controle financeiro maduro rodando sob **Next.js 16 (App Router)** e **SQLite**.

### Melhorias Arquiteturais Implementadas:
1. **Desacoplamento do Core:** O arquivo massivo `actions.ts` foi desmembrado em um diretório modular (`src/lib/actions/*`) separando lógicas de contas, transações, projeções e regras.
2. **Motor de Banco de Dados:** Migração manual abandonada. O Drizzle ORM agora controla as migrações (usando `drizzle-kit` e `migrate`).
3. **Projeções Diretas no BD:** A lógica pesada do motor de projeções foi transferida da memória da aplicação para consultas Drizzle diretas no SQLite, garantindo extrema performance de leitura.
4. **Testes:** Setup do Vitest concluído, utilizando uma instância de banco `:memory:` SQLite para garantir integridade das lógicas sem tocar em dados reais.

## 💳 Semântica e Lógica de Faturas de Cartão (Credit Card Bills)
Foi feita uma grande reestruturação para suportar faturas com exatidão:
- **`purchase_date`:** Adicionado ao Drizzle Schema. O sistema de importação de faturas agora captura a data real de cada gasto (em vez de herdar o dia do fechamento).
- **Semântica do Mês (`month`):** Transações de cartão agora usam o campo `month` estritamente como o **Mês da Fatura**. Consequentemente, o motor de projeção de `credit_card_bill` soma gastos do próprio mês alvo (`targetMonth`) e cai exatamente no `due_day` do mês vigente, eliminando deslocamentos temporais incorretos.
- **Limpeza do Extrator de IA (PDFs):** O prompt foi blindado para ignorar abates ("Pagamentos efetuados") e parcelas futuras ("Próximas faturas"), forçando a captura de taxas (IOF e anuidades) para a matemática bater 100%.

## 🗄️ Dados
- O uso de *seeds automáticos na página inicial* (que repovoavam transações zumbis aleatórias, como as 29 transações do Cartão Azul e assinaturas de Netflix/Spotify) foi **extirpado**.
- As **Categorias Padrão** foram forçadamente injetadas no banco atual via script.
- A base de dados principal, limpa e com as novas contas, já foi transferida da máquina local para a remota (`192.168.0.220`).

## 🚀 Decisão de Infraestrutura (Ponto de Partida)
- O usuário decidiu **descartar** o ambiente local.
- **O pipeline de CI/CD foi cancelado.**
- A partir de agora, o desenvolvimento e uso serão **direto no servidor (`192.168.0.220`)** em uma única fonte da verdade (`data/money_control.db`).
- Alterações serão refletidas através do rebuild do container: `docker compose up -d --build`. O serviço sobe automaticamente no boot do servidor (`restart: unless-stopped`).

## ⏭️ Próximos Passos
O usuário migrará para o servidor, instanciará um novo `agy` e fornecerá este documento para continuação. O ecossistema está limpo, testado e em perfeitas condições para escalar.
