/**
 * Pluggy Open Finance API client.
 * Server-side HTTP client using native fetch, caching API key for 2 hours.
 */

export interface PluggyCreditCardMetadata {
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  totalAmount?: number | null;
  payeeName?: string | null;
  purchaseDate?: string | null;
  cardNumber?: string | null;
  billId?: string | null;
  billForecastDate?: string | null;
}

export interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO format e.g. "2026-08-15T00:00:00.000Z" or "2026-08-15"
  category?: string;
  categoryId?: string;
  status: string; // "POSTED" | "PENDING"
  amountInAccountCurrency?: number;
  type?: "DEBIT" | "CREDIT";
  operationType?: string;
  creditCardMetadata?: PluggyCreditCardMetadata | null;
}

export interface PluggyBill {
  id: string;
  dueDate: string;
  billClosingDate?: string;
  totalAmount: number;
  minimumPaymentAmount?: number;
  totalAmountInAccountCurrency?: number;
}

export interface PluggyTransactionsResponse {
  results: PluggyTransaction[];
  page?: number;
  total?: number;
  totalPages?: number;
}

export interface FetchPluggyTransactionsParams {
  accountId: string;
  from?: string; // Format: "YYYY-MM-DD"
  to?: string;   // Format: "YYYY-MM-DD"
  billId?: string;
  pageSize?: number;
  credentialId?: string;
}

export interface PluggyAccount {
  id: string;
  name: string;
  number?: string;
  type: string;
  subtype?: string;
  balance: number;
  currencyCode: string;
  itemId: string;
}

export interface PluggyItem {
  id: string;
  status: string;
  executionStatus: string;
  connector?: { name: string; institutionUrl?: string };
  lastUpdatedAt?: string;
}

export interface PluggyInvestment {
  id: string;
  itemId: string;
  type: string;
  subtype?: string | null;
  number?: string | null;
  balance: number;
  name: string;
  lastMonthRate?: number | null;
  annualRate?: number | null;
  currencyCode: string;
  code?: string | null;
  isin?: string | null;
  value?: number | null;
  quantity?: number | null;
  amount?: number | null;
  taxes?: number | null;
  taxes2?: number | null;
  date?: string | null;
  owner?: string | null;
  amountProfit?: number | null;
  amountWithdrawal?: number | null;
  amountOriginal?: number | null;
  status?: string | null;
  institution?: {
    name?: string | null;
    number?: string | null;
  } | null;
}

export interface PluggyInvestmentsResponse {
  results: PluggyInvestment[];
  page?: number;
  total?: number;
  totalPages?: number;
}

export interface PluggyCredentialProfile {
  id: string;
  label: string;
  clientId: string;
  clientSecret: string;
  isDefault?: boolean;
}

