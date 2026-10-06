import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../test-db";
import { accountBalanceSnapshots, accounts, categories, transactionRules, transactions } from "@/db/schema";
import { localToday } from "@/lib/forecast/dates";
import { eq, and } from "drizzle-orm";
import {
  fetchPluggyTransactionsForMonth,
  importTransactionsWithReplaceAction,
  fetchPluggyAccountsForItem,
  syncPluggyInvestmentAccount,
  syncAllPluggyAccountsAction,
  getConnectedPluggyItemsAction,
  getPluggyCredentialsAction,
  fetchPluggyInvestmentsForItemAction,
} from "./pluggy";
import { isInvoicePaymentDescription } from "@/lib/staging-utils";
import * as pluggyIntegration from "@/lib/integrations/pluggy";
import { createBackup } from "@/lib/backup";

let testDb: any;

vi.mock("@/db", () => ({
  get db() {
    return testDb;
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/backup", () => ({
  createBackup: vi.fn(),
}));

describe("fetchPluggyTransactionsForMonth Server Action", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    vi.restoreAllMocks();
  });

  describe("Validation", () => {
    it("returns error for invalid accountId or month format", async () => {
      const res1 = await fetchPluggyTransactionsForMonth(0, "2026-08");
      expect(res1.success).toBe(false);
      if (!res1.success) {
        expect(res1.error).toContain("ID da conta inválido");
      }

      const res2 = await fetchPluggyTransactionsForMonth(1, "invalid-month");
      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.error).toContain("Formato de mês inválido");
      }
    });

    it("returns error if account does not exist in DB", async () => {
      const res = await fetchPluggyTransactionsForMonth(999, "2026-08");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Conta não encontrada");
      }
    });

    it("returns error if account does not have pluggyAccountId configured", async () => {
      await testDb.insert(accounts).values({
        id: 1,
        name: "Nubank Sem Pluggy",
        type: "bank_account",
        color: "purple",
        pluggyAccountId: null,
      });

      const res = await fetchPluggyTransactionsForMonth(1, "2026-08");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("não possui identificador do Pluggy");
      }
    });
  });

  describe("Fetching, Processing, and Rules Engine", () => {
    it("fetches transactions, applies rules, and formats staging rows", async () => {
      // 1. Setup account
      await testDb.insert(accounts).values({
        id: 1,
        name: "Itaú Corrente",
        type: "bank_account",
        color: "orange",
        pluggyAccountId: "pluggy-acc-itau",
      });

      // 2. Setup categories
      await testDb.insert(categories).values([
        { id: 10, name: "Alimentação", type: "expense" },
        { id: 11, name: "Supermercado", parentId: 10, type: "expense" },
        { id: 20, name: "Salário", type: "income" },
      ]);

      // 3. Setup rules
      await testDb.insert(transactionRules).values([
        {
          id: 1,
          pattern: "EXTRA HIPERMERCADO",
          targetDescription: "Supermercado Extra",
          categoryId: 11,
          active: 1,
        },
        {
          id: 2,
          pattern: "EXTRA",
          targetDescription: "Extra Genérico",
          categoryId: 10,
          active: 1,
        },
      ]);

      // 4. Mock Pluggy integration response
      const mockFetchPluggy = vi
        .spyOn(pluggyIntegration, "fetchPluggyTransactions")
        .mockResolvedValue([
          {
            id: "pluggy-tx-1",
            description: "COMPRA EXTRA HIPERMERCADO BARRA",
            amount: -185.5,
            date: "2026-08-15T12:00:00.000Z",
            status: "POSTED",
          },
          {
            id: "pluggy-tx-2",
            description: "TED RECEBIDA EMPRESA XYZ",
            amount: 7500.0,
            date: "2026-08-05T08:00:00.000Z",
            status: "POSTED",
            category: "Salário",
          },
        ]);

      const res = await fetchPluggyTransactionsForMonth(1, "2026-08");

      expect(res.success).toBe(true);
      if (!res.success) return;

      // Verify date range passed to integration
      expect(mockFetchPluggy).toHaveBeenCalledWith({
        accountId: "pluggy-acc-itau",
        from: "2026-08-01",
        to: "2026-08-31",
      });

      expect(res.transactions).toHaveLength(2);

      // Verify order (sorted by day ascending)
      expect(res.transactions[0].day).toBe(5);
      expect(res.transactions[1].day).toBe(15);

      // Verify transaction 1 (Extra Hipermercado matched longest pattern)
      const extraTx = res.transactions.find((t) => t.id === "pluggy-pluggy-tx-1");
      expect(extraTx).toBeDefined();
      expect(extraTx?.description).toBe("Supermercado Extra"); // Cleaned by rule!
      expect(extraTx?.originalDescription).toBe("COMPRA EXTRA HIPERMERCADO BARRA");
      expect(extraTx?.categoryId).toBe(11);
      expect(extraTx?.categoryNameExtracted).toBe("Definido por Regra");
      expect(extraTx?.amount).toBe(-185.5);
      expect(extraTx?.purchaseDate).toBe("15/08/2026");
      expect(extraTx?.isDuplicate).toBe(false);

      // Verify transaction 2 (Salário matched category from Pluggy)
      const salTx = res.transactions.find((t) => t.id === "pluggy-pluggy-tx-2");
      expect(salTx).toBeDefined();
      expect(salTx?.description).toBe("TED RECEBIDA EMPRESA XYZ");
      expect(salTx?.categoryId).toBe(20);
      expect(salTx?.categoryNameExtracted).toBe("Salário");
      expect(salTx?.amount).toBe(7500.0);
    });

    it("detects duplicates against existing transactions in the database", async () => {
      await testDb.insert(accounts).values({
        id: 2,
        name: "Banco Inter",
        type: "bank_account",
        color: "orange",
        pluggyAccountId: "pluggy-acc-inter",
      });

      // Existing transaction in DB
      await testDb.insert(transactions).values({
        id: 100,
        accountId: 2,
        month: "2026-08",
        day: 12,
        amount: -55.0,
        description: "Padaria Bela Vista",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([
        {
          id: "tx-dup",
          description: "Padaria Bela Vista!",
          amount: -55.0,
          date: "2026-08-12T10:00:00.000Z",
          status: "POSTED",
        },
        {
          id: "tx-new",
          description: "Posto Shell",
          amount: -120.0,
          date: "2026-08-12T11:00:00.000Z",
          status: "POSTED",
        },
      ]);

      const res = await fetchPluggyTransactionsForMonth(2, "2026-08");

      expect(res.success).toBe(true);
      if (!res.success) return;

      const dupTx = res.transactions.find((t) => t.id === "pluggy-tx-dup");
      expect(dupTx?.isDuplicate).toBe(true);
      expect(dupTx?.ignored).toBe(true); // Default to ignored when duplicate!

      const newTx = res.transactions.find((t) => t.id === "pluggy-tx-new");
      expect(newTx?.isDuplicate).toBe(false);
      expect(newTx?.ignored).toBe(false);
      expect(newTx?.pluggyTransactionId).toBe("tx-new");
    });

    it("matches duplicates deterministically using pluggyTransactionId even if description was altered in DB", async () => {
      await testDb.insert(accounts).values({
        id: 20,
        name: "Itaú Test",
        type: "bank_account",
        color: "orange",
        pluggyAccountId: "pluggy-acc-itau",
      });

      // Existing transaction in DB with pluggy_transaction_id, but user renamed the description
      await testDb.insert(transactions).values({
        id: 200,
        accountId: 20,
        month: "2026-09",
        day: 2,
        amount: -28.0,
        description: "Almoço com Sergio (descrição personalizada)",
        originalDescription: "COMPRA NO DÉBITO SergioCavalc0209",
        pluggyTransactionId: "pt-uuid-12345",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([
        {
          id: "pt-uuid-12345",
          description: "COMPRA NO DÉBITO SergioCavalc0209",
          amount: -28.0,
          date: "2026-09-02T10:00:00.000Z",
          status: "POSTED",
        },
        {
          id: "pt-uuid-67890",
          description: "COMPRA NO DÉBITO NOVA",
          amount: -15.0,
          date: "2026-09-05T10:00:00.000Z",
          status: "POSTED",
        },
      ]);

      const res = await fetchPluggyTransactionsForMonth(20, "2026-09");
      expect(res.success).toBe(true);
      if (!res.success) return;

      const matchedTx = res.transactions.find((t) => t.id === "pluggy-pt-uuid-12345");
      expect(matchedTx?.isDuplicate).toBe(true);
      expect(matchedTx?.isAlreadyImported).toBe(true);
      expect(matchedTx?.ignored).toBe(true);
      expect(matchedTx?.pluggyTransactionId).toBe("pt-uuid-12345");

      const freshTx = res.transactions.find((t) => t.id === "pluggy-pt-uuid-67890");
      expect(freshTx?.isDuplicate).toBe(false);
      expect(freshTx?.isAlreadyImported).toBe(false);
      expect(freshTx?.ignored).toBe(false);
      expect(freshTx?.pluggyTransactionId).toBe("pt-uuid-67890");
    });

    it("reconhece recorrência e fatura lançadas à mão com outra descrição", async () => {
      await testDb.insert(accounts).values({
        id: 21,
        name: "Itaú Manual",
        type: "bank_account",
        color: "orange",
        pluggyAccountId: "pluggy-acc-itau-manual",
      });
      await testDb.insert(transactions).values([
        { id: 300, accountId: 21, month: "2026-09", day: 10, amount: -377.68, description: "Eletropaulo", sourceType: "recurring" },
        { id: 301, accountId: 21, month: "2026-09", day: 25, amount: -322.98, description: "Fatura Cartão Amazon", sourceType: "credit_card_bill" },
      ]);

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([
        { id: "enel", description: "Débito automático DA ELETROPAULO 7794", amount: -377.68, date: "2026-09-11T10:00:00.000Z", status: "POSTED" },
        { id: "enel-2", description: "Débito automático DA ELETROPAULO 7794", amount: -377.68, date: "2026-09-12T10:00:00.000Z", status: "POSTED" },
        { id: "amazon", description: "Pagamento de boleto BANCO BRADESCARD S A", amount: -322.98, date: "2026-09-15T10:00:00.000Z", status: "POSTED" },
      ]);

      const res = await fetchPluggyTransactionsForMonth(21, "2026-09");
      expect(res.success).toBe(true);
      if (!res.success) return;

      const byId = (id: string) => res.transactions.find((t) => t.id === `pluggy-${id}`);
      expect(byId("enel")).toMatchObject({ isAlreadyImported: true, ignored: true });
      expect(byId("amazon")).toMatchObject({ isAlreadyImported: true, ignored: true });
      // Um lançamento manual só cobre um importado
      expect(byId("enel-2")).toMatchObject({ isAlreadyImported: false, ignored: false });
    });

    it("handles API failure gracefully returning descriptive error", async () => {
      await testDb.insert(accounts).values({
        id: 3,
        name: "Banco Bradesco",
        type: "bank_account",
        color: "red",
        pluggyAccountId: "pluggy-acc-bradesco",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockRejectedValue(
        new Error("Pluggy API connection timeout")
      );

      const res = await fetchPluggyTransactionsForMonth(3, "2026-08");

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Pluggy API connection timeout");
      }
    });

    it("returns error if zero transactions returned and account does not exist in Pluggy (stale accountId)", async () => {
      await testDb.insert(accounts).values({
        id: 4,
        name: "Itaú Antigo",
        type: "bank_account",
        color: "orange",
        pluggyAccountId: "pluggy-acc-deleted",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([]);
      vi.spyOn(pluggyIntegration, "fetchPluggyAccount").mockRejectedValue(
        new Error("Falha ao consultar conta do Pluggy (HTTP 404): Account not found")
      );

      const res = await fetchPluggyTransactionsForMonth(4, "2026-07");

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("não foi encontrada no Pluggy");
        expect(res.error).toContain("pluggy-acc-deleted");
      }
    });

    it("returns empty transactions if account exists in Pluggy but genuinely has no transactions", async () => {
      await testDb.insert(accounts).values({
        id: 5,
        name: "Conta Sem Movimento",
        type: "bank_account",
        color: "blue",
        pluggyAccountId: "pluggy-acc-empty",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([]);
      vi.spyOn(pluggyIntegration, "fetchPluggyAccount").mockResolvedValue({
        id: "pluggy-acc-empty",
        name: "Conta Sem Movimento",
        type: "BANK",
        balance: 100,
        currencyCode: "BRL",
        itemId: "item-empty",
      });

      const res = await fetchPluggyTransactionsForMonth(5, "2026-07");

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.transactions).toEqual([]);
      }
      const snaps = await testDb.select().from(accountBalanceSnapshots);
      expect(snaps).toMatchObject([{ accountId: 5, balance: 100, source: "pluggy", date: localToday() }]);
    });

    it("grava o saldo do banco a cada consulta, substituindo o do mesmo dia", async () => {
      await testDb.insert(accounts).values({
        id: 6,
        name: "Conta Corrente",
        type: "bank_account",
        color: "blue",
        pluggyAccountId: "pluggy-acc-6",
      });
      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([
        { id: "t1", description: "PIX", amount: -10, date: "2026-07-03T12:00:00.000Z" } as any,
      ]);
      const accSpy = vi
        .spyOn(pluggyIntegration, "fetchPluggyAccount")
        .mockResolvedValueOnce({ id: "pluggy-acc-6", balance: 500 } as any)
        .mockResolvedValueOnce({ id: "pluggy-acc-6", balance: 490.5 } as any);

      await fetchPluggyTransactionsForMonth(6, "2026-07");
      await fetchPluggyTransactionsForMonth(6, "2026-07");

      expect(accSpy).toHaveBeenCalledTimes(2);
      const snaps = await testDb.select().from(accountBalanceSnapshots);
      expect(snaps).toMatchObject([{ accountId: 6, balance: 490.5, source: "pluggy" }]);
    });

    it("não falha a importação se o saldo não puder ser lido mas houver transações", async () => {
      await testDb.insert(accounts).values({
        id: 7,
        name: "Conta Corrente 2",
        type: "bank_account",
        color: "blue",
        pluggyAccountId: "pluggy-acc-7",
      });
      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([
        { id: "t1", description: "PIX", amount: -10, date: "2026-07-03T12:00:00.000Z" } as any,
      ]);
      vi.spyOn(pluggyIntegration, "fetchPluggyAccount").mockRejectedValue(new Error("HTTP 500"));

      const res = await fetchPluggyTransactionsForMonth(7, "2026-07");
      expect(res.success).toBe(true);
      expect(await testDb.select().from(accountBalanceSnapshots)).toEqual([]);
    });
  });

  describe("Credit Card Support in fetchPluggyTransactionsForMonth", () => {
    it("fetches transactions using closed bill billId when matching bill exists for month", async () => {
      await testDb.insert(accounts).values({
        id: 10,
        name: "Cartão Nubank",
        type: "credit_card",
        color: "purple",
        pluggyAccountId: "pluggy-cc-nubank",
      });

      const mockBills = [
        {
          id: "bill-aug-2026",
          dueDate: "2026-08-10T00:00:00.000Z",
          billClosingDate: "2026-08-03T00:00:00.000Z",
          totalAmount: 150.0,
        },
        {
          id: "bill-jul-2026",
          dueDate: "2026-07-10T00:00:00.000Z",
          billClosingDate: "2026-07-03T00:00:00.000Z",
          totalAmount: 980.0,
        },
      ];

      const mockTxs = [
        {
          id: "tx-closed-1",
          description: "MERCADO LIVRE",
          amount: 150.0,
          type: "DEBIT" as const,
          date: "2026-07-28T12:00:00.000Z",
          status: "POSTED",
          creditCardMetadata: {
            purchaseDate: "2026-07-28",
            billId: "bill-aug-2026",
          },
        },
      ];

      const fetchBillsSpy = vi
        .spyOn(pluggyIntegration, "fetchPluggyBills")
        .mockResolvedValue(mockBills);
      const fetchTxsSpy = vi
        .spyOn(pluggyIntegration, "fetchPluggyTransactions")
        .mockResolvedValue(mockTxs);

      const res = await fetchPluggyTransactionsForMonth(10, "2026-08");

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(fetchBillsSpy).toHaveBeenCalledWith("pluggy-cc-nubank");
      expect(fetchTxsSpy).toHaveBeenCalledWith({
        accountId: "pluggy-cc-nubank",
        billId: "bill-aug-2026",
      });

      expect(res.transactions).toHaveLength(1);
      // Normalized to negative expense
      expect(res.transactions[0].amount).toBe(-150.0);
      // Resolved to UI month
      expect(res.transactions[0].resolvedMonth).toBe("2026-08");
      expect(res.transactions[0].isPastMonth).toBe(false);
      expect(res.transactions[0].purchaseDate).toBe("28/07/2026");
      expect(res.transactions[0].day).toBe(28);
    });

    it("fetches open bill transactions and filters by billForecastDate when no closed bill exists", async () => {
      await testDb.insert(accounts).values({
        id: 11,
        name: "Cartão Inter",
        type: "credit_card",
        color: "orange",
        pluggyAccountId: "pluggy-cc-inter",
      });

      // No matching closed bill for 2026-09
      vi.spyOn(pluggyIntegration, "fetchPluggyBills").mockResolvedValue([
        {
          id: "bill-aug-2026",
          dueDate: "2026-08-10T00:00:00.000Z",
          totalAmount: 500.0,
        },
      ]);

      const mockTxs = [
        {
          id: "tx-open-sept",
          description: "RESTAURANTE COCO BAMBU",
          amount: 220.0,
          type: "DEBIT" as const,
          date: "2026-08-25T20:00:00.000Z",
          status: "POSTED",
          creditCardMetadata: {
            billForecastDate: "2026-09",
            purchaseDate: "2026-08-25",
          },
        },
        {
          id: "tx-open-oct",
          description: "HOTEL IBIS",
          amount: 450.0,
          type: "DEBIT" as const,
          date: "2026-09-02T10:00:00.000Z",
          status: "POSTED",
          creditCardMetadata: {
            billForecastDate: "2026-10",
            purchaseDate: "2026-09-02",
          },
        },
      ];

      const fetchTxsSpy = vi
        .spyOn(pluggyIntegration, "fetchPluggyTransactions")
        .mockResolvedValue(mockTxs);

      const res = await fetchPluggyTransactionsForMonth(11, "2026-09");

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(fetchTxsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "pluggy-cc-inter",
        })
      );

      // Only the transaction forecasting for 2026-09 should be kept
      expect(res.transactions).toHaveLength(1);
      expect(res.transactions[0].id).toBe("pluggy-tx-open-sept");
      expect(res.transactions[0].amount).toBe(-220.0);
      expect(res.transactions[0].resolvedMonth).toBe("2026-09");
    });

    it("includes transactions whose date matches month when billForecastDate is absent", async () => {
      await testDb.insert(accounts).values({
        id: 15,
        name: "Cartão Azul Test",
        type: "credit_card",
        color: "blue",
        pluggyAccountId: "pluggy-cc-azul-test",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyBills").mockResolvedValue([]);

      const mockTxs = [
        {
          id: "tx-aug-no-forecast",
          description: "POUSADA BEZERNAZAR02/06",
          amount: 604.21,
          type: "DEBIT" as const,
          date: "2026-08-17T03:00:00.000Z",
          status: "POSTED",
          creditCardMetadata: {
            purchaseDate: "2026-07-06",
          },
        },
        {
          id: "tx-july-no-forecast",
          description: "MERCADO EXTRA",
          amount: 150.0,
          type: "DEBIT" as const,
          date: "2026-07-05T10:00:00.000Z",
          status: "POSTED",
        },
      ];

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue(mockTxs);

      const res = await fetchPluggyTransactionsForMonth(15, "2026-08");

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.transactions).toHaveLength(1);
      expect(res.transactions[0].id).toBe("pluggy-tx-aug-no-forecast");
      expect(res.transactions[0].amount).toBe(-604.21);
      expect(res.transactions[0].day).toBe(6); // extracted from purchaseDate 2026-07-06
    });

    it("normalizes signs: converts DEBIT to negative and CREDIT (refund) to positive", async () => {
      await testDb.insert(accounts).values({
        id: 12,
        name: "Cartão C6",
        type: "credit_card",
        color: "black",
        pluggyAccountId: "pluggy-cc-c6",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyBills").mockResolvedValue([
        { id: "bill-1", dueDate: "2026-08-15", totalAmount: 100 },
      ]);

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([
        {
          id: "tx-purchase",
          description: "FARMACIA DROGASIL",
          amount: 79.23, // Pluggy sends positive DEBIT
          type: "DEBIT",
          date: "2026-08-05",
          status: "POSTED",
        },
        {
          id: "tx-refund",
          description: "ESTORNO COMPRA CANCELADA",
          amount: -31.0, // Or positive credit
          type: "CREDIT",
          date: "2026-08-06",
          status: "POSTED",
        },
      ]);

      const res = await fetchPluggyTransactionsForMonth(12, "2026-08");
      expect(res.success).toBe(true);
      if (!res.success) return;

      const purchase = res.transactions.find((t) => t.id === "pluggy-tx-purchase");
      const refund = res.transactions.find((t) => t.id === "pluggy-tx-refund");

      expect(purchase?.amount).toBe(-79.23);
      expect(refund?.amount).toBe(31.0);
    });

    it("compulsorily marks invoice payment lines as ignored: true", async () => {
      await testDb.insert(accounts).values({
        id: 13,
        name: "Cartão XP",
        type: "credit_card",
        color: "black",
        pluggyAccountId: "pluggy-cc-xp",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyBills").mockResolvedValue([
        { id: "b1", dueDate: "2026-08-20", totalAmount: 300 },
      ]);

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([
        {
          id: "tx-pay-1",
          description: "PAGAMENTO DEBITO AUTOMATICO",
          amount: -1500.0,
          type: "CREDIT",
          date: "2026-08-01",
          status: "POSTED",
        },
        {
          id: "tx-pay-2",
          description: "PAGAMENTO DE FATURA EFETUADO",
          amount: -2000.0,
          type: "CREDIT",
          date: "2026-08-02",
          status: "POSTED",
        },
        {
          id: "tx-normal",
          description: "IFOOD REFEICAO",
          amount: 65.0,
          type: "DEBIT",
          date: "2026-08-03",
          status: "POSTED",
        },
      ]);

      const res = await fetchPluggyTransactionsForMonth(13, "2026-08");
      expect(res.success).toBe(true);
      if (!res.success) return;

      const pay1 = res.transactions.find((t) => t.id === "pluggy-tx-pay-1");
      const pay2 = res.transactions.find((t) => t.id === "pluggy-tx-pay-2");
      const normal = res.transactions.find((t) => t.id === "pluggy-tx-normal");

      expect(pay1?.ignored).toBe(true);
      expect(pay2?.ignored).toBe(true);
      expect(normal?.ignored).toBe(false);
    });

    it("extracts installmentCurrent and installmentTotal from creditCardMetadata or regex fallback and preserves purchaseDate", async () => {
      await testDb.insert(accounts).values({
        id: 14,
        name: "Cartão Santander",
        type: "credit_card",
        color: "red",
        pluggyAccountId: "pluggy-cc-santander",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyBills").mockResolvedValue([
        { id: "b1", dueDate: "2026-08-20", totalAmount: 1000 },
      ]);

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([
        // Via creditCardMetadata
        {
          id: "tx-inst-meta",
          description: "FAST SHOP",
          amount: 250.0,
          type: "DEBIT",
          date: "2026-08-10",
          status: "POSTED",
          creditCardMetadata: {
            installmentNumber: 4,
            totalInstallments: 21,
            purchaseDate: "2026-05-10",
          },
        },
        // Via regex fallback
        {
          id: "tx-inst-regex",
          description: "MAGAZINE LUIZA 03/10",
          amount: 120.0,
          type: "DEBIT",
          date: "2026-08-12",
          status: "POSTED",
        },
      ]);

      const res = await fetchPluggyTransactionsForMonth(14, "2026-08");
      expect(res.success).toBe(true);
      if (!res.success) return;

      const metaTx = res.transactions.find((t) => t.id === "pluggy-tx-inst-meta");
      expect(metaTx?.installmentCurrent).toBe(4);
      expect(metaTx?.installmentTotal).toBe(21);
      expect(metaTx?.purchaseDate).toBe("10/05/2026");
      expect(metaTx?.day).toBe(10);

      const regexTx = res.transactions.find((t) => t.id === "pluggy-tx-inst-regex");
      expect(regexTx?.installmentCurrent).toBe(3);
      expect(regexTx?.installmentTotal).toBe(10);
      expect(regexTx?.purchaseDate).toBe("12/08/2026");
    });

    it("automatically injects reconciliation adjustment row when closed bill totalAmount differs from transactions sum", async () => {
      await testDb.insert(accounts).values({
        id: 16,
        name: "Cartão Diferença",
        type: "credit_card",
        color: "blue",
        pluggyAccountId: "pluggy-cc-diff",
      });

      // Bill says total is 7756.49, closing date is 2026-08-09
      vi.spyOn(pluggyIntegration, "fetchPluggyBills").mockResolvedValue([
        {
          id: "bill-diff-2026",
          dueDate: "2026-08-17T00:00:00.000Z",
          billClosingDate: "2026-08-09T00:00:00.000Z",
          totalAmount: 7756.49,
        },
      ]);

      // Transactions sum to 7751.25 (7813.25 debit - 62.00 credit)
      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([
        {
          id: "tx-d1",
          description: "COMPRAS GERAIS",
          amount: 7813.25,
          type: "DEBIT",
          date: "2026-08-05",
          status: "POSTED",
        },
        {
          id: "tx-c1",
          description: "ESTORNO MENSALIDADE",
          amount: 62.0,
          type: "CREDIT",
          date: "2026-08-06",
          status: "POSTED",
        },
      ]);

      const res = await fetchPluggyTransactionsForMonth(16, "2026-08");
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.transactions).toHaveLength(3); // 2 original + 1 adjustment
      const adjTx = res.transactions.find((t) => t.id === "pluggy-bill-adj-bill-diff-2026");
      expect(adjTx).toBeDefined();
      expect(adjTx?.amount).toBe(-5.24); // 7756.49 - 7751.25 = 5.24 fee
      expect(adjTx?.day).toBe(9); // closing date day
      expect(adjTx?.purchaseDate).toBe("09/08/2026");
      expect(adjTx?.description).toBe("Encargos / Tarifas da Fatura");
      expect(adjTx?.isDuplicate).toBe(false);
      expect(adjTx?.ignored).toBe(false);
    });
  });

  describe("fetchPluggyAccountsForItem Server Action", () => {
    const originalEnv = process.env.PLUGGY_ITEM_ID;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      process.env.PLUGGY_ITEM_ID = originalEnv;
    });

    it("returns error if itemId is missing and PLUGGY_ITEM_ID is not configured", async () => {
      delete process.env.PLUGGY_ITEM_ID;
      const res = await fetchPluggyAccountsForItem();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("PLUGGY_ITEM_ID não configurado");
      }
    });

    it("fetches accounts for provided itemId", async () => {
      const mockAccounts = [
        {
          id: "acc-1",
          name: "Conta Corrente",
          type: "BANK",
          balance: 2500.0,
          currencyCode: "BRL",
          itemId: "item-custom",
        },
        {
          id: "acc-2",
          name: "Cartão Black",
          type: "CREDIT",
          balance: -1200.0,
          currencyCode: "BRL",
          itemId: "item-custom",
        },
      ];

      const spy = vi
        .spyOn(pluggyIntegration, "fetchPluggyAccounts")
        .mockResolvedValue(mockAccounts);

      const res = await fetchPluggyAccountsForItem("item-custom");
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(spy).toHaveBeenCalledWith("item-custom");
      expect(res.accounts).toHaveLength(2);
      expect(res.accounts[1].name).toBe("Cartão Black");
    });

    it("uses process.env.PLUGGY_ITEM_ID when itemId parameter is omitted", async () => {
      process.env.PLUGGY_ITEM_ID = "item-from-env";

      const spy = vi
        .spyOn(pluggyIntegration, "fetchPluggyAccounts")
        .mockResolvedValue([]);

      const res = await fetchPluggyAccountsForItem();
      expect(res.success).toBe(true);
      expect(spy).toHaveBeenCalledWith("item-from-env");
    });

    it("handles integration errors gracefully", async () => {
      vi.spyOn(pluggyIntegration, "fetchPluggyAccounts").mockRejectedValue(
        new Error("Item não encontrado no Pluggy")
      );

      const res = await fetchPluggyAccountsForItem("item-invalid");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Item não encontrado no Pluggy");
      }
    });
  });

  describe("isInvoicePaymentDescription", () => {
    it("detects various invoice payment descriptions", () => {
      expect(isInvoicePaymentDescription("PAGAMENTO DEBITO AUTOMATICO")).toBe(true);
      expect(isInvoicePaymentDescription("PAGAMENTO DE FATURA")).toBe(true);
      expect(isInvoicePaymentDescription("PGTO FATURA")).toBe(true);
      expect(isInvoicePaymentDescription("PAGAMENTO CARTAO DE CREDITO")).toBe(true);
      expect(isInvoicePaymentDescription("PAGAMENTO RECEBIDO")).toBe(true);
      expect(isInvoicePaymentDescription("PAGAMENTO")).toBe(true);
    });

    it("returns false for non-payment descriptions", () => {
      expect(isInvoicePaymentDescription("SUPERMERCADO DIA")).toBe(false);
      expect(isInvoicePaymentDescription("UBER TRIP")).toBe(false);
      expect(isInvoicePaymentDescription("RESTAURANTE SABOR")).toBe(false);
      expect(isInvoicePaymentDescription("")).toBe(false);
    });
  });
});

