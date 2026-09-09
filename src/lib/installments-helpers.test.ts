import { describe, it, expect } from "vitest";
import {
  computeOriginMonth,
  cleanInstallmentDescription,
  isSameInstallmentSeries,
} from "./installments-helpers";

describe("installments-helpers", () => {
  describe("computeOriginMonth", () => {
    it("computes the correct origin month for various installment numbers", () => {
      expect(computeOriginMonth("2026-07", 2)).toBe("2026-06");
      expect(computeOriginMonth("2026-08", 3)).toBe("2026-06");
      expect(computeOriginMonth("2026-09", 4)).toBe("2026-06");
      expect(computeOriginMonth("2026-01", 1)).toBe("2026-01");
      expect(computeOriginMonth("2026-01", 2)).toBe("2025-12");
      expect(computeOriginMonth("2026-01", 13)).toBe("2025-01");
    });
  });

  describe("cleanInstallmentDescription", () => {
    it("strips installment numbers and normalizes strings", () => {
      expect(cleanInstallmentDescription("MERCADOLIVRE*MERCADOLI")).toBe("mercadolivremercadoli");
      expect(cleanInstallmentDescription("DROGASIL2776SAO PA01/02")).toBe("drogasil2776saopa");
      expect(cleanInstallmentDescription("DROGASIL2776SAO PA02/02")).toBe("drogasil2776saopa");
      expect(cleanInstallmentDescription("ALLIANZ SEGU*1 de 10")).toBe("allianzsegu");
      expect(cleanInstallmentDescription("ZarpoSao PauloBR  08/12")).toBe("zarposaopaulobr");
      expect(cleanInstallmentDescription("ZarpoSao PauloBR  09/12")).toBe("zarposaopaulobr");
    });
  });

  describe("isSameInstallmentSeries", () => {
    it("matches the user Mercado Livre case where description changed in August", () => {
      const july = {
        accountId: 8,
        month: "2026-07",
        day: 4,
        description: "MERCADOLIVRE*MERCADOLI",
        originalDescription: "MERCADOLIVRE*MERCADOLI",
        amount: -108.07,
        installmentCurrent: 2,
        installmentTotal: 6,
        purchaseDate: "04/06/2026",
      };

      const august = {
        accountId: 8,
        month: "2026-08",
        day: 4,
        description: "Microondas",
        originalDescription: "MERCADOLIVRE*MERCADOLI",
        amount: -108.07,
        installmentCurrent: 3,
        installmentTotal: 6,
        purchaseDate: "04/06/2026",
      };

      expect(isSameInstallmentSeries(july, august)).toBe(true);
    });

    it("matches when originalDescription has incrementing parcel numbers (e.g. Drogasil 01/02 vs 02/02)", () => {
      const p1 = {
        accountId: 2,
        month: "2026-08",
        day: 14,
        description: "Drogasil",
        originalDescription: "DROGASIL2776SAO PA01/02",
        amount: -171.53,
        installmentCurrent: 1,
        installmentTotal: 2,
        purchaseDate: "14/07/2026",
      };

      const p2 = {
        accountId: 2,
        month: "2026-09",
        day: 14,
        description: "Drogasil",
        originalDescription: "DROGASIL2776SAO PA02/02",
        amount: -171.52,
        installmentCurrent: 2,
        installmentTotal: 2,
        purchaseDate: "14/07/2026",
      };

      expect(isSameInstallmentSeries(p1, p2)).toBe(true);
    });

    it("distinguishes different purchases with same origin month, account and total installments", () => {
      // Two different Drogasil purchases in August 2026 with different amounts
      const d1 = {
        accountId: 2,
        month: "2026-09",
        day: 29,
        description: "Drogasil",
        originalDescription: "RAIA DROGASIL SASA01/03",
        amount: -49.78,
        installmentCurrent: 1,
        installmentTotal: 3,
        purchaseDate: "29/08/2026",
      };

      const d2 = {
        accountId: 2,
        month: "2026-09",
        day: 29,
        description: "Drogasil",
        originalDescription: "DROGASIL2776SAO PA01/03",
        amount: -45.94,
        installmentCurrent: 1,
        installmentTotal: 3,
        purchaseDate: "29/08/2026",
      };

      expect(isSameInstallmentSeries(d1, d2)).toBe(false);
    });

    it("does not match different accounts", () => {
      const a = {
        accountId: 1,
        month: "2026-07",
        day: 4,
        description: "TV",
        amount: -100,
        installmentCurrent: 1,
        installmentTotal: 3,
      };
      const b = {
        accountId: 2,
        month: "2026-08",
        day: 4,
        description: "TV",
        amount: -100,
        installmentCurrent: 2,
        installmentTotal: 3,
      };
      expect(isSameInstallmentSeries(a, b)).toBe(false);
    });

    it("does not match different total installments", () => {
      const a = {
        accountId: 1,
        month: "2026-07",
        day: 4,
        description: "TV",
        amount: -100,
        installmentCurrent: 1,
        installmentTotal: 3,
      };
      const b = {
        accountId: 1,
        month: "2026-08",
        day: 4,
        description: "TV",
        amount: -100,
        installmentCurrent: 2,
        installmentTotal: 4,
      };
      expect(isSameInstallmentSeries(a, b)).toBe(false);
    });
  });
});
