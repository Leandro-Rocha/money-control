/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { ConfirmDialog } from "./ui/confirm-dialog"

describe("ConfirmDialog", () => {
  afterEach(() => {
    cleanup()
  })
  it("renders correctly when open", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Test Title"
        description="Test Description"
        onConfirm={() => {}}
      />
    )

    expect(screen.getByText("Test Title")).toBeInTheDocument()
    expect(screen.getByText("Test Description")).toBeInTheDocument()
    expect(screen.getByText("Cancelar")).toBeInTheDocument()
    expect(screen.getByText("Confirmar")).toBeInTheDocument()
  })

  it("does not render when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Test Title"
        description="Test Description"
        onConfirm={() => {}}
      />
    )

    expect(screen.queryByText("Test Title")).not.toBeInTheDocument()
  })

  it("calls onOpenChange with false when cancel is clicked", async () => {
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Test Title"
        description="Test Description"
        onConfirm={() => {}}
      />
    )

    fireEvent.click(screen.getByText("Cancelar"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("calls onConfirm when confirm is clicked", async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Test Title"
        description="Test Description"
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByText("Confirmar"))
    expect(onConfirm).toHaveBeenCalled()
  })

  it("renders custom labels", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Test Title"
        description="Test Description"
        onConfirm={() => {}}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
    )

    expect(screen.getByText("Sim")).toBeInTheDocument()
    expect(screen.getByText("Não")).toBeInTheDocument()
  })
})
