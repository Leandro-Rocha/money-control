/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";

const syncAll = vi.fn();
vi.mock("@/lib/actions/pluggy", () => ({ syncAllPluggyAccountsAction: (m: string) => syncAll(m) }));
vi.mock("@/lib/actions/projections", () => ({
  findBillPaymentCandidatesAction: vi.fn(async () => []),
  confirmBillPaymentCandidateAction: vi.fn(),
}));

import { SyncAllAccountsModal } from "./SyncAllAccountsModal";

afterEach(() => {
  cleanup();
  syncAll.mockReset();
});

const props = { month: "2026-10", onClose: () => {}, onSuccess: () => {} };

describe("SyncAllAccountsModal", () => {
  it("avisa o fim com ok=true quando alguma conta sincronizou", async () => {
    syncAll.mockResolvedValue({ results: [], total: 2, successCount: 1, failureCount: 1 });
    const onSynced = vi.fn();
    render(<SyncAllAccountsModal {...props} onSynced={onSynced} />);
    await waitFor(() => expect(onSynced).toHaveBeenCalledWith(true));
    expect(onSynced).toHaveBeenCalledTimes(1);
  });

  it("avisa ok=false quando nenhuma conta sincronizou ou a ação falhou", async () => {
    syncAll.mockRejectedValue(new Error("pluggy fora"));
    const onSynced = vi.fn();
    render(<SyncAllAccountsModal {...props} onSynced={onSynced} />);
    await waitFor(() => expect(onSynced).toHaveBeenCalledWith(false));
  });
});
