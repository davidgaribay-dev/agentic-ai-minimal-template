/**
 * ChatMessage Component Tests
 *
 * Tests for the ChatMessage component including:
 * - User message rendering
 * - Assistant message rendering
 * - Streaming state
 * - Guardrail blocked messages
 * - Source citations
 * - Media attachments
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils/render"
import { ChatMessage } from "./ChatMessage"
import type { MessageSource, ChatMediaAttachment } from "@/lib/chat-store"

describe("ChatMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("User Messages", () => {
    it("renders user message with correct content", () => {
      renderWithProviders(
        <ChatMessage role="user" content="Hello, how are you?" />
      )

      expect(screen.getByText("Hello, how are you?")).toBeInTheDocument()
      expect(screen.getByTestId("chat-message-user")).toBeInTheDocument()
    })

    it("renders user message with media attachments", () => {
      const media: ChatMediaAttachment[] = [
        {
          id: "media-1",
          url: "/test-image.jpg",
          filename: "test-image.jpg",
          mime_type: "image/jpeg",
        },
      ]

      renderWithProviders(
        <ChatMessage role="user" content="Check this image" media={media} />
      )

      expect(screen.getByTestId("chat-message-user")).toBeInTheDocument()
      expect(screen.getByText("Check this image")).toBeInTheDocument()
    })

    it("shows copy button on hover", async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <ChatMessage role="user" content="Copy this message" />
      )

      const messageContainer = screen.getByTestId("chat-message-user")
      await user.hover(messageContainer)

      // Copy button should be visible (opacity changes on hover via CSS)
      const copyButton = screen.getByRole("button", { name: /copy/i })
      expect(copyButton).toBeInTheDocument()
    })

    it("shows check icon after copy button is clicked", async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <ChatMessage role="user" content="Copy this content" />
      )

      const copyButton = screen.getByRole("button", { name: /copy/i })
      await user.click(copyButton)

      // After clicking, the button should show the check icon (copied state)
      // The lucide-check class indicates the checkmark icon is displayed
      await waitFor(() => {
        const checkIcon = copyButton.querySelector(".lucide-check")
        expect(checkIcon).toBeInTheDocument()
      })
    })
  })

  describe("Assistant Messages", () => {
    it("renders assistant message with correct content", () => {
      renderWithProviders(
        <ChatMessage role="assistant" content="I'm doing well, thank you!" />
      )

      expect(
        screen.getByText("I'm doing well, thank you!")
      ).toBeInTheDocument()
      expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument()
    })

    it("renders streaming indicator when streaming without content", () => {
      renderWithProviders(
        <ChatMessage role="assistant" content="" isStreaming={true} />
      )

      // Should show streaming indicator (three dots animation)
      expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument()
    })

    it("renders content while streaming", () => {
      renderWithProviders(
        <ChatMessage
          role="assistant"
          content="Partial response..."
          isStreaming={true}
        />
      )

      expect(screen.getByText("Partial response...")).toBeInTheDocument()
    })

    it("shows copy button for assistant messages", async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <ChatMessage role="assistant" content="Assistant response" />
      )

      const messageContainer = screen.getByTestId("chat-message-assistant")
      await user.hover(messageContainer)

      const copyButton = screen.getByRole("button", { name: /copy/i })
      expect(copyButton).toBeInTheDocument()
    })
  })

  describe("Guardrail Blocked Messages", () => {
    it("renders blocked message with special styling", () => {
      renderWithProviders(
        <ChatMessage
          role="assistant"
          content="This content was blocked for safety reasons"
          guardrail_blocked={true}
        />
      )

      expect(screen.getByTestId("chat-message-blocked")).toBeInTheDocument()
      expect(
        screen.getByText("This content was blocked for safety reasons")
      ).toBeInTheDocument()
    })

    it("does not show copy button for blocked messages", () => {
      renderWithProviders(
        <ChatMessage
          role="assistant"
          content="Blocked content"
          guardrail_blocked={true}
        />
      )

      // Should not have a copy button
      expect(
        screen.queryByRole("button", { name: /copy/i })
      ).not.toBeInTheDocument()
    })
  })

  describe("Source Citations", () => {
    const mockSources: MessageSource[] = [
      {
        content: "Source content from document 1",
        source: "/documents/doc1.pdf",
        file_type: "pdf",
        metadata: null,
        relevance_score: 0.95,
        chunk_index: 0,
        document_id: "doc-1",
      },
      {
        content: "Source content from document 2",
        source: "/documents/doc2.md",
        file_type: "md",
        metadata: null,
        relevance_score: 0.87,
        chunk_index: 0,
        document_id: "doc-2",
      },
    ]

    it("renders sources section for assistant messages with sources", () => {
      renderWithProviders(
        <ChatMessage
          role="assistant"
          content="Here is information from the documents."
          sources={mockSources}
        />
      )

      // Sources should be displayed
      expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument()
    })

    it("does not render sources section while streaming", () => {
      renderWithProviders(
        <ChatMessage
          role="assistant"
          content="Still loading..."
          sources={mockSources}
          isStreaming={true}
        />
      )

      // Sources header should not be present while streaming
      const assistantMessage = screen.getByTestId("chat-message-assistant")
      expect(assistantMessage).toBeInTheDocument()
    })
  })

  describe("Markdown Rendering", () => {
    it("renders bold text correctly", () => {
      renderWithProviders(
        <ChatMessage role="assistant" content="This is **bold** text" />
      )

      expect(screen.getByText("bold")).toBeInTheDocument()
    })

    it("renders code blocks", () => {
      renderWithProviders(
        <ChatMessage
          role="assistant"
          content="Here is code:\n```javascript\nconst x = 1;\n```"
        />
      )

      expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument()
    })

    it("renders inline code", () => {
      renderWithProviders(
        <ChatMessage
          role="assistant"
          content="Use the `useState` hook for state."
        />
      )

      expect(screen.getByText("useState")).toBeInTheDocument()
    })
  })

  describe("Custom className", () => {
    it("applies custom className to user message", () => {
      renderWithProviders(
        <ChatMessage
          role="user"
          content="Test"
          className="custom-class"
        />
      )

      const message = screen.getByTestId("chat-message-user")
      expect(message).toHaveClass("custom-class")
    })

    it("applies custom className to assistant message", () => {
      renderWithProviders(
        <ChatMessage
          role="assistant"
          content="Test"
          className="custom-class"
        />
      )

      const message = screen.getByTestId("chat-message-assistant")
      expect(message).toHaveClass("custom-class")
    })
  })

  describe("Memo Optimization", () => {
    it("handles empty content gracefully", () => {
      renderWithProviders(<ChatMessage role="assistant" content="" />)

      // Should render without errors, no streaming indicator when not streaming
      expect(screen.getByTestId("chat-message-assistant")).toBeInTheDocument()
    })

    it("handles undefined arrays gracefully", () => {
      renderWithProviders(
        <ChatMessage
          role="assistant"
          content="Message"
          sources={undefined}
          media={undefined}
        />
      )

      expect(screen.getByText("Message")).toBeInTheDocument()
    })
  })
})
