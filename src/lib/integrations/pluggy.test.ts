import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPluggyApiKey,
  fetchPluggyTransactions,
  fetchPluggyItem,
  fetchPluggyAccounts,
  fetchPluggyAccount,
  fetchPluggyBills,
  fetchPluggyInvestments,
  clearPluggyTokenCache,
  getCachedPluggyToken,
  getPluggyCredentialProfiles,
  resolveCredentialForItem,
  setItemCredentialMapping,
  getItemCredentialMapping,
  clearItemCredentialCache,
} from "./pluggy";

describe("Pluggy Integration Client", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    clearPluggyTokenCache();
    clearItemCredentialCache();
    process.env.PLUGGY_CLIENT_ID = "test-client-id";
    process.env.PLUGGY_CLIENT_SECRET = "test-client-secret";
    process.env.PLUGGY_API_URL = "https://api.pluggy.test";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Authentication & Token Caching", () => {
    it("throws error if PLUGGY_CLIENT_ID or PLUGGY_CLIENT_SECRET is not configured", async () => {
      delete process.env.PLUGGY_CLIENT_ID;
      await expect(getPluggyApiKey()).rejects.toThrow(
        /Credenciais do Pluggy não configuradas/
      );

      process.env.PLUGGY_CLIENT_ID = "test-client-id";
      delete process.env.PLUGGY_CLIENT_SECRET;
      await expect(getPluggyApiKey()).rejects.toThrow(
        /Credenciais do Pluggy não configuradas/
      );
    });

    it("authenticates via POST /auth and returns apiKey", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ apiKey: "mock-api-key-123" }),
      });
      global.fetch = mockFetch;

      const apiKey = await getPluggyApiKey();

      expect(apiKey).toBe("mock-api-key-123");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.pluggy.test/auth",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          }),
        })
      );
    });

    it("caches the token and reuses it across subsequent calls within TTL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ apiKey: "cached-key-abc" }),
      });
      global.fetch = mockFetch;

      const key1 = await getPluggyApiKey();
      const key2 = await getPluggyApiKey();

      expect(key1).toBe("cached-key-abc");
      expect(key2).toBe("cached-key-abc");
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only 1 network call made!
    });

    it("re-authenticates after token cache is cleared", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "first-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "second-key" }),
        });
      global.fetch = mockFetch;

      const key1 = await getPluggyApiKey();
      expect(key1).toBe("first-key");

      clearPluggyTokenCache();
      expect(getCachedPluggyToken()).toBeNull();

      const key2 = await getPluggyApiKey();
      expect(key2).toBe("second-key");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws a descriptive error when auth fails with HTTP error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Invalid Client Credentials",
      });

      await expect(getPluggyApiKey()).rejects.toThrow(
        "Falha na autenticação do Pluggy (HTTP 401): Invalid Client Credentials"
      );
    });
  });

  describe("fetchPluggyTransactions", () => {
    it("throws error if accountId is not provided", async () => {
      await expect(fetchPluggyTransactions({ accountId: "" })).rejects.toThrow(
        /accountId.*obrigatório/
      );
    });

    it("fetches transactions for account and period with X-API-KEY header", async () => {
      const mockTransactions = [
        {
          id: "tx-1",
          description: "Supermercado Pão de Açúcar",
          amount: -150.25,
          date: "2026-08-10T14:30:00.000Z",
          status: "POSTED",
          category: "Alimentação",
        },
        {
          id: "tx-2",
          description: "TED Recebida",
          amount: 2500.0,
          date: "2026-08-05T09:00:00.000Z",
          status: "POSTED",
          category: "Transferências",
        },
      ];

      const mockFetch = vi
        .fn()
        // Auth call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        // Transactions call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: mockTransactions,
            page: 1,
            totalPages: 1,
            total: 2,
          }),
        });
      global.fetch = mockFetch;

      const txs = await fetchPluggyTransactions({
        accountId: "acc-uuid-123",
        from: "2026-08-01",
        to: "2026-08-31",
      });

      expect(txs).toHaveLength(2);
      expect(txs[0].id).toBe("tx-1");
      expect(txs[0].amount).toBe(-150.25);

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          "https://api.pluggy.test/v2/transactions?accountId=acc-uuid-123&dateFrom=2026-08-01&dateTo=2026-08-31"
        ),
        expect.objectContaining({
          method: "GET",
          headers: { "X-API-KEY": "mock-api-key" },
        })
      );
    });

    it("handles multi-page pagination correctly using next cursor", async () => {
      const page1 = [{ id: "tx-1", description: "Item 1", amount: -10, date: "2026-08-01", status: "POSTED" }];
      const page2 = [{ id: "tx-2", description: "Item 2", amount: -20, date: "2026-08-02", status: "POSTED" }];

      const mockFetch = vi
        .fn()
        // Auth call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        // Page 1
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: page1,
            next: "?accountId=acc-uuid-123&after=cursor-2",
          }),
        })
        // Page 2
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: page2,
            next: null,
          }),
        });
      global.fetch = mockFetch;

      const txs = await fetchPluggyTransactions({
        accountId: "acc-uuid-123",
      });

      expect(txs).toHaveLength(2);
      expect(txs.map((t) => t.id)).toEqual(["tx-1", "tx-2"]);
      expect(mockFetch).toHaveBeenCalledTimes(3); // auth + page 1 + page 2
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("after=cursor-2"),
        expect.anything()
      );
    });

    it("clears cache and throws error on 401 Unauthorized", async () => {
      const mockFetch = vi
        .fn()
        // Auth call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "expired-key" }),
        })
        // Transactions call returning 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => "Token expired",
        })
        // Nova chave e nova tentativa, que também falha
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "new-key" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => "Token expired",
        });
      global.fetch = mockFetch;

      await expect(
        fetchPluggyTransactions({ accountId: "acc-uuid-123" })
      ).rejects.toThrow("Falha ao buscar transações do Pluggy (HTTP 401): Token expired");

      expect(getCachedPluggyToken()).toBeNull();
    });

    it("on 403 API_KEY_MISSING_OR_INVALID gets a new key and retries once", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ apiKey: "stale-key" }) })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => '{"code":403,"codeDescription":"API_KEY_MISSING_OR_INVALID"}',
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ apiKey: "fresh-key" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: "tx-1" }] }) });
      global.fetch = mockFetch;

      const txs = await fetchPluggyTransactions({ accountId: "acc-uuid-123" });

      expect(txs.map((t) => t.id)).toEqual(["tx-1"]);
      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/v2/transactions"),
        expect.objectContaining({ headers: { "X-API-KEY": "fresh-key" } })
      );
      expect(getCachedPluggyToken()?.apiKey).toBe("fresh-key");
    });

    it("filters by billId in memory and parses creditCardMetadata", async () => {
      const mockTransactions = [
        {
          id: "tx-cc-1",
          description: "MAGALU 01/10",
          amount: 120.0,
          date: "2026-08-10T14:30:00.000Z",
          status: "POSTED",
          type: "DEBIT",
          creditCardMetadata: {
            installmentNumber: 1,
            totalInstallments: 10,
            billId: "bill-august",
            purchaseDate: "2026-08-01",
          },
        },
        {
          id: "tx-cc-2",
          description: "OUTRA COMPRA",
          amount: 50.0,
          date: "2026-08-11T14:30:00.000Z",
          status: "POSTED",
          type: "DEBIT",
          creditCardMetadata: {
            installmentNumber: 1,
            totalInstallments: 1,
            billId: "bill-september",
            purchaseDate: "2026-08-11",
          },
        },
      ];

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: mockTransactions,
            next: null,
          }),
        });
      global.fetch = mockFetch;

      const txs = await fetchPluggyTransactions({
        accountId: "cc-acc-123",
        billId: "bill-august",
      });

      expect(txs).toHaveLength(1);
      expect(txs[0].id).toBe("tx-cc-1");
      expect(txs[0].creditCardMetadata?.installmentNumber).toBe(1);
      expect(txs[0].creditCardMetadata?.totalInstallments).toBe(10);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("v2/transactions?accountId=cc-acc-123"),
        expect.anything()
      );
      expect(mockFetch).not.toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("billId="),
        expect.anything()
      );
    });
  });

  describe("fetchPluggyItem & fetchPluggyAccounts", () => {
    it("fetches item information", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "item-123",
            status: "UPDATED",
            executionStatus: "SUCCESS",
            connector: { name: "Banco do Brasil" },
          }),
        });
      global.fetch = mockFetch;

      const item = await fetchPluggyItem("item-123");
      expect(item.id).toBe("item-123");
      expect(item.status).toBe("UPDATED");
      expect(item.connector?.name).toBe("Banco do Brasil");
    });

    it("fetches accounts for an item", async () => {
      const mockAccounts = [
        {
          id: "acc-1",
          name: "Conta Corrente",
          type: "BANK",
          balance: 1500.5,
          currencyCode: "BRL",
          itemId: "item-123",
        },
      ];

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: mockAccounts,
          }),
        });
      global.fetch = mockFetch;

      const accounts = await fetchPluggyAccounts("item-123");
      expect(accounts).toHaveLength(1);
      expect(accounts[0].name).toBe("Conta Corrente");
      expect(accounts[0].balance).toBe(1500.5);
    });

    it("unpacks bankData.reservedBalances as virtual accounts with subtype COFRINHO_RESERVA", async () => {
      const mockAccounts = [
        {
          id: "acc-mp-1",
          name: "Mercado Pago Conta",
          type: "BANK",
          subtype: "CHECKING_ACCOUNT",
          balance: 0,
          currencyCode: "BRL",
          itemId: "item-mp",
          bankData: {
            reservedBalances: [
              {
                amount: 5509.5,
                identification: "reserva-uuid-123",
                name: "Reserva",
              },
            ],
          },
        },
      ];

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: mockAccounts,
          }),
        });
      global.fetch = mockFetch;

      const accounts = await fetchPluggyAccounts("item-mp");
      expect(accounts).toHaveLength(2);
      expect(accounts[0].id).toBe("acc-mp-1");
      expect(accounts[0].balance).toBe(0);

      const reservedAcc = accounts[1];
      expect(reservedAcc.id).toBe("acc-mp-1#reserved:reserva-uuid-123");
      expect(reservedAcc.name).toBe("Mercado Pago Conta - Reserva");
      expect(reservedAcc.balance).toBe(5509.5);
      expect(reservedAcc.subtype).toBe("COFRINHO_RESERVA");
    });
  });

  describe("fetchPluggyAccount with reserved balance id", () => {
    it("fetches base account and returns the specific reserved balance", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "acc-mp-1",
            name: "Mercado Pago",
            type: "BANK",
            balance: 10,
            currencyCode: "BRL",
            bankData: {
              reservedBalances: [
                {
                  amount: 5509.5,
                  identification: "reserva-uuid-123",
                  name: "Reserva Emergência",
                },
              ],
            },
          }),
        });
      global.fetch = mockFetch;

      const acc = await fetchPluggyAccount("acc-mp-1#reserved:reserva-uuid-123");
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "https://api.pluggy.test/accounts/acc-mp-1",
        expect.anything()
      );
      expect(acc.id).toBe("acc-mp-1#reserved:reserva-uuid-123");
      expect(acc.name).toBe("Mercado Pago - Reserva Emergência");
      expect(acc.balance).toBe(5509.5);
      expect(acc.subtype).toBe("COFRINHO_RESERVA");
    });
  });

  describe("fetchPluggyBills", () => {
    it("throws error if accountId is missing", async () => {
      await expect(fetchPluggyBills("")).rejects.toThrow(/accountId.*obrigatório/);
    });

    it("fetches bills for a credit card account", async () => {
      const mockBills = [
        {
          id: "bill-1",
          dueDate: "2026-08-10T00:00:00.000Z",
          billClosingDate: "2026-08-03T00:00:00.000Z",
          totalAmount: 1450.2,
          minimumPaymentAmount: 200.0,
        },
        {
          id: "bill-2",
          dueDate: "2026-07-10T00:00:00.000Z",
          billClosingDate: "2026-07-03T00:00:00.000Z",
          totalAmount: 890.0,
        },
      ];

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: mockBills,
          }),
        });
      global.fetch = mockFetch;

      const bills = await fetchPluggyBills("cc-acc-456");
      expect(bills).toHaveLength(2);
      expect(bills[0].id).toBe("bill-1");
      expect(bills[0].dueDate).toBe("2026-08-10T00:00:00.000Z");
      expect(bills[0].totalAmount).toBe(1450.2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "https://api.pluggy.test/bills?accountId=cc-acc-456",
        expect.objectContaining({
          method: "GET",
          headers: { "X-API-KEY": "mock-api-key" },
        })
      );
    });

    it("clears token cache and throws error on 401 response", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => "Unauthorized",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "new-key" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => "Unauthorized",
        });
      global.fetch = mockFetch;

      await expect(fetchPluggyBills("cc-acc-456")).rejects.toThrow(
        "Falha ao consultar faturas do Pluggy (HTTP 401): Unauthorized"
      );
      expect(getCachedPluggyToken()).toBeNull();
    });
  });

  describe("fetchPluggyInvestments", () => {
    it("throws error if itemId is empty", async () => {
      await expect(fetchPluggyInvestments("")).rejects.toThrow(
        "Identificador de item do Pluggy (itemId) é obrigatório."
      );
    });

    it("fetches investments handling pagination", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              {
                id: "inv-1",
                itemId: "item-123",
                name: "Tesouro Selic 2029",
                type: "FIXED_INCOME",
                balance: 10500.5,
                currencyCode: "BRL",
              },
            ],
            page: 1,
            totalPages: 2,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              {
                id: "inv-2",
                itemId: "item-123",
                name: "Fundo Multimercado",
                type: "MUTUAL_FUND",
                balance: 5200.0,
                currencyCode: "BRL",
              },
            ],
            page: 2,
            totalPages: 2,
          }),
        });
      global.fetch = mockFetch;

      const investments = await fetchPluggyInvestments("item-123");
      expect(investments).toHaveLength(2);
      expect(investments[0].name).toBe("Tesouro Selic 2029");
      expect(investments[0].balance).toBe(10500.5);
      expect(investments[1].name).toBe("Fundo Multimercado");
      expect(investments[1].balance).toBe(5200.0);

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "https://api.pluggy.test/investments?itemId=item-123&page=1&pageSize=500",
        expect.objectContaining({
          method: "GET",
          headers: { "X-API-KEY": "mock-api-key" },
        })
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        "https://api.pluggy.test/investments?itemId=item-123&page=2&pageSize=500",
        expect.objectContaining({
          method: "GET",
          headers: { "X-API-KEY": "mock-api-key" },
        })
      );
    });

    it("clears token cache and throws error on 401 response", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "mock-api-key" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => "Unauthorized",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "new-key" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => "Unauthorized",
        });
      global.fetch = mockFetch;

      await expect(fetchPluggyInvestments("item-123")).rejects.toThrow(
        "Falha ao consultar investimentos do Pluggy (HTTP 401): Unauthorized"
      );
      expect(getCachedPluggyToken()).toBeNull();
    });
  });

  describe("Multi-Profile Credentials & Partitioned Caching", () => {
    it("reads default profile correctly", () => {
      process.env.PLUGGY_CREDENTIAL_LABEL = "Minha Conta Principal";
      const profiles = getPluggyCredentialProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0]).toEqual({
        id: "default",
        label: "Minha Conta Principal",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        isDefault: true,
      });
    });

    it("reads multiple profiles via suffixed environment variables", () => {
      process.env.PLUGGY_CLIENT_ID_2 = "client-id-secondary";
      process.env.PLUGGY_CLIENT_SECRET_2 = "client-secret-secondary";
      process.env.PLUGGY_CREDENTIAL_LABEL_2 = "Conta Secundária";

      process.env.PLUGGY_CLIENT_ID_PESSOAL = "client-id-pessoal";
      process.env.PLUGGY_CLIENT_SECRET_PESSOAL = "client-secret-pessoal";

      const profiles = getPluggyCredentialProfiles();
      expect(profiles).toHaveLength(3);

      const p1 = profiles.find((p) => p.id === "default");
      const p2 = profiles.find((p) => p.id === "2");
      const p3 = profiles.find((p) => p.id === "pessoal");

      expect(p1?.label).toBe("Pluggy Principal");
      expect(p2?.label).toBe("Conta Secundária");
      expect(p2?.clientId).toBe("client-id-secondary");
      expect(p3?.label).toBe("Pluggy PESSOAL");
      expect(p3?.clientId).toBe("client-id-pessoal");
    });

    it("reads profiles from PLUGGY_CREDENTIALS JSON array", () => {
      delete process.env.PLUGGY_CLIENT_ID;
      delete process.env.PLUGGY_CLIENT_SECRET;

      process.env.PLUGGY_CREDENTIALS = JSON.stringify([
        { id: "corp", label: "Pluggy PJ", clientId: "pj-id", clientSecret: "pj-secret" },
        { id: "pf", label: "Pluggy PF", clientId: "pf-id", clientSecret: "pf-secret" },
      ]);

      const profiles = getPluggyCredentialProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles[0]).toEqual({
        id: "corp",
        label: "Pluggy PJ",
        clientId: "pj-id",
        clientSecret: "pj-secret",
        isDefault: true,
      });
      expect(profiles[1]).toEqual({
        id: "pf",
        label: "Pluggy PF",
        clientId: "pf-id",
        clientSecret: "pf-secret",
        isDefault: false,
      });
    });

    it("maintains separate token cache per credential profile", async () => {
      process.env.PLUGGY_CLIENT_ID_2 = "client-2";
      process.env.PLUGGY_CLIENT_SECRET_2 = "secret-2";
      process.env.PLUGGY_CREDENTIAL_LABEL_2 = "Pluggy 2";

      const mockFetch = vi
        .fn()
        .mockImplementation(async (url: string, opts: any) => {
          const body = JSON.parse(opts.body);
          if (body.clientId === "test-client-id") {
            return { ok: true, json: async () => ({ apiKey: "token-profile-default" }) };
          }
          if (body.clientId === "client-2") {
            return { ok: true, json: async () => ({ apiKey: "token-profile-2" }) };
          }
          return { ok: false, status: 401, text: async () => "Unauthorized" };
        });
      global.fetch = mockFetch;

      const tokenDefault = await getPluggyApiKey("default");
      const token2 = await getPluggyApiKey("2");

      expect(tokenDefault).toBe("token-profile-default");
      expect(token2).toBe("token-profile-2");

      expect(getCachedPluggyToken("default")?.apiKey).toBe("token-profile-default");
      expect(getCachedPluggyToken("2")?.apiKey).toBe("token-profile-2");

      // Verify selective cache eviction
      clearPluggyTokenCache("2");
      expect(getCachedPluggyToken("2")).toBeNull();
      expect(getCachedPluggyToken("default")?.apiKey).toBe("token-profile-default");

      // Verify global cache eviction
      clearPluggyTokenCache();
      expect(getCachedPluggyToken("default")).toBeNull();
    });

    it("resolves itemId immediately if hint or mapping exists", async () => {
      setItemCredentialMapping("item-pre-mapped", "2");
      const resolved = await resolveCredentialForItem("item-pre-mapped");
      expect(resolved).toBe("2");

      const resolvedWithHint = await resolveCredentialForItem("item-dynamic", "2");
      expect(resolvedWithHint).toBe("2");
      expect(getItemCredentialMapping("item-dynamic")).toBe("2");
    });

    it("probes configured profiles to discover item credential and caches the result", async () => {
      process.env.PLUGGY_CLIENT_ID_2 = "client-2";
      process.env.PLUGGY_CLIENT_SECRET_2 = "secret-2";

      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.endsWith("/auth")) {
          const body = JSON.parse(opts.body);
          return {
            ok: true,
            json: async () => ({
              apiKey: body.clientId === "test-client-id" ? "key-default" : "key-2",
            }),
          };
        }
        if (url.includes("/items/item-on-account-2")) {
          if (opts.headers["X-API-KEY"] === "key-default") {
            return { ok: false, status: 404, text: async () => "Not Found" };
          }
          if (opts.headers["X-API-KEY"] === "key-2") {
            return {
              ok: true,
              json: async () => ({ id: "item-on-account-2", status: "UPDATED" }),
            };
          }
        }
        return { ok: false, status: 500 };
      });
      global.fetch = mockFetch;

      const discoveredProfileId = await resolveCredentialForItem("item-on-account-2");
      expect(discoveredProfileId).toBe("2");
      expect(getItemCredentialMapping("item-on-account-2")).toBe("2");

      // Subsequent call should hit cache without network probing for item
      const initialCallCount = mockFetch.mock.calls.length;
      const cachedProfileId = await resolveCredentialForItem("item-on-account-2");
      expect(cachedProfileId).toBe("2");
      expect(mockFetch.mock.calls.length).toBe(initialCallCount);
    });

    it("dispatches fetchPluggyItem using the correct credential profile", async () => {
      process.env.PLUGGY_CLIENT_ID_2 = "client-2";
      process.env.PLUGGY_CLIENT_SECRET_2 = "secret-2";
      setItemCredentialMapping("item-secondary", "2");

      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.endsWith("/auth")) {
          return { ok: true, json: async () => ({ apiKey: "key-2" }) };
        }
        if (url.includes("/items/item-secondary")) {
          return {
            ok: true,
            json: async () => ({ id: "item-secondary", status: "UPDATED" }),
          };
        }
        return { ok: false, status: 404 };
      });
      global.fetch = mockFetch;

      const item = await fetchPluggyItem("item-secondary");
      expect(item.id).toBe("item-secondary");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.pluggy.test/items/item-secondary",
        expect.objectContaining({
          headers: { "X-API-KEY": "key-2" },
        })
      );
    });
  });
});