export interface CachedToken {
  apiKey: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const itemCredentialCache = new Map<string, string>();

export function getPluggyBaseUrl(): string {
  return process.env.PLUGGY_API_URL?.trim() || "https://api.pluggy.ai";
}

export function clearPluggyTokenCache(credentialId?: string): void {
  if (credentialId) {
    tokenCache.delete(credentialId);
  } else {
    tokenCache.clear();
  }
}

export function getCachedPluggyToken(credentialId?: string): CachedToken | null {
  const targetId = credentialId || "default";
  return tokenCache.get(targetId) || null;
}

export function setItemCredentialMapping(itemId: string, credentialId: string): void {
  if (itemId && credentialId) {
    itemCredentialCache.set(itemId.trim(), credentialId.trim());
  }
}

export function getItemCredentialMapping(itemId: string): string | undefined {
  return itemCredentialCache.get(itemId.trim());
}

export function clearItemCredentialCache(): void {
  itemCredentialCache.clear();
}

/**
 * Returns all configured Pluggy credential profiles.
 */
export function getPluggyCredentialProfiles(): PluggyCredentialProfile[] {
  const profiles: PluggyCredentialProfile[] = [];
  const seenIds = new Set<string>();

  // 1. Primary / default profile
  const defaultClientId = process.env.PLUGGY_CLIENT_ID?.trim();
  const defaultClientSecret = process.env.PLUGGY_CLIENT_SECRET?.trim();
  const defaultLabel = process.env.PLUGGY_CREDENTIAL_LABEL?.trim() || "Pluggy Principal";

  if (defaultClientId && defaultClientSecret) {
    profiles.push({
      id: "default",
      label: defaultLabel,
      clientId: defaultClientId,
      clientSecret: defaultClientSecret,
      isDefault: true,
    });
    seenIds.add("default");
  }

  // 2. Structured JSON in PLUGGY_CREDENTIALS
  const credentialsJson = process.env.PLUGGY_CREDENTIALS?.trim();
  if (credentialsJson) {
    try {
      const parsed = JSON.parse(credentialsJson);
      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          if (item?.clientId && item?.clientSecret) {
            const id = item.id ? String(item.id).trim() : `json_${i + 1}`;
            if (!seenIds.has(id)) {
              profiles.push({
                id,
                label: item.label ? String(item.label).trim() : `Pluggy ${id}`,
                clientId: String(item.clientId).trim(),
                clientSecret: String(item.clientSecret).trim(),
                isDefault: profiles.length === 0,
              });
              seenIds.add(id);
            }
          }
        }
      }
    } catch (e) {
      console.error("Erro ao fazer parse de PLUGGY_CREDENTIALS:", e);
    }
  }

  // 3. Dynamic prefixed env vars: PLUGGY_CLIENT_ID_*, e.g. PLUGGY_CLIENT_ID_2
  const envKeys = Object.keys(process.env);
  for (const key of envKeys) {
    const match = key.match(/^PLUGGY_CLIENT_ID_([A-Za-z0-9_]+)$/);
    if (match) {
      const suffix = match[1];
      const id = suffix.toLowerCase();
      if (!seenIds.has(id)) {
        const cId = process.env[key]?.trim();
        const cSecret = process.env[`PLUGGY_CLIENT_SECRET_${suffix}`]?.trim();
        const label =
          process.env[`PLUGGY_CREDENTIAL_LABEL_${suffix}`]?.trim() || `Pluggy ${suffix}`;

        if (cId && cSecret) {
          profiles.push({
            id,
            label,
            clientId: cId,
            clientSecret: cSecret,
            isDefault: profiles.length === 0,
          });
          seenIds.add(id);
        }
      }
    }
  }

  return profiles;
}

/**
 * Obtains an active apiKey from Pluggy for a specific credential profile,
 * using cached token if still within its 2-hour TTL.
 */
