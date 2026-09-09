import fs from "node:fs";
import path from "node:path";

// 1. Carregar variáveis do .env se existirem
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  } else {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        val = val.replace(/^["'](.*)["']$/, "$1").trim();
        process.env[key] = val;
      }
    }
  }
}

const clientId = process.env.PLUGGY_CLIENT_ID?.trim();
const clientSecret = process.env.PLUGGY_CLIENT_SECRET?.trim();
const targetItemId = process.argv[2]?.trim() || process.env.PLUGGY_ITEM_ID?.trim();

async function run() {
  console.log("=== POC Pluggy API ===");

  if (!clientId || !clientSecret) {
    console.error("\n❌ Erro: Credenciais do Pluggy não encontradas no .env.");
    console.error("Adicione as seguintes linhas ao seu arquivo .env:");
    console.error('PLUGGY_CLIENT_ID="seu-client-id"');
    console.error('PLUGGY_CLIENT_SECRET="seu-client-secret"\n');
    process.exit(1);
  }

  if (clientId === clientSecret) {
    console.warn("\n⚠️  Atenção: O PLUGGY_CLIENT_ID e o PLUGGY_CLIENT_SECRET têm exatamente o mesmo valor!");
    console.warn("No dashboard do Pluggy, o Client ID e o Client Secret são chaves distintas.");
    console.warn("Verifique se você não copiou a mesma chave para os dois campos no .env.\n");
  }

  console.log("1. Autenticando com Pluggy...");
  const authRes = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!authRes.ok) {
    const errBody = await authRes.text();
    console.error(`❌ Falha na autenticação (HTTP ${authRes.status}):`, errBody);
    process.exit(1);
  }

  const { apiKey } = (await authRes.json()) as { apiKey: string };
  console.log("✓ Autenticado com sucesso!");

  if (!targetItemId) {
    console.log("\n⚠️  O Pluggy exige o identificador da conexão ('itemId') para listar contas.");
    console.log("Cada banco ou instituição conectada no Pluggy é um 'Item'.");
    console.log("\nComo obter seu Item ID no Dashboard:");
    console.log("1. Acesse https://dashboard.pluggy.ai/");
    console.log("2. Vá na aba 'Connections' (ou 'Itens')");
    console.log("3. Clique em uma das suas contas conectadas (ex: Nubank, Itaú, etc.)");
    console.log("4. Copie o 'Item ID' (um UUID de 36 caracteres)\n");
    console.log("Em seguida, execute a POC passando o Item ID:");
    console.log("   npm run poc:pluggy <ITEM_ID>");
    console.log("ou adicione no .env:");
    console.log('   PLUGGY_ITEM_ID="<ITEM_ID>"\n');
    process.exit(0);
  }

  console.log(`\n2. Consultando conexão do Item: ${targetItemId}...`);
  const itemRes = await fetch(`https://api.pluggy.ai/items/${targetItemId}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!itemRes.ok) {
    const errBody = await itemRes.text();
    console.error(`❌ Falha ao buscar Item ${targetItemId} (HTTP ${itemRes.status}):`, errBody);
    process.exit(1);
  }

  const itemData = (await itemRes.json()) as {
    id: string;
    status: string;
    executionStatus: string;
    connector?: { name: string; institutionUrl?: string };
    lastUpdatedAt?: string;
  };

  console.log(`✓ Conexão encontrada: ${itemData.connector?.name || "Instituição"}`);
  console.log(`  - Status: ${itemData.status} (Execução: ${itemData.executionStatus})`);
  console.log(`  - Última atualização: ${itemData.lastUpdatedAt || "N/A"}`);

  console.log("\n3. Buscando contas da conexão...");
  const accRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${targetItemId}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!accRes.ok) {
    const errBody = await accRes.text();
    console.error(`❌ Falha ao buscar contas (HTTP ${accRes.status}):`, errBody);
    process.exit(1);
  }

  const accData = (await accRes.json()) as {
    results: Array<{
      id: string;
      name: string;
      number?: string;
      type: string;
      subtype?: string;
      balance: number;
      currencyCode: string;
      itemId: string;
    }>;
  };

  const accounts = accData.results || [];
  console.log(`✓ Encontradas ${accounts.length} contas nesta conexão:\n`);

  if (accounts.length === 0) {
    console.log("Nenhuma conta vinculada a este Item.");
    return;
  }

  console.table(
    accounts.map((a) => ({
      ID: a.id,
      Nome: a.name,
      Tipo: a.type,
      Subtipo: a.subtype || "-",
      Saldo: `${a.currencyCode} ${a.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      Número: a.number || "-",
    }))
  );

  // 4. Buscar transações recentes das contas
  for (const acc of accounts) {
    console.log(`\n4. Buscando transações da conta "${acc.name} (${acc.subtype || acc.type})" [ID: ${acc.id}]...`);
    const txRes = await fetch(
      `https://api.pluggy.ai/transactions?accountId=${acc.id}&pageSize=5`,
      {
        headers: { "X-API-KEY": apiKey },
      }
    );

    if (!txRes.ok) {
      const errBody = await txRes.text();
      console.error(`❌ Falha ao buscar transações (HTTP ${txRes.status}):`, errBody);
      continue;
    }

    const txData = (await txRes.json()) as {
      results: Array<{
        id: string;
        description: string;
        amount: number;
        date: string;
        category?: string;
        status: string;
      }>;
    };

    const transactions = txData.results || [];
    if (transactions.length === 0) {
      console.log("  Nenhuma transação recente encontrada nesta conta.");
    } else {
      console.log(`✓ Encontradas ${transactions.length} transações recentes:`);
      console.table(
        transactions.map((t) => ({
          Data: t.date.slice(0, 10),
          Descrição: t.description,
          Valor: t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          Categoria: t.category || "-",
          Status: t.status,
        }))
      );
    }
  }

  console.log("\n=== POC Concluída com Sucesso! Conexão validada. ===");
}

run().catch((err) => {
  console.error("Erro inesperado na execução da POC:", err);
  process.exit(1);
});
