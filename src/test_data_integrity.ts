import { getMonthData } from "./lib/actions";

async function run() {
  console.log("--- TESTANDO INTEGRIDADE DOS DADOS ---");
  const data = await getMonthData("2026-08");

  const itau = data.accountsData.find(a => a.account.name === "Itaú");
  if (!itau) throw new Error("Conta Itaú não encontrada");

  console.log("Itaú Saldo Inicial:", itau.initialBalance);
  console.log("Itaú Total Entradas:", itau.totalIncome.toFixed(2));
  console.log("Itaú Total Saídas:", itau.totalExpense.toFixed(2));
  console.log("Itaú Balanço Líquido:", itau.netBalance.toFixed(2));
  console.log("Itaú Saldo Final Acumulado:", itau.transactions[itau.transactions.length - 1]?.runningBalance?.toFixed(2));

  // Check last running balance matches spreadsheet dia 31 (386.69)
  const lastBal = itau.transactions[itau.transactions.length - 1]?.runningBalance;
  if (Math.abs((lastBal || 0) - 386.69) > 0.01) {
    throw new Error(`Saldo final ${lastBal} não bate com 386.69`);
  }

  const cartao = data.accountsData.find(a => a.account.name === "Cartão Azul");
  if (!cartao) throw new Error("Cartão Azul não encontrado");

  console.log("Cartão Azul Total Fatura:", cartao.totalExpense.toFixed(2), "Itens:", cartao.transactions.length);
  const cardSum = cartao.transactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  if (Math.abs(cartao.totalExpense - cardSum) > 0.001) {
    throw new Error("Total Fatura não bate com soma dos lançamentos do cartão");
  }

  console.log("Resumo por Categorias:", data.categorySummaries.length, "categorias com lançamentos");
  for (const cat of data.categorySummaries) {
    console.log(`- ${cat.categoryName}: ${cat.totalAmount.toFixed(2)} (${cat.items.length} itens)`);
  }

  console.log("✓ Todos os testes de integridade e cálculos passaram com 100% de sucesso!");
}

run().catch((err) => {
  console.error("ERRO NO TESTE:", err);
  process.exit(1);
});