export async function getPluggyApiKey(credentialId?: string): Promise<string> {
  const profiles = getPluggyCredentialProfiles();
  if (profiles.length === 0) {
    throw new Error(
      "Credenciais do Pluggy não configuradas no ambiente (PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET ausente)."
    );
  }

  const targetId = credentialId || "default";
  const profile =
    profiles.find((p) => p.id === targetId) ||
    (targetId === "default" ? profiles[0] : undefined);

  if (!profile) {
    throw new Error(
      `Perfil de credencial do Pluggy "${targetId}" não encontrado no ambiente.`
    );
  }

  const now = Date.now();
  const cached = tokenCache.get(profile.id);
  if (cached && now < cached.expiresAt) {
    return cached.apiKey;
  }

  const baseUrl = getPluggyBaseUrl();
  const res = await fetch(`${baseUrl}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: profile.clientId, clientSecret: profile.clientSecret }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const profileSuffix = profile.id !== "default" ? ` para o perfil "${profile.label}"` : "";
    throw new Error(
      `Falha na autenticação do Pluggy${profileSuffix} (HTTP ${res.status}): ${errText}`
    );
  }

  const data = (await res.json()) as { apiKey?: string };
  if (!data.apiKey) {
    throw new Error("Resposta da autenticação do Pluggy não continha apiKey.");
  }

  // Pluggy token is valid for 2 hours (7200 seconds).
  // Cache with 100 seconds safety margin (7100 seconds = 7,100,000 ms).
  const cachedInfo: CachedToken = {
    apiKey: data.apiKey,
    expiresAt: now + 7100 * 1000,
  };
  tokenCache.set(profile.id, cachedInfo);

  return data.apiKey;
}

/**
 * Resolves which Pluggy credential owns the specified itemId.
 */
export async function resolveCredentialForItem(
  itemId: string,
  hintCredentialId?: string | null
): Promise<string> {
  const cleanItemId = itemId.trim();
  if (hintCredentialId && hintCredentialId.trim()) {
    itemCredentialCache.set(cleanItemId, hintCredentialId.trim());
    return hintCredentialId.trim();
  }

  const cached = itemCredentialCache.get(cleanItemId);
  if (cached) return cached;

  const profiles = getPluggyCredentialProfiles();
  if (profiles.length <= 1) {
    const defaultId = profiles[0]?.id || "default";
    itemCredentialCache.set(cleanItemId, defaultId);
    return defaultId;
  }

  const baseUrl = getPluggyBaseUrl();

  for (const profile of profiles) {
    try {
      const apiKey = await getPluggyApiKey(profile.id);
      const res = await fetch(`${baseUrl}/items/${cleanItemId}`, {
        method: "GET",
        headers: { "X-API-KEY": apiKey },
      });

      if (res.ok) {
        itemCredentialCache.set(cleanItemId, profile.id);
        return profile.id;
      }
    } catch {
      // Tenta próximo perfil
    }
  }

  // Se nenhum perfil retornou 200, usa o padrão
  itemCredentialCache.set(cleanItemId, profiles[0].id);
  return profiles[0].id;
}

/**
 * Fetches transactions for a specific Pluggy account and date period, handling pagination.
 */
export async function fetchPluggyTransactions(
  params: FetchPluggyTransactionsParams,
  credentialId?: string
): Promise<PluggyTransaction[]> {
  if (!params.accountId) {
    throw new Error("Identificador de conta do Pluggy (accountId) é obrigatório.");
  }

  const targetCredentialId = credentialId || params.credentialId;
  const apiKey = await getPluggyApiKey(targetCredentialId);
  const baseUrl = getPluggyBaseUrl();
  const allTransactions: PluggyTransaction[] = [];
  const pageSize = params.pageSize || 500;
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(`${baseUrl}/transactions`);
    const realAccountId = params.accountId.split("#")[0];
    url.searchParams.set("accountId", realAccountId);
    if (params.from) url.searchParams.set("from", params.from);
    if (params.to) url.searchParams.set("to", params.to);
    if (params.billId) url.searchParams.set("billId", params.billId);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearPluggyTokenCache(targetCredentialId);
      }
      const errText = await res.text();
      throw new Error(`Falha ao buscar transações do Pluggy (HTTP ${res.status}): ${errText}`);
    }

    const data = (await res.json()) as PluggyTransactionsResponse;
    if (data.results && Array.isArray(data.results)) {
      allTransactions.push(...data.results);
    }
    totalPages = data.totalPages || 1;
    page++;
  } while (page <= totalPages);

  return allTransactions;
}

/**
 * Fetches item details from Pluggy (connection status, connector info).
 */
export async function fetchPluggyItem(
  itemId: string,
  credentialId?: string
): Promise<PluggyItem> {
  if (!itemId) {
    throw new Error("Identificador de item do Pluggy (itemId) é obrigatório.");
  }

  const targetCredentialId = credentialId || (await resolveCredentialForItem(itemId));
  const apiKey = await getPluggyApiKey(targetCredentialId);
  const baseUrl = getPluggyBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}`, {
    method: "GET",
    headers: { "X-API-KEY": apiKey },
  });

  if (!res.ok) {
    if (res.status === 401) clearPluggyTokenCache(targetCredentialId);
    const errText = await res.text();
    throw new Error(`Falha ao consultar Item do Pluggy (HTTP ${res.status}): ${errText}`);
  }

  return (await res.json()) as PluggyItem;
}

/**
 * Fetches single account details from Pluggy.
 */
export async function fetchPluggyAccount(
  accountId: string,
  credentialId?: string
): Promise<PluggyAccount> {
  if (!accountId) {
    throw new Error("Identificador de conta do Pluggy (accountId) é obrigatório.");
  }

  const [baseId, reservedPart] = accountId.split("#reserved:");
  const apiKey = await getPluggyApiKey(credentialId);
  const baseUrl = getPluggyBaseUrl();
  const res = await fetch(`${baseUrl}/accounts/${baseId}`, {
    method: "GET",
    headers: { "X-API-KEY": apiKey },
  });

  if (!res.ok) {
    if (res.status === 401) clearPluggyTokenCache(credentialId);
    const errText = await res.text();
    throw new Error(`Falha ao consultar conta do Pluggy (HTTP ${res.status}): ${errText}`);
  }

  const acc = (await res.json()) as PluggyAccount;
  if (reservedPart) {
    const bankData = (acc as any).bankData;
    const rb = bankData?.reservedBalances?.find(
      (r: any) => (r.identification || "reserva") === reservedPart
    );
    if (rb) {
      const amount = typeof rb.amount === "number" ? rb.amount : (rb.availableAmounts?.[0]?.amount ?? 0);
      const currencyCode = rb.currencyCode || rb.availableAmounts?.[0]?.currencyCode || acc.currencyCode || "BRL";
      return {
        ...acc,
        id: accountId,
        name: `${acc.name} - ${rb.name || "Cofrinho / Reserva"}`,
        subtype: "COFRINHO_RESERVA",
        balance: amount,
        currencyCode,
      };
    }
  }

  return acc;
}

