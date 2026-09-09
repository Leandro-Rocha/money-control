import { describe, it, expect } from "vitest";
import { formatUncategorizedForWhatsApp } from "./triage-utils";

describe("formatUncategorizedForWhatsApp", () => {
  it("returns empty string when items list is empty", () => {
    expect(formatUncategorizedForWhatsApp([])).toBe("");
  });

  it("formats transactions clearly with header, numbered items, and footer", () => {
    const items = [
      {
        day: 4,
        month: "2026-09",
        accountName: "Nubank",
        amount: -32.5,
        description: "Uber *Trip",
        originalDescription: "UBER TRIP 123",
      },
      {
        day: 12,
        month: "2026-09",
        accountName: "XP Visa",
        amount: -145.0,
        description: "Restaurante ABC",
        originalDescription: "RESTAURANTE ABC SP",
      },
    ];

    const result = formatUncategorizedForWhatsApp(items);

    expect(result).toContain("Oi! Dá uma olhada nessas compras aqui pra gente categorizar:");
    expect(result).toContain("1. 04/09 • R$ 32,50 • Nubank: UBER TRIP 123");
    expect(result).toContain("2. 12/09 • R$ 145,00 • XP Visa: RESTAURANTE ABC SP");
    expect(result).toContain("Sabe o que foram?");
  });

  it("uses purchaseDate DD/MM if present", () => {
    const items = [
      {
        day: 10,
        month: "2026-09",
        purchaseDate: "28/08/2026",
        accountName: "XP Visa",
        amount: -89.9,
        description: "Drogaria SP",
        originalDescription: "DROGARIA SP",
      },
    ];

    const result = formatUncategorizedForWhatsApp(items);
    expect(result).toContain("1. 28/08 • R$ 89,90 • XP Visa: DROGARIA SP");
  });

  it("falls back to description if originalDescription is absent", () => {
    const items = [
      {
        day: 5,
        month: "2026-09",
        accountName: "Nubank",
        amount: -50.0,
        description: "Pix Manual",
        originalDescription: null,
      },
    ];

    const result = formatUncategorizedForWhatsApp(items);
    expect(result).toContain("1. 05/09 • R$ 50,00 • Nubank: Pix Manual");
  });
});
