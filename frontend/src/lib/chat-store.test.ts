/**
 * Tests for chat-store.ts
 *
 * Tests for Zustand stores managing chat state:
 * - useChatMessagesStore: Multi-instance message state
 * - useChatPageStore: Page-level selection/editing state
 */

import { describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import {
  useChatMessagesStore,
  useChatPageStore,
  type ChatMessage,
  type PendingToolApproval,
  type RejectedToolCall,
} from "./chat-store"

// Helper to create a test message
function createTestMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role: "user",
    content: "Test message",
    isStreaming: false,
    ...overrides,
  }
}

describe("useChatMessagesStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatMessagesStore.setState({ sessions: {} })
  })

  describe("getSession", () => {
    it("returns default session for new instanceId", () => {
      const session = useChatMessagesStore.getState().getSession("test")

      expect(session).toEqual({
        messages: [],
        isStreaming: false,
        error: null,
        conversationId: null,
        pendingToolApproval: null,
        rejectedToolCall: null,
      })
    })

    it("returns existing session for known instanceId", () => {
      const message = createTestMessage()
      useChatMessagesStore.getState().setMessages("test", [message])

      const session = useChatMessagesStore.getState().getSession("test")

      expect(session.messages).toHaveLength(1)
      expect(session.messages[0]).toEqual(message)
    })
  })

  describe("setMessages", () => {
    it("sets messages for a session", () => {
      const messages = [createTestMessage(), createTestMessage({ role: "assistant" })]

      act(() => {
        useChatMessagesStore.getState().setMessages("test", messages)
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session.messages).toEqual(messages)
    })

    it("replaces existing messages", () => {
      const oldMessages = [createTestMessage({ content: "old" })]
      const newMessages = [createTestMessage({ content: "new" })]

      act(() => {
        useChatMessagesStore.getState().setMessages("test", oldMessages)
        useChatMessagesStore.getState().setMessages("test", newMessages)
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session.messages).toEqual(newMessages)
    })

    it("syncs messages across sessions with same conversationId", () => {
      const conversationId = "conv-123"
      const messages = [createTestMessage()]

      // Set up two sessions with the same conversationId
      act(() => {
        useChatMessagesStore.getState().setConversationId("page", conversationId)
        useChatMessagesStore.getState().setConversationId("panel", conversationId)
        useChatMessagesStore.getState().setMessages("page", messages)
      })

      const pageSession = useChatMessagesStore.getState().sessions["page"]
      const panelSession = useChatMessagesStore.getState().sessions["panel"]

      expect(pageSession.messages).toEqual(messages)
      expect(panelSession.messages).toEqual(messages)
    })

    it("does not sync messages to sessions with different conversationId", () => {
      const messages = [createTestMessage()]

      // Set up two sessions with different conversationIds
      act(() => {
        useChatMessagesStore.getState().setConversationId("page", "conv-123")
        useChatMessagesStore.getState().setConversationId("panel", "conv-456")
        useChatMessagesStore.getState().setMessages("page", messages)
      })

      const pageSession = useChatMessagesStore.getState().sessions["page"]
      const panelSession = useChatMessagesStore.getState().sessions["panel"]

      expect(pageSession.messages).toEqual(messages)
      expect(panelSession.messages).toEqual([])
    })
  })

  describe("updateMessage", () => {
    it("updates a specific message by id", () => {
      const message = createTestMessage({ content: "original" })

      act(() => {
        useChatMessagesStore.getState().setMessages("test", [message])
        useChatMessagesStore.getState().updateMessage("test", message.id, {
          content: "updated",
        })
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session.messages[0].content).toBe("updated")
    })

    it("preserves other message fields when updating", () => {
      const message = createTestMessage({
        content: "original",
        role: "assistant",
        isStreaming: true,
      })

      act(() => {
        useChatMessagesStore.getState().setMessages("test", [message])
        useChatMessagesStore.getState().updateMessage("test", message.id, {
          isStreaming: false,
        })
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session.messages[0].content).toBe("original")
      expect(session.messages[0].role).toBe("assistant")
      expect(session.messages[0].isStreaming).toBe(false)
    })

    it("does not modify other messages", () => {
      const message1 = createTestMessage({ content: "first" })
      const message2 = createTestMessage({ content: "second" })

      act(() => {
        useChatMessagesStore.getState().setMessages("test", [message1, message2])
        useChatMessagesStore.getState().updateMessage("test", message1.id, {
          content: "updated",
        })
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session.messages[0].content).toBe("updated")
      expect(session.messages[1].content).toBe("second")
    })
  })

  describe("addMessages", () => {
    it("appends messages to existing messages", () => {
      const message1 = createTestMessage({ content: "first" })
      const message2 = createTestMessage({ content: "second" })

      act(() => {
        useChatMessagesStore.getState().setMessages("test", [message1])
        useChatMessagesStore.getState().addMessages("test", [message2])
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session.messages).toHaveLength(2)
      expect(session.messages[0].content).toBe("first")
      expect(session.messages[1].content).toBe("second")
    })

    it("works on empty session", () => {
      const message = createTestMessage()

      act(() => {
        useChatMessagesStore.getState().addMessages("test", [message])
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session.messages).toHaveLength(1)
    })
  })

  describe("removeMessage", () => {
    it("removes a message by id", () => {
      const message1 = createTestMessage({ content: "first" })
      const message2 = createTestMessage({ content: "second" })

      act(() => {
        useChatMessagesStore.getState().setMessages("test", [message1, message2])
        useChatMessagesStore.getState().removeMessage("test", message1.id)
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session.messages).toHaveLength(1)
      expect(session.messages[0].id).toBe(message2.id)
    })

    it("handles removing non-existent message gracefully", () => {
      const message = createTestMessage()

      act(() => {
        useChatMessagesStore.getState().setMessages("test", [message])
        useChatMessagesStore.getState().removeMessage("test", "non-existent-id")
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session.messages).toHaveLength(1)
    })
  })

  describe("setIsStreaming", () => {
    it("sets streaming state for a session", () => {
      act(() => {
        useChatMessagesStore.getState().setIsStreaming("test", true)
      })

      expect(useChatMessagesStore.getState().sessions["test"].isStreaming).toBe(true)

      act(() => {
        useChatMessagesStore.getState().setIsStreaming("test", false)
      })

      expect(useChatMessagesStore.getState().sessions["test"].isStreaming).toBe(false)
    })

    it("syncs streaming state across sessions with same conversationId", () => {
      const conversationId = "conv-123"

      act(() => {
        useChatMessagesStore.getState().setConversationId("page", conversationId)
        useChatMessagesStore.getState().setConversationId("panel", conversationId)
        useChatMessagesStore.getState().setIsStreaming("page", true)
      })

      expect(useChatMessagesStore.getState().sessions["page"].isStreaming).toBe(true)
      expect(useChatMessagesStore.getState().sessions["panel"].isStreaming).toBe(true)
    })
  })

  describe("setError", () => {
    it("sets error state for a session", () => {
      const error = new Error("Test error")

      act(() => {
        useChatMessagesStore.getState().setError("test", error)
      })

      expect(useChatMessagesStore.getState().sessions["test"].error).toBe(error)
    })

    it("clears error when set to null", () => {
      const error = new Error("Test error")

      act(() => {
        useChatMessagesStore.getState().setError("test", error)
        useChatMessagesStore.getState().setError("test", null)
      })

      expect(useChatMessagesStore.getState().sessions["test"].error).toBeNull()
    })
  })

  describe("setConversationId", () => {
    it("sets conversation id for a session", () => {
      act(() => {
        useChatMessagesStore.getState().setConversationId("test", "conv-123")
      })

      expect(useChatMessagesStore.getState().sessions["test"].conversationId).toBe(
        "conv-123"
      )
    })

    it("can clear conversation id", () => {
      act(() => {
        useChatMessagesStore.getState().setConversationId("test", "conv-123")
        useChatMessagesStore.getState().setConversationId("test", null)
      })

      expect(useChatMessagesStore.getState().sessions["test"].conversationId).toBeNull()
    })
  })

  describe("setPendingToolApproval", () => {
    it("sets pending tool approval", () => {
      const approval: PendingToolApproval = {
        tool_name: "search_documents",
        tool_args: { query: "test" },
        tool_call_id: "call-123",
        tool_description: "Search for documents",
      }

      act(() => {
        useChatMessagesStore.getState().setPendingToolApproval("test", approval)
      })

      expect(
        useChatMessagesStore.getState().sessions["test"].pendingToolApproval
      ).toEqual(approval)
    })

    it("clears pending tool approval", () => {
      const approval: PendingToolApproval = {
        tool_name: "search_documents",
        tool_args: { query: "test" },
        tool_call_id: "call-123",
        tool_description: "Search for documents",
      }

      act(() => {
        useChatMessagesStore.getState().setPendingToolApproval("test", approval)
        useChatMessagesStore.getState().setPendingToolApproval("test", null)
      })

      expect(
        useChatMessagesStore.getState().sessions["test"].pendingToolApproval
      ).toBeNull()
    })
  })

  describe("setRejectedToolCall", () => {
    it("sets rejected tool call", () => {
      const rejected: RejectedToolCall = {
        tool_name: "search_documents",
        tool_args: { query: "test" },
        tool_call_id: "call-123",
        tool_description: "Search for documents",
        rejectedAt: Date.now(),
      }

      act(() => {
        useChatMessagesStore.getState().setRejectedToolCall("test", rejected)
      })

      expect(
        useChatMessagesStore.getState().sessions["test"].rejectedToolCall
      ).toEqual(rejected)
    })

    it("clears rejected tool call", () => {
      const rejected: RejectedToolCall = {
        tool_name: "search_documents",
        tool_args: { query: "test" },
        tool_call_id: "call-123",
        tool_description: "Search for documents",
        rejectedAt: Date.now(),
      }

      act(() => {
        useChatMessagesStore.getState().setRejectedToolCall("test", rejected)
        useChatMessagesStore.getState().setRejectedToolCall("test", null)
      })

      expect(
        useChatMessagesStore.getState().sessions["test"].rejectedToolCall
      ).toBeNull()
    })
  })

  describe("clearSession", () => {
    it("resets session to default state", () => {
      const message = createTestMessage()
      const approval: PendingToolApproval = {
        tool_name: "test",
        tool_args: {},
        tool_call_id: "call-123",
        tool_description: "Test",
      }

      act(() => {
        useChatMessagesStore.getState().setMessages("test", [message])
        useChatMessagesStore.getState().setConversationId("test", "conv-123")
        useChatMessagesStore.getState().setIsStreaming("test", true)
        useChatMessagesStore.getState().setError("test", new Error("test"))
        useChatMessagesStore.getState().setPendingToolApproval("test", approval)
        useChatMessagesStore.getState().clearSession("test")
      })

      const session = useChatMessagesStore.getState().sessions["test"]
      expect(session).toEqual({
        messages: [],
        isStreaming: false,
        error: null,
        conversationId: null,
        pendingToolApproval: null,
        rejectedToolCall: null,
      })
    })
  })

  describe("syncConversation", () => {
    it("syncs messages to all sessions with matching conversationId", () => {
      const conversationId = "conv-123"
      const messages = [createTestMessage(), createTestMessage({ role: "assistant" })]

      act(() => {
        // Set up multiple sessions
        useChatMessagesStore.getState().setConversationId("page", conversationId)
        useChatMessagesStore.getState().setConversationId("panel", conversationId)
        useChatMessagesStore.getState().setConversationId("other", "conv-456")

        // Sync messages to conversationId
        useChatMessagesStore.getState().syncConversation(conversationId, messages)
      })

      expect(useChatMessagesStore.getState().sessions["page"].messages).toEqual(
        messages
      )
      expect(useChatMessagesStore.getState().sessions["panel"].messages).toEqual(
        messages
      )
      expect(useChatMessagesStore.getState().sessions["other"].messages).toEqual([])
    })
  })

  describe("multi-instance isolation", () => {
    it("isolates sessions with different instanceIds", () => {
      const message1 = createTestMessage({ content: "page message" })
      const message2 = createTestMessage({ content: "panel message" })

      act(() => {
        useChatMessagesStore.getState().setMessages("page", [message1])
        useChatMessagesStore.getState().setMessages("panel", [message2])
      })

      expect(useChatMessagesStore.getState().sessions["page"].messages[0].content).toBe(
        "page message"
      )
      expect(useChatMessagesStore.getState().sessions["panel"].messages[0].content).toBe(
        "panel message"
      )
    })
  })
})

describe("useChatPageStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatPageStore.setState({
      selectedConversationId: null,
      currentTitle: null,
      searchQuery: "",
      editingId: null,
      editingTitle: "",
    })
  })

  describe("setSelectedConversation", () => {
    it("sets selected conversation id and title", () => {
      act(() => {
        useChatPageStore.getState().setSelectedConversation("conv-123", "Test Title")
      })

      expect(useChatPageStore.getState().selectedConversationId).toBe("conv-123")
      expect(useChatPageStore.getState().currentTitle).toBe("Test Title")
    })

    it("can set null values", () => {
      act(() => {
        useChatPageStore.getState().setSelectedConversation("conv-123", "Test Title")
        useChatPageStore.getState().setSelectedConversation(null, null)
      })

      expect(useChatPageStore.getState().selectedConversationId).toBeNull()
      expect(useChatPageStore.getState().currentTitle).toBeNull()
    })
  })

  describe("setCurrentTitle", () => {
    it("updates only the title", () => {
      act(() => {
        useChatPageStore.getState().setSelectedConversation("conv-123", "Original")
        useChatPageStore.getState().setCurrentTitle("Updated")
      })

      expect(useChatPageStore.getState().selectedConversationId).toBe("conv-123")
      expect(useChatPageStore.getState().currentTitle).toBe("Updated")
    })
  })

  describe("setSearchQuery", () => {
    it("sets search query", () => {
      act(() => {
        useChatPageStore.getState().setSearchQuery("test query")
      })

      expect(useChatPageStore.getState().searchQuery).toBe("test query")
    })
  })

  describe("editing state", () => {
    it("startEditing sets editingId and editingTitle", () => {
      act(() => {
        useChatPageStore.getState().startEditing("conv-123", "Original Title")
      })

      expect(useChatPageStore.getState().editingId).toBe("conv-123")
      expect(useChatPageStore.getState().editingTitle).toBe("Original Title")
    })

    it("setEditingTitle updates only the editing title", () => {
      act(() => {
        useChatPageStore.getState().startEditing("conv-123", "Original")
        useChatPageStore.getState().setEditingTitle("Modified")
      })

      expect(useChatPageStore.getState().editingId).toBe("conv-123")
      expect(useChatPageStore.getState().editingTitle).toBe("Modified")
    })

    it("cancelEditing clears editing state", () => {
      act(() => {
        useChatPageStore.getState().startEditing("conv-123", "Title")
        useChatPageStore.getState().cancelEditing()
      })

      expect(useChatPageStore.getState().editingId).toBeNull()
      expect(useChatPageStore.getState().editingTitle).toBe("")
    })
  })

  describe("clearSelection", () => {
    it("clears selected conversation and title", () => {
      act(() => {
        useChatPageStore.getState().setSelectedConversation("conv-123", "Title")
        useChatPageStore.getState().clearSelection()
      })

      expect(useChatPageStore.getState().selectedConversationId).toBeNull()
      expect(useChatPageStore.getState().currentTitle).toBeNull()
    })
  })
})