describe("importTransactionsWithReplaceAction Server Action", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    vi.restoreAllMocks();
  });

  it("validates accountId and month format", async () => {
    const res1 = await importTransactionsWithReplaceAction({
      accountId: 0,
      month: "2026-08",
      transactions: [],
    });
    expect(res1.success).toBe(false);

    const res2 = await importTransactionsWithReplaceAction({
      accountId: 1,
      month: "invalid-month",
      transactions: [],
    });
    expect(res2.success).toBe(false);
  });

  it("aborts and returns error if createBackup fails, without mutating database", async () => {
    await testDb.insert(accounts).values({
      id: 1,
      name: "Banco do Brasil",
      type: "bank_account",
      color: "blue",
    });

    await testDb.insert(transactions).values({
      id: 10,
      accountId: 1,
      month: "2026-08",
      day: 5,
      amount: -100.0,
      description: "Conta de Luz",
    });

    vi.mocked(createBackup).mockResolvedValue({
      success: false,
      error: "Disco cheio ou permissão negada",
    });

    const res = await importTransactionsWithReplaceAction({
      accountId: 1,
      month: "2026-08",
      transactions: [
        {
          accountId: 1,
          month: "2026-08",
          day: 10,
          amount: 2000.0,
          description: "Novo Salário",
        },
      ],
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Falha ao gerar backup de segurança");
    }

    // Verify original transaction is still untouched
    const existing = await testDb.select().from(transactions).where(eq(transactions.accountId, 1));
    expect(existing).toHaveLength(1);
    expect(existing[0].description).toBe("Conta de Luz");
  });

  it("purges only current month transactions for the account and inserts new batch atomically", async () => {
    await testDb.insert(accounts).values([
      { id: 1, name: "Conta 1", type: "bank_account", color: "blue" },
      { id: 2, name: "Conta 2", type: "bank_account", color: "green" },
    ]);

    // Setup:
    // 1. Transaction in Conta 1 in month 2026-08 (SHOULD BE REPLACED)
    // 2. Transaction in Conta 1 in month 2026-07 (SHOULD BE PRESERVED)
    // 3. Transaction in Conta 2 in month 2026-08 (SHOULD BE PRESERVED)
    await testDb.insert(transactions).values([
      { id: 1, accountId: 1, month: "2026-08", day: 2, amount: -50, description: "Despesa antiga Ago C1" },
      { id: 2, accountId: 1, month: "2026-07", day: 15, amount: -70, description: "Despesa Jul C1" },
      { id: 3, accountId: 2, month: "2026-08", day: 3, amount: -80, description: "Despesa Ago C2" },
    ]);

    vi.mocked(createBackup).mockResolvedValue({ success: true });

    const newTransactions = [
      {
        accountId: 1,
        month: "2026-08",
        day: 10,
        amount: -150.0,
        description: "Nova Despesa 1",
        originalDescription: "COMPRA NOVA 1",
        pluggyTransactionId: "pt-uuid-abc",
      },
      {
        accountId: 1,
        month: "2026-08",
        day: 20,
        amount: 3000.0,
        description: "Novo Salário",
      },
    ];

    const newRules = [
      {
        pattern: "COMPRA NOVA 1",
        targetDescription: "Nova Despesa 1",
        categoryId: null,
      },
    ];

    const res = await importTransactionsWithReplaceAction({
      accountId: 1,
      month: "2026-08",
      transactions: newTransactions,
      newRules,
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.count).toBe(2);

    // Verify backup was called
    expect(createBackup).toHaveBeenCalled();

    // Verify Conta 1 in 2026-08 now has exactly the 2 new transactions
    const c1AgoTxs = await testDb
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, 1), eq(transactions.month, "2026-08")));
    expect(c1AgoTxs).toHaveLength(2);
    expect(c1AgoTxs.some((t: any) => t.description === "Despesa antiga Ago C1")).toBe(false);
    expect(c1AgoTxs.some((t: any) => t.description === "Nova Despesa 1")).toBe(true);
    expect(c1AgoTxs.some((t: any) => t.description === "Novo Salário")).toBe(true);
    expect(c1AgoTxs.find((t: any) => t.description === "Nova Despesa 1")?.pluggyTransactionId).toBe("pt-uuid-abc");

    // Verify Conta 1 in 2026-07 was preserved
    const c1JulTxs = await testDb
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, 1), eq(transactions.month, "2026-07")));
    expect(c1JulTxs).toHaveLength(1);
    expect(c1JulTxs[0].description).toBe("Despesa Jul C1");

    // Verify Conta 2 in 2026-08 was preserved
    const c2AgoTxs = await testDb
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, 2), eq(transactions.month, "2026-08")));
    expect(c2AgoTxs).toHaveLength(1);
    expect(c2AgoTxs[0].description).toBe("Despesa Ago C2");

    // Verify new rule was inserted
    const rules = await testDb.select().from(transactionRules);
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe("COMPRA NOVA 1");
  });

  it("sanitizes orphaned transfer links on counterpart transactions when replacing", async () => {
    // 0. Setup accounts
    await testDb.insert(accounts).values([
      { id: 1, name: "Conta 1", type: "bank_account", color: "blue" },
      { id: 2, name: "Conta 2", type: "bank_account", color: "green" },
    ]);

    // 1. Setup two linked transactions between Conta 1 and Conta 2
    await testDb.insert(transactions).values([
      {
        id: 100,
        accountId: 1,
        month: "2026-08",
        day: 10,
        description: "Pix enviado Leandro",
        amount: -350.0,
        linkedTransactionId: 200,
      },
      {
        id: 200,
        accountId: 2,
        month: "2026-08",
        day: 10,
        description: "Pix recebido Leandro",
        amount: 350.0,
        linkedTransactionId: 100,
      },
    ]);

    // 2. Replace transactions on Conta 1
    const res = await importTransactionsWithReplaceAction({
      accountId: 1,
      month: "2026-08",
      transactions: [
        {
          accountId: 1,
          month: "2026-08",
          day: 12,
          description: "Novo lançamento isolado",
          amount: -100.0,
        },
      ],
    });

    expect(res.success).toBe(true);

    // 3. Verify tx 200 in Conta 2 now has linkedTransactionId = null
    const tx200 = await testDb
      .select()
      .from(transactions)
      .where(eq(transactions.id, 200))
      .then((r: any[]) => r[0]);

    expect(tx200).toBeDefined();
    expect(tx200.linkedTransactionId).toBeNull();
  });
});

