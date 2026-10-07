/** Contas abertas como coluna no extrato: 1 ou 2, a mais antiga sai primeiro. */
export const MAX_OPEN = 2;

/** Só conta corrente e cartão abrem como coluna no extrato. */
export const isColumnAccountType = (type: string | null | undefined) => type === "bank_account" || type === "credit_card";

export function parseSelection(raw: string | null, ids: number[]): number[] {
  if (ids.length === 0) return [];
  const valid = new Set(ids);
  let picked: number[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      picked = parsed.map(Number);
    } else if (parsed && typeof parsed === "object") {
      // Formato antigo: { [id]: expandido }
      picked = Object.entries(parsed as Record<string, unknown>)
        .filter(([, open]) => open === true)
        .map(([id]) => Number(id));
    }
  } catch {
    picked = [];
  }
  const out = [...new Set(picked.filter((id) => valid.has(id)))].slice(0, MAX_OPEN);
  return out.length ? out : [ids[0]];
}

export function openAccount(sel: number[], id: number): number[] {
  if (sel.includes(id)) return sel;
  return [...sel, id].slice(-MAX_OPEN);
}

export function closeAccount(sel: number[], id: number): number[] {
  return sel.filter((x) => x !== id);
}

/** Clique troca a seleção; Ctrl/⌘+clique soma ou tira (nunca zera). */
export function selectAccount(sel: number[], id: number, additive: boolean): number[] {
  if (!additive) return [id];
  if (sel.includes(id)) return sel.length > 1 ? closeAccount(sel, id) : sel;
  return openAccount(sel, id);
}
