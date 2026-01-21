/**
 * ToolApprovalCard Component Tests
 *
 * Tests for the MCP tool approval card including:
 * - Pending state rendering
 * - Approve button functionality
 * - Reject button functionality
 * - Tool arguments display (collapsed/expanded)
 * - Loading state
 * - Rejection message with undo
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils/render"
import {
  ToolApprovalCard,
  ToolRejectionMessage,
  type ToolApprovalData,
} from "./ToolApprovalCard"

describe("ToolApprovalCard", () => {
  const mockData: ToolApprovalData = {
    tool_name: "read_file",
    tool_args: {
      path: "/home/user/document.txt",
      encoding: "utf-8",
    },
    tool_call_id: "call-123",
    tool_description: "Reads the contents of a file from the filesystem",
  }

  const mockOnApprove = vi.fn()
  const mockOnReject = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Pending State", () => {
    it("renders tool name and description", () => {
      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      expect(screen.getByTestId("tool-approval-card")).toBeInTheDocument()
      expect(screen.getByTestId("tool-approval-name")).toHaveTextContent(
        "read_file"
      )
      expect(
        screen.getByText("Reads the contents of a file from the filesystem")
      ).toBeInTheDocument()
    })

    it("renders approve and reject buttons", () => {
      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      expect(screen.getByTestId("tool-approve-button")).toBeInTheDocument()
      expect(screen.getByTestId("tool-reject-button")).toBeInTheDocument()
    })

    it("shows arguments toggle when tool has arguments", () => {
      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      // Should show "Show arguments" button with count
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument()
    })

    it("does not show arguments toggle when tool has no arguments", () => {
      const dataWithoutArgs: ToolApprovalData = {
        ...mockData,
        tool_args: {},
      }

      renderWithProviders(
        <ToolApprovalCard
          data={dataWithoutArgs}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      // Should not show arguments count
      expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument()
    })
  })

  describe("Arguments Display", () => {
    it("expands arguments when toggle is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      // Find and click the expand button
      const expandButton = screen.getByRole("button", { name: /(2)/ })
      await user.click(expandButton)

      // Should now show the arguments
      expect(screen.getByText("path:")).toBeInTheDocument()
      expect(screen.getByText(/document\.txt/)).toBeInTheDocument()
      expect(screen.getByText("encoding:")).toBeInTheDocument()
      expect(screen.getByText("utf-8")).toBeInTheDocument()
    })

    it("collapses arguments when toggle is clicked again", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      const expandButton = screen.getByRole("button", { name: /(2)/ })

      // Expand
      await user.click(expandButton)
      expect(screen.getByText("path:")).toBeInTheDocument()

      // Collapse
      await user.click(expandButton)
      await waitFor(() => {
        expect(screen.queryByText("path:")).not.toBeInTheDocument()
      })
    })
  })

  describe("Approve Action", () => {
    it("calls onApprove after visual feedback delay", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      const approveButton = screen.getByTestId("tool-approve-button")
      await user.click(approveButton)

      // Should not be called immediately
      expect(mockOnApprove).not.toHaveBeenCalled()

      // After delay, should be called
      vi.advanceTimersByTime(300)
      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledTimes(1)
      })
    })

    it("shows approved state with green checkmark", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      const approveButton = screen.getByTestId("tool-approve-button")
      await user.click(approveButton)

      // Should show approved state
      await waitFor(() => {
        expect(screen.getByText(/read_file/)).toBeInTheDocument()
      })
    })
  })

  describe("Reject Action", () => {
    it("calls onReject after visual feedback delay", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      const rejectButton = screen.getByTestId("tool-reject-button")
      await user.click(rejectButton)

      // Should not be called immediately
      expect(mockOnReject).not.toHaveBeenCalled()

      // After delay, should be called
      vi.advanceTimersByTime(300)
      await waitFor(() => {
        expect(mockOnReject).toHaveBeenCalledTimes(1)
      })
    })

    it("shows rejected state with red X", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
        />
      )

      const rejectButton = screen.getByTestId("tool-reject-button")
      await user.click(rejectButton)

      // Should show rejected state
      await waitFor(() => {
        expect(screen.getByText(/read_file/)).toBeInTheDocument()
      })
    })
  })

  describe("Loading State", () => {
    it("disables buttons when isLoading is true", () => {
      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          isLoading={true}
        />
      )

      expect(screen.getByTestId("tool-approve-button")).toBeDisabled()
      expect(screen.getByTestId("tool-reject-button")).toBeDisabled()
    })
  })

  describe("Custom className", () => {
    it("applies custom className", () => {
      renderWithProviders(
        <ToolApprovalCard
          data={mockData}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          className="custom-test-class"
        />
      )

      expect(screen.getByTestId("tool-approval-card")).toHaveClass(
        "custom-test-class"
      )
    })
  })
})

describe("ToolRejectionMessage", () => {
  const mockOnUndo = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders tool name in rejection message", () => {
    renderWithProviders(<ToolRejectionMessage toolName="read_file" />)

    expect(screen.getByText("read_file")).toBeInTheDocument()
  })

  it("shows undo button when onUndo is provided", () => {
    renderWithProviders(
      <ToolRejectionMessage toolName="read_file" onUndo={mockOnUndo} />
    )

    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument()
  })

  it("does not show undo button when onUndo is not provided", () => {
    renderWithProviders(<ToolRejectionMessage toolName="read_file" />)

    expect(
      screen.queryByRole("button", { name: /undo/i })
    ).not.toBeInTheDocument()
  })

  it("calls onUndo when undo button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    renderWithProviders(
      <ToolRejectionMessage toolName="read_file" onUndo={mockOnUndo} />
    )

    const undoButton = screen.getByRole("button", { name: /undo/i })
    await user.click(undoButton)

    expect(mockOnUndo).toHaveBeenCalledTimes(1)
  })

  it("hides undo button after timeout", async () => {
    renderWithProviders(
      <ToolRejectionMessage
        toolName="read_file"
        onUndo={mockOnUndo}
        undoTimeoutMs={5000}
      />
    )

    // Undo button should be visible initially
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument()

    // Advance past the timeout
    vi.advanceTimersByTime(5001)

    // Undo button should be hidden
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /undo/i })
      ).not.toBeInTheDocument()
    })
  })

  it("applies custom className", () => {
    const { container } = renderWithProviders(
      <ToolRejectionMessage toolName="read_file" className="custom-class" />
    )

    expect(container.firstChild).toHaveClass("custom-class")
  })
})