/**
 * Fetches all accounts associated with an Item, including reserved balances (cofrinhos/reservas).
 */
export async function fetchPluggyAccounts(
  itemId: string,
  credentialId?: string
): Promise<PluggyAccount[]> {
  if (!itemId) {
    throw new Error("Identificador de item do Pluggy (itemId) é obrigatório.");
  }

  const targetCredentialId = credentialId || (await resolveCredentialForItem(itemId));
  const apiKey = await getPluggyApiKey(targetCredentialId);
  const baseUrl = getPluggyBaseUrl();
  const res = await fetch(`${baseUrl}/accounts?itemId=${itemId}`, {
    method: "GET",
    headers: { "X-API-KEY": apiKey },
  });

  if (!res.ok) {
    if (res.status === 401) clearPluggyTokenCache(targetCredentialId);
    const errText = await res.text();
    throw new Error(`Falha ao consultar contas do Pluggy (HTTP ${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { results?: PluggyAccount[] };
  const rawResults = data.results || [];
  const allAccounts: PluggyAccount[] = [];

  for (const acc of rawResults) {
    allAccounts.push(acc);
    const bankData = (acc as any).bankData;
    if (bankData?.reservedBalances && Array.isArray(bankData.reservedBalances)) {
      for (const rb of bankData.reservedBalances) {
        const amount = typeof rb.amount === "number" ? rb.amount : (rb.availableAmounts?.[0]?.amount ?? 0);
        const currencyCode = rb.currencyCode || rb.availableAmounts?.[0]?.currencyCode || acc.currencyCode || "BRL";
        allAccounts.push({
          id: `${acc.id}#reserved:${rb.identification || "reserva"}`,
          name: `${acc.name} - ${rb.name || "Cofrinho / Reserva"}`,
          number: acc.number,
          type: "BANK",
          subtype: "COFRINHO_RESERVA",
          balance: amount,
          currencyCode,
          itemId: acc.itemId,
        });
      }
    }
  }

  return allAccounts;
}

/**
 * Fetches all bills for a credit card account.
 */
export async function fetchPluggyBills(
  accountId: string,
  credentialId?: string
): Promise<PluggyBill[]> {
  if (!accountId) {
    throw new Error("Identificador de conta do Pluggy (accountId) é obrigatório.");
  }

  const apiKey = await getPluggyApiKey(credentialId);
  const baseUrl = getPluggyBaseUrl();
  const res = await fetch(`${baseUrl}/bills?accountId=${accountId}`, {
    method: "GET",
    headers: { "X-API-KEY": apiKey },
  });

  if (!res.ok) {
    if (res.status === 401) clearPluggyTokenCache(credentialId);
    const errText = await res.text();
    throw new Error(`Falha ao consultar faturas do Pluggy (HTTP ${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { results?: PluggyBill[] };
  return data.results || [];
}

/**
 * Fetches all investments for a given Pluggy Item, handling pagination.
 */
export async function fetchPluggyInvestments(
  itemId: string,
  credentialId?: string
): Promise<PluggyInvestment[]> {
  if (!itemId) {
    throw new Error("Identificador de item do Pluggy (itemId) é obrigatório.");
  }

  const targetCredentialId = credentialId || (await resolveCredentialForItem(itemId));
  const apiKey = await getPluggyApiKey(targetCredentialId);
  const baseUrl = getPluggyBaseUrl();
  const allInvestments: PluggyInvestment[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(`${baseUrl}/investments`);
    url.searchParams.set("itemId", itemId);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", "500");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-API-KEY": apiKey },
    });

    if (!res.ok) {
      if (res.status === 401) clearPluggyTokenCache(targetCredentialId);
      const errText = await res.text();
      throw new Error(`Falha ao consultar investimentos do Pluggy (HTTP ${res.status}): ${errText}`);
    }

    const data = (await res.json()) as PluggyInvestmentsResponse;
    if (data.results && Array.isArray(data.results)) {
      allInvestments.push(...data.results);
    }
    totalPages = data.totalPages || 1;
    page++;
  } while (page <= totalPages);

  return allInvestments;
}

