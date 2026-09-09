# Diretrizes de UX para Aplicações Financeiras

Boas práticas para manter usabilidade, segurança e precisão em dados monetários.

---

## 1. Tratamento Numérico e Monetário

1. **Alinhamento à Direita:**
   * Em tabelas e listas, colunas com valores monetários ou percentuais devem ser **sempre alinhadas à direita** (`text-right`), permitindo leitura vertical comparativa de casas decimais.
2. **Fonte Tabular Obrigatória:**
   * Qualquer elemento exibindo moeda deve conter a classe `tabular-nums`.
   * Sem isso, dígitos com larguras diferentes (ex.: o dígito `1` é mais estreito que o `8`) desalinham os números e causam saltos visuais.
   * Além disso, a classe `tabular-nums` aciona a regra global de desfoque quando o usuário ativa o **Modo Privacidade**.
3. **Formatação Consistente:**
   * Padrão brasileiro: `R$ 1.250,00` (espaço entre R$ e valor, ponto para milhar, vírgula para decimal).

---

## 2. Padrões de Formulários Financeiros

1. **Inputs Monetários:**
   * Utilize `inputMode="decimal"` ou `inputMode="numeric"` para teclados corretos em dispositivos touch.
2. **Ações Primárias e Estado de Carregamento:**
   * Todo botão de submissão de transação/conciliação deve ficar desabilitado e com indicador de progresso durante a mutação assíncrona, prevenindo cliques duplos que dupliquem lançamentos.
3. **Foco e Cancelamento:**
   * O primeiro campo de entrada deve receber foco ao abrir modais de cadastro rápido.
   * A tecla `Escape` deve fechar o formulário sem salvar.

---

## 3. Ações Críticas e Destrutivas

1. **Prevenção de Perda de Dados:**
   * Nunca delete contas, cartões ou lotes de transações com um único clique.
   * Exiba confirmação explícita citando o nome do registro (ex.: *"Deseja excluir a conta Nubank? 42 transações vinculadas serão afetadas."*).
2. **Cores de Alerta:**
   * Reserve o botão com variante `destructive` (vermelho) estritamente para ações irreversíveis. Não use vermelho em botões de "Cancelar" ou "Fechar".

---

## 4. Densidade de Informação e Responsividade

1. **Mobile First em Telas de Lançamento:**
   * Modais de inclusão rápida de despesas devem caber confortavelmente em viewports de 375px sem rolagem horizontal.
2. **Visualização em Tabela vs. Cards:**
   * Em telas grandes (`md:` para cima), tabelas compactas maximizam o número de transações visíveis.
   * Em mobile, quebre linhas densas em cards ou listas verticais com tipografia hierarquizada.
