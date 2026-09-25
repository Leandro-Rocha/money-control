import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { DueDatesTimelineWidget } from "./DueDatesTimelineWidget";
import { AccountData } from "@/lib/types";

describe("DueDatesTimelineWidget", () => {
  it("renders null if there are no accounts with due dates or recurring items", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DueDatesTimelineWidget, {
        month: "2026-09",
        accountsData: [],
      })
    );

    expect(html).toBe("");
  });

  it("renders the 3 sequential blocks when due items are present", () => {
    const mockAccountsData: AccountData[] = [
      {
        account: {
          id: 1,
          name: "Nubank",
          type: "credit_card",
          color: "#820ad1",
          dueDay: 20,
          isActive: 1,
          displayOrder: 1,
        },
        transactions: [],
        initialBalance: 0,
        totalExpense: 500,
        totalIncome: 0,
        netBalance: -500,
        finalBalance: -500,
      },
    ];

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DueDatesTimelineWidget, {
        month: "2026-09",
        accountsData: mockAccountsData,
      })
    );

    expect(html).toContain("Agenda de Vencimentos");
    expect(html).toContain("Já Passou");
    expect(html).toContain("Vence Hoje");
    expect(html).toContain("Na Sequência");
    expect(html).toContain("Fatura Nubank");
  });
});