describe("syncAllPluggyAccountsAction with auto-linking", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    vi.mocked(createBackup).mockReset();
    vi.mocked(createBackup).mockResolvedValue({ success: true, filename: "test.db" } as any);

    // Setup accounts
    await testDb.insert(accounts).values([
      {
        id: 1,
        name: "Itaú",
        type: "bank_account",
        color: "orange",
        pluggyAccountId: "pluggy-itau-1",
        isActive: 1,
      },
      {
        id: 2,
        name: "Nubank",
        type: "bank_account",
        color: "purple",
        pluggyAccountId: "pluggy-nubank-2",
        isActive: 1,
      },
    ]);

    // Setup categories
    await testDb.insert(categories).values([
      { id: 1, name: "Transferência", type: "both" },
    ]);
  });

  it("syncs all accounts and auto-links high-confidence transfer pairs", async () => {
    vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockImplementation(async (params) => {
      if (params.accountId === "pluggy-itau-1") {
        return [
          {
            id: "tx-itau-1",
            description: "Pix enviado Leandro Guedes",
            amount: -1200.0,
            date: "2026-08-20T10:00:00.000Z",
            status: "POSTED",
            operationType: "PIX",
          },
        ];
      }
      if (params.accountId === "pluggy-nubank-2") {
        return [
          {
            id: "tx-nubank-1",
            description: "Pix recebido Leandro Guedes",
            amount: 1200.0,
            date: "2026-08-20T10:00:05.000Z",
            status: "POSTED",
            operationType: "PIX",
          },
        ];
      }
      return [];
    });

    const res = await syncAllPluggyAccountsAction("2026-08");

    expect(res.total).toBe(2);
    expect(res.successCount).toBe(2);
    expect(res.failureCount).toBe(0);
    expect(res.autoLinkedTransfersCount).toBe(1);

    // Verify transactions in database are linked to each other
    const txs = await testDb.select().from(transactions);
    expect(txs).toHaveLength(2);

    const itauTx = txs.find((t: any) => t.accountId === 1);
    const nubankTx = txs.find((t: any) => t.accountId === 2);

    expect(itauTx.linkedTransactionId).toBe(nubankTx.id);
    expect(nubankTx.linkedTransactionId).toBe(itauTx.id);
    expect(itauTx.categoryId).toBe(1);
    expect(nubankTx.categoryId).toBe(1);
  });

  it("includes investment accounts linked via pluggyItemId in sync batch", async () => {
    await testDb.insert(accounts).values({
      id: 3,
      name: "XP Investimentos",
      type: "investment",
      color: "gold",
      pluggyItemId: "item-xp-sync-all",
      isActive: 1,
    });

    vi.spyOn(pluggyIntegration, "fetchPluggyAccount").mockResolvedValue({ id: "acc", name: "acc" } as any);
    vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValue([]);
    vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValue([
      {
        id: "inv-xp-1",
        itemId: "item-xp-sync-all",
        name: "Tesouro Selic 2029",
        type: "FIXED_INCOME",
        balance: 15000,
        currencyCode: "BRL",
      },
      {
        id: "inv-xp-2",
        itemId: "item-xp-sync-all",
        name: "BOVA11",
        type: "EQUITY",
        balance: 5000,
        currencyCode: "BRL",
      },
    ]);

    const res = await syncAllPluggyAccountsAction("2026-08");

    expect(res.total).toBe(3); // 2 bank accounts + 1 investment account
    expect(res.successCount).toBe(3);
    expect(res.failureCount).toBe(0);

    const xpResult = res.results.find((r) => r.accountId === 3);
    expect(xpResult).toBeDefined();
    expect(xpResult?.success).toBe(true);
    expect(xpResult?.isInvestment).toBe(true);
    expect(xpResult?.count).toBe(2);

    // Verify investment custody reconciliation transaction was created
    const xpTx = await testDb
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, 3));
    expect(xpTx).toHaveLength(1);
    expect(xpTx[0].amount).toBe(20000);
    expect(xpTx[0].description).toBe("Posição Inicial em Custódia");
  });

  it("is resilient to failures: investment account error does not break bank account sync", async () => {
    await testDb.insert(accounts).values({
      id: 4,
      name: "BTG Pactual",
      type: "investment",
      color: "blue",
      pluggyItemId: "item-btg-fail",
      isActive: 1,
    });

    vi.spyOn(pluggyIntegration, "fetchPluggyAccount").mockResolvedValue({ id: "acc", name: "acc" } as any);
    vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockImplementation(async (params) => {
      if (params.accountId === "pluggy-itau-1") {
        return [
          {
            id: "tx-itau-single",
            description: "Salário Empresa",
            amount: 5000.0,
            date: "2026-08-05T10:00:00.000Z",
            status: "POSTED",
          },
        ];
      }
      return [];
    });

    vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockRejectedValue(
      new Error("Erro de autenticação na corretora")
    );

    const res = await syncAllPluggyAccountsAction("2026-08");

    expect(res.total).toBe(3); // 2 bank accounts + 1 investment account
    expect(res.successCount).toBe(2); // 2 bank accounts succeed
    expect(res.failureCount).toBe(1); // BTG failed

    const btgResult = res.results.find((r) => r.accountId === 4);
    expect(btgResult).toBeDefined();
    expect(btgResult?.success).toBe(false);
    expect(btgResult?.isInvestment).toBe(true);
    expect(btgResult?.error).toContain("Erro de autenticação na corretora");

    // Bank transactions were still inserted
    const itauTxs = await testDb
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, 1));
    expect(itauTxs).toHaveLength(1);
    expect(itauTxs[0].description).toBe("Salário Empresa");
  });

  describe("syncPluggyInvestmentAccount Server Action", () => {
    it("returns error for invalid accountId", async () => {
      const res = await syncPluggyInvestmentAccount(0);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("ID da conta inválido");
      }
    });

    it("returns error if account does not exist in DB", async () => {
      const res = await syncPluggyInvestmentAccount(9999);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Conta não encontrada");
      }
    });

    it("returns error if account is not of type investment", async () => {
      await testDb.insert(accounts).values({
        id: 10,
        name: "Conta Corrente Itaú",
        type: "bank_account",
        color: "blue",
        pluggyItemId: "item-123",
      });

      const res = await syncPluggyInvestmentAccount(10);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("não é uma conta de investimento");
      }
    });

    it("returns error if account does not have pluggyItemId configured", async () => {
      await testDb.insert(accounts).values({
        id: 11,
        name: "XP Sem Pluggy",
        type: "investment",
        color: "orange",
        pluggyItemId: null,
      });

      const res = await syncPluggyInvestmentAccount(11);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("não possui identificador de conexão do Pluggy");
      }
    });

    it("handles Pluggy integration error gracefully", async () => {
      await testDb.insert(accounts).values({
        id: 12,
        name: "XP Erro",
        type: "investment",
        color: "orange",
        pluggyItemId: "item-fail",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockRejectedValueOnce(
        new Error("Pluggy API timeout")
      );

      const res = await syncPluggyInvestmentAccount(12);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Pluggy API timeout");
      }
    });

    it("calculates consolidated balance, reconciles custody via adjustInvestmentBalance, and returns summary", async () => {
      // Create investment account with an initial transaction of 10000
      await testDb.insert(accounts).values({
        id: 13,
        name: "XP Investimentos",
        type: "investment",
        color: "orange",
        pluggyItemId: "item-xp-ok",
      });

      await testDb.insert(transactions).values({
        id: 101,
        accountId: 13,
        month: "2026-08",
        day: 1,
        description: "Posição Inicial em Custódia",
        amount: 10000,
      });

      // Mock Pluggy investments totaling 11500 (diff = +1500)
      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "inv-xp-1",
          itemId: "item-xp-ok",
          name: "Tesouro Selic 2029",
          type: "FIXED_INCOME",
          balance: 7500.5,
          currencyCode: "BRL",
        },
        {
          id: "inv-xp-2",
          itemId: "item-xp-ok",
          name: "Fundo XP Long Biased",
          type: "MUTUAL_FUND",
          balance: 3999.5,
          currencyCode: "BRL",
        },
      ]);

      const res = await syncPluggyInvestmentAccount(13);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.totalBalance).toBe(11500);
        expect(res.previousBalance).toBe(10000);
        expect(res.diff).toBe(1500);
        expect(res.investments).toHaveLength(2);
        expect(res.investments[0].name).toBe("Tesouro Selic 2029");
        expect(res.investments[0].balance).toBe(7500.5);
        expect(res.investments[1].name).toBe("Fundo XP Long Biased");
        expect(res.investments[1].balance).toBe(3999.5);
      }

      // Verify reconciliation transaction was inserted in DB
      const allTx = await testDb
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, 13));

      expect(allTx).toHaveLength(2);
      const reconTx = allTx.find((t: any) => t.id !== 101);
      expect(reconTx).toBeDefined();
      expect(reconTx.description).toBe("Reconciliação de Custódia");
      expect(reconTx.amount).toBe(1500);
    });

    it("does not insert new transaction when diff is 0", async () => {
      await testDb.insert(accounts).values({
        id: 14,
        name: "BTG Pactual",
        type: "investment",
        color: "blue",
        pluggyItemId: "item-btg-ok",
      });

      await testDb.insert(transactions).values({
        id: 201,
        accountId: 14,
        month: "2026-08",
        day: 1,
        description: "Posição Inicial",
        amount: 5000,
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "inv-btg-1",
          itemId: "item-btg-ok",
          name: "CDB BTG 110%",
          type: "FIXED_INCOME",
          balance: 5000,
          currencyCode: "BRL",
        },
      ]);

      const res = await syncPluggyInvestmentAccount(14);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.totalBalance).toBe(5000);
        expect(res.previousBalance).toBe(5000);
        expect(res.diff).toBe(0);
      }

      const allTx = await testDb
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, 14));

      expect(allTx).toHaveLength(1);
    });

    it("syncs only the specific asset when account has pluggyAccountId configured", async () => {
      await testDb.insert(accounts).values({
        id: 15,
        name: "CDB Itaú",
        type: "investment",
        color: "orange",
        pluggyItemId: "item-itau-123",
        pluggyAccountId: "inv-cdb-99",
      });

      await testDb.insert(transactions).values({
        id: 301,
        accountId: 15,
        month: "2026-08",
        day: 1,
        description: "Posição Inicial CDB",
        amount: 8000,
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "inv-cdb-99",
          itemId: "item-itau-123",
          name: "CDB DI ITAU",
          type: "FIXED_INCOME",
          balance: 8500,
          currencyCode: "BRL",
        },
        {
          id: "inv-kisu-100",
          itemId: "item-itau-123",
          name: "KISU11 FII",
          type: "MUTUAL_FUND",
          balance: 3000,
          currencyCode: "BRL",
        },
      ]);

      const res = await syncPluggyInvestmentAccount(15);
      expect(res.success).toBe(true);
      if (res.success) {
        // Must only count the specific asset (8500), ignoring KISU11 (3000)
        expect(res.totalBalance).toBe(8500);
        expect(res.previousBalance).toBe(8000);
        expect(res.diff).toBe(500);
        expect(res.investments).toHaveLength(1);
        expect(res.investments[0].id).toBe("inv-cdb-99");
      }
    });

    it("returns error if configured pluggyAccountId is not returned by Pluggy", async () => {
      await testDb.insert(accounts).values({
        id: 16,
        name: "Ativo Inexistente",
        type: "investment",
        color: "red",
        pluggyItemId: "item-itau-123",
        pluggyAccountId: "inv-non-existent",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "inv-other",
          itemId: "item-itau-123",
          name: "Outro Ativo",
          type: "SECURITY",
          balance: 1000,
          currencyCode: "BRL",
        },
      ]);

      const res = await syncPluggyInvestmentAccount(16);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("não foi encontrado");
      }
    });

    it("aggregates multiple contracts with group:name: filter", async () => {
      await testDb.insert(accounts).values({
        id: 160,
        name: "Tesouro Selic Nubank",
        type: "investment",
        color: "purple",
        pluggyItemId: "item-nu-123",
        pluggyAccountId: "group:name:Tesouro Selic 2031",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "selic-lot-1",
          itemId: "item-nu-123",
          name: "Tesouro Selic 2031",
          type: "FIXED_INCOME",
          subtype: "TREASURY",
          balance: 10000,
          currencyCode: "BRL",
        },
        {
          id: "selic-lot-2",
          itemId: "item-nu-123",
          name: "Tesouro Selic 2031",
          type: "FIXED_INCOME",
          subtype: "TREASURY",
          balance: 5000,
          currencyCode: "BRL",
        },
        {
          id: "kisu-other",
          itemId: "item-nu-123",
          name: "KISU11",
          type: "EQUITY",
          balance: 3000,
          currencyCode: "BRL",
        },
      ]);

      const res = await syncPluggyInvestmentAccount(160);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.totalBalance).toBe(15000);
        expect(res.investments).toHaveLength(2);
        expect(res.investments.map((i) => i.id)).toEqual(["selic-lot-1", "selic-lot-2"]);
      }
    });

    it("aggregates all treasury bonds with group:subtype:TREASURY", async () => {
      await testDb.insert(accounts).values({
        id: 161,
        name: "Todo Tesouro Direto",
        type: "investment",
        color: "emerald",
        pluggyItemId: "item-nu-123",
        pluggyAccountId: "group:subtype:TREASURY",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "selic-1",
          itemId: "item-nu-123",
          name: "Tesouro Selic 2031",
          type: "FIXED_INCOME",
          subtype: "TREASURY",
          balance: 10000,
          currencyCode: "BRL",
        },
        {
          id: "ipca-1",
          itemId: "item-nu-123",
          name: "Tesouro IPCA+ 2029",
          type: "FIXED_INCOME",
          subtype: "TREASURY",
          balance: 8000,
          currencyCode: "BRL",
        },
        {
          id: "cdb-nu",
          itemId: "item-nu-123",
          name: "CDB Nu Financeira",
          type: "FIXED_INCOME",
          subtype: "CDB",
          balance: 5000,
          currencyCode: "BRL",
        },
      ]);

      const res = await syncPluggyInvestmentAccount(161);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.totalBalance).toBe(18000);
        expect(res.investments).toHaveLength(2);
        expect(res.investments.map((i) => i.id)).toEqual(["selic-1", "ipca-1"]);
      }
    });

    it("aggregates multiple comma-separated IDs", async () => {
      await testDb.insert(accounts).values({
        id: 162,
        name: "Contratos Selecionados",
        type: "investment",
        color: "blue",
        pluggyItemId: "item-nu-123",
        pluggyAccountId: "selic-1, ipca-1",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "selic-1",
          itemId: "item-nu-123",
          name: "Tesouro Selic 2031",
          type: "FIXED_INCOME",
          balance: 10000,
          currencyCode: "BRL",
        },
        {
          id: "ipca-1",
          itemId: "item-nu-123",
          name: "Tesouro IPCA+ 2029",
          type: "FIXED_INCOME",
          balance: 8000,
          currencyCode: "BRL",
        },
        {
          id: "selic-ignore",
          itemId: "item-nu-123",
          name: "Tesouro Selic 2035",
          type: "FIXED_INCOME",
          balance: 4000,
          currencyCode: "BRL",
        },
      ]);

      const res = await syncPluggyInvestmentAccount(162);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.totalBalance).toBe(18000);
        expect(res.investments).toHaveLength(2);
      }
    });

    it("aggregates all mutual funds with group:type:MUTUAL_FUND", async () => {
      await testDb.insert(accounts).values({
        id: 163,
        name: "Todos os Fundos",
        type: "investment",
        color: "blue",
        pluggyItemId: "item-itau-fundos",
        pluggyAccountId: "group:type:MUTUAL_FUND",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "fund-1",
          itemId: "item-itau-fundos",
          name: "Privilege DI",
          type: "MUTUAL_FUND",
          subtype: "FIXED_INCOME_FUND",
          balance: 2831.49,
          currencyCode: "BRL",
        },
        {
          id: "fund-2",
          itemId: "item-itau-fundos",
          name: "Itaú Legend Renda Fixa LP",
          type: "MUTUAL_FUND",
          subtype: "FIXED_INCOME_FUND",
          balance: 14493.58,
          currencyCode: "BRL",
        },
        {
          id: "cdb-ignore",
          itemId: "item-itau-fundos",
          name: "CDB - ITAU UNIBANCO S.A.",
          type: "FIXED_INCOME",
          subtype: "CDB",
          balance: 3000,
          currencyCode: "BRL",
        },
      ]);

      const res = await syncPluggyInvestmentAccount(163);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.totalBalance).toBe(17325.07);
        expect(res.investments).toHaveLength(2);
        expect(res.investments.map((i) => i.id)).toEqual(["fund-1", "fund-2"]);
      }
    });

    it("aggregates all CDBs with group:subtype:CDB", async () => {
      await testDb.insert(accounts).values({
        id: 164,
        name: "Todos os CDBs",
        type: "investment",
        color: "purple",
        pluggyItemId: "item-itau-cdbs",
        pluggyAccountId: "group:subtype:CDB",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "cdb-1",
          itemId: "item-itau-cdbs",
          name: "CDB Lote 1",
          type: "FIXED_INCOME",
          subtype: "CDB",
          balance: 1500,
          currencyCode: "BRL",
        },
        {
          id: "cdb-2",
          itemId: "item-itau-cdbs",
          name: "CDB Lote 2",
          type: "FIXED_INCOME",
          subtype: "CDB",
          balance: 2500,
          currencyCode: "BRL",
        },
        {
          id: "fund-ignore",
          itemId: "item-itau-cdbs",
          name: "Fundo Ações",
          type: "MUTUAL_FUND",
          balance: 5000,
          currencyCode: "BRL",
        },
      ]);

      const res = await syncPluggyInvestmentAccount(164);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.totalBalance).toBe(4000);
        expect(res.investments).toHaveLength(2);
        expect(res.investments.map((i) => i.id)).toEqual(["cdb-1", "cdb-2"]);
      }
    });
  });

  describe("getConnectedPluggyItemsAction Server Action", () => {
    it("returns distinct connected items with institution names and linked accounts", async () => {
      await testDb.insert(accounts).values([
        {
          id: 50,
          name: "Conta Itaú Uniclass",
          type: "bank_account",
          color: "orange",
          pluggyItemId: "item-itau",
        },
        {
          id: 51,
          name: "Cartão Itaú Click",
          type: "credit_card",
          color: "orange",
          pluggyItemId: "item-itau",
        },
        {
          id: 52,
          name: "Conta Nubank",
          type: "bank_account",
          color: "purple",
          pluggyItemId: "item-nu",
        },
      ]);

      const res = await getConnectedPluggyItemsAction();
      expect(res.success).toBe(true);
      expect(res.items.length).toBeGreaterThanOrEqual(2);

      const itauItem = res.items.find((i) => i.id === "item-itau");
      expect(itauItem).toBeDefined();
      expect(itauItem?.name).toBe("Itaú");
      expect(itauItem?.accounts).toContain("Conta Itaú Uniclass");
      expect(itauItem?.accounts).toContain("Cartão Itaú Click");

      const nuItem = res.items.find((i) => i.id === "item-nu");
      expect(nuItem).toBeDefined();
      expect(nuItem?.name).toBe("Nubank");
    });
  });

  describe("fetchPluggyInvestmentsForItemAction Server Action", () => {
    it("returns error for empty itemId", async () => {
      const res = await fetchPluggyInvestmentsForItemAction("");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Identificador do Item Pluggy não informado");
    });

    it("fetches investments for valid itemId and maps summaries correctly", async () => {
      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "inv-test-1",
          itemId: "item-test",
          name: "Tesouro Selic 2029",
          type: "FIXED_INCOME",
          balance: 10500.25,
          amountProfit: 250.5,
          currencyCode: "BRL",
        },
      ]);

      const res = await fetchPluggyInvestmentsForItemAction("item-test");
      expect(res.success).toBe(true);
      if (res.success && res.investments) {
        expect(res.investments).toHaveLength(1);
        expect(res.investments[0].id).toBe("inv-test-1");
        expect(res.investments[0].name).toBe("Tesouro Selic 2029");
        expect(res.investments[0].balance).toBe(10500.25);
        expect(res.investments[0].amountProfit).toBe(250.5);
      }
    });

    it("normalizes Nu Financeira CDBs to include friendly '(Caixinha Nubank)' and includes reserved balances", async () => {
      vi.spyOn(pluggyIntegration, "fetchPluggyInvestments").mockResolvedValueOnce([
        {
          id: "inv-nu-cdb",
          itemId: "item-nu",
          name: "CDB - NU FINANCEIRA S.A. - SOCIEDADE DE CREDITO, FINANCIAMENTO E INVESTIMENTO",
          type: "FIXED_INCOME",
          subtype: "CDB",
          balance: 5009.77,
          currencyCode: "BRL",
        },
      ]);

      vi.spyOn(pluggyIntegration, "fetchPluggyAccounts").mockResolvedValueOnce([
        {
          id: "acc-mp#reserved:res-1",
          itemId: "item-nu",
          name: "Mercado Pago Conta - Reserva",
          type: "BANK",
          subtype: "COFRINHO_RESERVA",
          balance: 5509.5,
          currencyCode: "BRL",
        },
      ]);

      const res = await fetchPluggyInvestmentsForItemAction("item-nu");
      expect(res.success).toBe(true);
      if (res.success && res.investments) {
        expect(res.investments).toHaveLength(2);
        expect(res.investments[0].name).toBe("CDB Nu Financeira (Caixinha Nubank)");
        expect(res.investments[1].id).toBe("acc-mp#reserved:res-1");
        expect(res.investments[1].name).toBe("Mercado Pago Conta - Reserva");
        expect(res.investments[1].balance).toBe(5509.5);
      }
    });

    it("syncs investment account configured with reserved balance id via fetchPluggyAccount", async () => {
      await testDb.insert(accounts).values({
        id: 77,
        name: "Cofrinho MP",
        type: "investment",
        color: "blue",
        pluggyItemId: "item-mp",
        pluggyAccountId: "acc-mp#reserved:res-1",
      });

      vi.spyOn(pluggyIntegration, "fetchPluggyAccount").mockResolvedValueOnce({
        id: "acc-mp#reserved:res-1",
        itemId: "item-mp",
        name: "Mercado Pago Conta - Reserva",
        type: "BANK",
        subtype: "COFRINHO_RESERVA",
        balance: 5509.5,
        currencyCode: "BRL",
      });

      const res = await syncPluggyInvestmentAccount(77);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.totalBalance).toBe(5509.5);
        expect(res.previousBalance).toBe(0);
        expect(res.diff).toBe(5509.5);
      }
    });
  });

  describe("Multiple Pluggy Credentials Support in Server Actions", () => {
    it("getPluggyCredentialsAction lists configured profiles and counts connected items", async () => {
      const originalEnv = { ...process.env };
      process.env.PLUGGY_CLIENT_ID = "main-id";
      process.env.PLUGGY_CLIENT_SECRET = "main-secret";
      process.env.PLUGGY_CREDENTIAL_LABEL = "Pluggy Principal";

      process.env.PLUGGY_CLIENT_ID_2 = "sec-id";
      process.env.PLUGGY_CLIENT_SECRET_2 = "sec-secret";
      process.env.PLUGGY_CREDENTIAL_LABEL_2 = "Pluggy Secundário";

      await testDb.insert(accounts).values([
        {
          id: 101,
          name: "Itaú CC",
          type: "bank_account",
          color: "orange",
          pluggyItemId: "item-itau",
          pluggyAccountId: "acc-itau-1",
          pluggyCredentialId: "default",
        },
        {
          id: 102,
          name: "Nubank CC",
          type: "bank_account",
          color: "purple",
          pluggyItemId: "item-nu",
          pluggyAccountId: "acc-nu-1",
          pluggyCredentialId: "2",
        },
      ]);

      const res = await getPluggyCredentialsAction();
      expect(res.success).toBe(true);
      expect(res.credentials).toHaveLength(2);

      const cred1 = res.credentials.find((c) => c.id === "default");
      const cred2 = res.credentials.find((c) => c.id === "2");

      expect(cred1?.label).toBe("Pluggy Principal");
      expect(cred1?.connectedItemsCount).toBe(1);
      expect(cred2?.label).toBe("Pluggy Secundário");
      expect(cred2?.connectedItemsCount).toBe(1);

      process.env = originalEnv;
    });

    it("getConnectedPluggyItemsAction returns items enriched with credentialId and label", async () => {
      const originalEnv = { ...process.env };
      process.env.PLUGGY_CLIENT_ID = "main-id";
      process.env.PLUGGY_CLIENT_SECRET = "main-secret";
      process.env.PLUGGY_CLIENT_ID_2 = "sec-id";
      process.env.PLUGGY_CLIENT_SECRET_2 = "sec-secret";
      process.env.PLUGGY_CREDENTIAL_LABEL_2 = "Pluggy Secundário";

      await testDb.insert(accounts).values([
        {
          id: 103,
          name: "Itaú Corrente",
          type: "bank_account",
          color: "orange",
          pluggyItemId: "item-itau-multi",
          pluggyAccountId: "acc-itau-99",
          pluggyCredentialId: "default",
        },
        {
          id: 104,
          name: "Nubank Investimentos",
          type: "investment",
          color: "purple",
          pluggyItemId: "item-nu-multi",
          pluggyAccountId: "acc-nu-99",
          pluggyCredentialId: "2",
        },
      ]);

      const res = await getConnectedPluggyItemsAction();
      expect(res.success).toBe(true);

      const itauItem = res.items.find((i) => i.id === "item-itau-multi");
      const nuItem = res.items.find((i) => i.id === "item-nu-multi");

      expect(itauItem?.credentialId).toBe("default");
      expect(itauItem?.credentialLabel).toBe("Pluggy Principal");
      expect(nuItem?.credentialId).toBe("2");
      expect(nuItem?.credentialLabel).toBe("Pluggy Secundário");

      process.env = originalEnv;
    });

    it("syncAllPluggyAccountsAction isolates failures: failure on credential 2 does not abort credential default", async () => {
      await testDb.delete(accounts);
      await testDb.insert(accounts).values([
        {
          id: 201,
          name: "Conta Primária",
          type: "bank_account",
          color: "blue",
          pluggyItemId: "item-1",
          pluggyAccountId: "acc-ok",
          pluggyCredentialId: "default",
        },
        {
          id: 202,
          name: "Conta Secundária",
          type: "bank_account",
          color: "green",
          pluggyItemId: "item-2",
          pluggyAccountId: "acc-fail",
          pluggyCredentialId: "2",
        },
      ]);

      // Mock fetchPluggyTransactions: succeeds for acc-ok, fails for acc-fail
      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockImplementation(
        async (params: any) => {
          if (params.accountId === "acc-ok") {
            return [
              {
                id: "tx-ok-1",
                description: "Depósito OK",
                amount: 500,
                date: "2026-09-05T12:00:00.000Z",
                status: "POSTED",
              },
            ];
          }
          if (params.accountId === "acc-fail") {
            throw new Error("Falha na autenticação do Pluggy para o perfil Pluggy 2 (HTTP 401)");
          }
          return [];
        }
      );

      const summary = await syncAllPluggyAccountsAction("2026-09");
      expect(summary.total).toBe(2);
      expect(summary.successCount).toBe(1);
      expect(summary.failureCount).toBe(1);

      const okResult = summary.results.find((r) => r.accountId === 201);
      const failResult = summary.results.find((r) => r.accountId === 202);

      expect(okResult?.success).toBe(true);
      expect(okResult?.count).toBe(1);
      expect(failResult?.success).toBe(false);
      expect(failResult?.error).toContain("Pluggy 2");
    });

    it("fetchPluggyTransactionsForMonth automatically resolves and persists pluggyCredentialId if missing in DB", async () => {
      await testDb.insert(accounts).values({
        id: 301,
        name: "Inter Sem Credencial",
        type: "bank_account",
        color: "orange",
        pluggyItemId: "item-inter-auto",
        pluggyAccountId: "acc-inter-auto",
        pluggyCredentialId: null,
      });

      pluggyIntegration.setItemCredentialMapping("item-inter-auto", "2");

      vi.spyOn(pluggyIntegration, "fetchPluggyTransactions").mockResolvedValueOnce([
        {
          id: "tx-inter-1",
          description: "PIX Recebido",
          amount: 250,
          date: "2026-09-02T10:00:00.000Z",
          status: "POSTED",
        },
      ]);

      const res = await fetchPluggyTransactionsForMonth(301, "2026-09");
      expect(res.success).toBe(true);

      // Verify DB was updated with the resolved credentialId
      const [updatedAcc] = await testDb
        .select()
        .from(accounts)
        .where(eq(accounts.id, 301));
      expect(updatedAcc.pluggyCredentialId).toBe("2");
    });
  });
});
