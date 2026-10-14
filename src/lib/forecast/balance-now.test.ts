import { describe, expect, it } from "vitest";
import { balanceNowByAccount } from "./balance-now";

const today = "2026-10-14";

describe("balanceNowByAccount", () => {
  it("sem snapshot soma só lançamentos reais até hoje", () => {
    const r = balanceNowByAccount({
      accountIds: [1],
      today,
      snapshots: [],
      transactions: [
        { accountId: 1, month: "2026-10", day: 2, amount: 1000 },
        { accountId: 1, month: "2026-10", day: 14, amount: -100 },
        { accountId: 1, month: "2026-10", day: 20, amount: -500 },
      ],
    });
    expect(r[1]).toBe(900);
  });

  it("ancora no snapshot e soma só o que veio depois dele, até hoje", () => {
    const r = balanceNowByAccount({
      accountIds: [1],
      today,
      snapshots: [
        { accountId: 1, date: "2026-10-05", balance: 5000 },
        { accountId: 1, date: "2026-09-30", balance: 100 },
        { accountId: 1, date: "2026-10-20", balance: 99999 },
      ],
      transactions: [
        { accountId: 1, month: "2026-10", day: 5, amount: -200 },
        { accountId: 1, month: "2026-10", day: 6, amount: -50.25 },
        { accountId: 1, month: "2026-10", day: 25, amount: -1 },
      ],
    });
    expect(r[1]).toBe(4949.75);
  });

  it("separa por conta", () => {
    const r = balanceNowByAccount({
      accountIds: [1, 2],
      today,
      snapshots: [{ accountId: 2, date: "2026-10-01", balance: 10 }],
      transactions: [
        { accountId: 1, month: "2026-10", day: 1, amount: 5 },
        { accountId: 2, month: "2026-10", day: 3, amount: 7 },
      ],
    });
    expect(r).toEqual({ 1: 5, 2: 17 });
  });
});
