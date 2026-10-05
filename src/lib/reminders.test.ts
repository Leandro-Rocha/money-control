import { describe, it, expect } from "vitest";
import { formatReminderNotification, type DueItem } from "./reminders";

describe("formatReminderNotification", () => {
  const baseItem: DueItem = {
    id: "card-bill-1",
    sourceType: "credit_card_bill",
    sourceId: 1,
    title: "Fatura Nubank",
    accountName: "Nubank",
    accountColor: "#820ad1",
    amount: 1450.5,
    dueDay: 20,
    month: "2026-09",
    status: "upcoming",
    daysDifference: 3,
    paymentAccountId: 10,
    isPaid: false,
  };

  const defaultOptions = {
    ntfyTopic: "test-topic",
    appPublicUrl: "https://money.cafofo.casa",
    secret: "test-secret-token",
  };

  it("formats countdown for 3 days before (D-3)", () => {
    const payload = formatReminderNotification({ ...baseItem, daysDifference: 3 }, defaultOptions);
    expect(payload.title).toBe("Fatura Nubank • Vence em 3 dias");
    expect(payload.priority).toBe(2);
    expect(payload.tags).toEqual([]);
    expect(payload.message).toContain("1.450,50");
    expect(payload.actions).toHaveLength(2);
    expect(payload.actions[0].label).toBe("Marcar como Pago");
    expect(payload.actions[0].action).toBe("http");
    expect(payload.actions[0].headers?.Authorization).toBe("Bearer test-secret-token");
    expect(payload.actions[1].label).toBe("Abrir Sistema");
  });

  it("formats countdown for 2 days before (D-2)", () => {
    const payload = formatReminderNotification({ ...baseItem, daysDifference: 2 }, defaultOptions);
    expect(payload.title).toBe("Fatura Nubank • Vence em 2 dias");
    expect(payload.priority).toBe(3);
    expect(payload.tags).toEqual([]);
  });

  it("formats countdown for 1 day before / tomorrow (D-1)", () => {
    const payload = formatReminderNotification({ ...baseItem, daysDifference: 1 }, defaultOptions);
    expect(payload.title).toBe("Fatura Nubank • Vence amanhã");
    expect(payload.priority).toBe(4);
    expect(payload.tags).toEqual([]);
  });

  it("formats due today (D-0)", () => {
    const payload = formatReminderNotification({ ...baseItem, daysDifference: 0, status: "due_today" }, defaultOptions);
    expect(payload.title).toBe("Fatura Nubank • Vence hoje");
    expect(payload.priority).toBe(5);
    expect(payload.tags).toEqual(["warning"]);
  });

  it("formats overdue (D+X)", () => {
    const payload = formatReminderNotification(
      { ...baseItem, daysDifference: -2, status: "overdue" },
      defaultOptions
    );
    expect(payload.title).toBe("Fatura Nubank • Vencido há 2d");
    expect(payload.priority).toBe(5);
    expect(payload.message).toContain("Vencimento em 20/09 (pendente)");
    expect(payload.tags).toEqual(["warning"]);
  });

  it("omits 'Marcar como Pago' action if card has no paymentAccountId", () => {
    const itemWithoutPaymentAccount: DueItem = {
      ...baseItem,
      paymentAccountId: null,
    };
    const payload = formatReminderNotification(itemWithoutPaymentAccount, defaultOptions);
    expect(payload.actions).toHaveLength(1);
    expect(payload.actions[0].label).toBe("Abrir Sistema");
  });

  it("includes 'Marcar como Pago' action for recurring expense", () => {
    const recurringItem: DueItem = {
      id: "rec-10",
      sourceType: "recurring",
      sourceId: 10,
      title: "Condomínio",
      accountName: "Itaú",
      accountColor: "orange",
      amount: 600,
      dueDay: 10,
      month: "2026-09",
      status: "due_today",
      daysDifference: 0,
      isPaid: false,
    };
    const payload = formatReminderNotification(recurringItem, defaultOptions);
    expect(payload.actions).toHaveLength(2);
    expect(payload.actions[0].label).toBe("Marcar como Pago");
  });
});
