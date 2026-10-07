import { parseNumberInput } from "@/lib/format";
import type { ExtraPurchase, Scenario } from "./types";

export interface PurchaseDraft {
  description: string;
  amount: string;
  installments: string;
  accountId: string;
  date: string;
}

export const emptyDraft = (accountId: string, date: string): PurchaseDraft => ({
  description: "",
  amount: "",
  installments: "1",
  accountId,
  date,
});

export const isActiveDraft = (d: PurchaseDraft) => d.description.trim() !== "" || d.amount.trim() !== "";

export type BuiltScenario = { status: "empty" } | { status: "invalid"; error: string } | { status: "ok"; scenario: Scenario };

export function buildScenario(drafts: PurchaseDraft[], includeBaseline: boolean, includeReimbursements: boolean): BuiltScenario {
  const extraPurchases: ExtraPurchase[] = [];
  for (const d of drafts) {
    if (!isActiveDraft(d)) continue;
    const amount = parseNumberInput(d.amount);
    if (amount == null || amount <= 0 || !d.accountId) {
      return { status: "invalid", error: "Preencha valor (positivo) e conta de cada compra." };
    }
    extraPurchases.push({
      description: d.description.trim() || "Compra simulada",
      amount,
      installments: Math.max(1, Math.round(Number(d.installments) || 1)),
      accountId: Number(d.accountId),
      date: d.date || undefined,
    });
  }
  if (extraPurchases.length === 0) return { status: "empty" };
  return { status: "ok", scenario: { extraPurchases, includeBaseline, includeReimbursements } };
}

export interface SavedScenario {
  name: string;
  drafts: PurchaseDraft[];
  includeBaseline: boolean;
  includeReimbursements: boolean;
}

export const SCENARIOS_KEY = "money_control_plan_scenarios";

const isDraft = (d: unknown): d is PurchaseDraft =>
  typeof d === "object" &&
  d != null &&
  ["description", "amount", "installments", "accountId", "date"].every((k) => typeof (d as Record<string, unknown>)[k] === "string");

const isSaved = (s: unknown): s is SavedScenario =>
  typeof s === "object" &&
  s != null &&
  typeof (s as SavedScenario).name === "string" &&
  Array.isArray((s as SavedScenario).drafts) &&
  (s as SavedScenario).drafts.every(isDraft) &&
  typeof (s as SavedScenario).includeBaseline === "boolean" &&
  typeof (s as SavedScenario).includeReimbursements === "boolean";

export function loadScenarios(storage: Pick<Storage, "getItem"> | null): SavedScenario[] {
  try {
    const raw = storage?.getItem(SCENARIOS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isSaved) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistScenarios(list: SavedScenario[], storage: Pick<Storage, "setItem"> | null) {
  try {
    storage?.setItem(SCENARIOS_KEY, JSON.stringify(list));
  } catch {
    // modo privado ou cota cheia: cenários ficam só nesta sessão
  }
}

export function upsertScenario(list: SavedScenario[], s: SavedScenario): SavedScenario[] {
  const name = s.name.trim();
  return [{ ...s, name }, ...list.filter((x) => x.name !== name)];
}

export const removeScenario = (list: SavedScenario[], name: string) => list.filter((x) => x.name !== name);

export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
