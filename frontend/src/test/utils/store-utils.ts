/**
 * Zustand Store Utilities for Testing
 *
 * Provides utilities for resetting and initializing Zustand stores
 * in tests to ensure isolation between test cases.
 */

import { useChatMessagesStore, useChatPageStore } from "@/lib/chat-store";
import { useUIStore } from "@/lib/ui-store";
import type {
  ChatMessage,
  PendingToolApproval,
  RejectedToolCall,
} from "@/lib/chat-store";

/**
 * Reset all Zustand stores to their initial state.
 * Call this in afterEach to ensure test isolation.
 */
export function resetAllStores(): void {
  // Reset chat messages store
  useChatMessagesStore.setState({ sessions: {} });

  // Reset chat page store
  useChatPageStore.setState({
    selectedConversationId: null,
    currentTitle: null,
    searchQuery: "",
    editingId: null,
    editingTitle: "",
  });

  // Reset UI store (if it has a reset method)
  try {
    useUIStore.setState({
      sidebarOpen: true,
      sidePanelOpen: false,
      sidePanelWidth: 400,
    });
  } catch {
    // UI store may not be available in all tests
  }
}

/**
 * Create a mock chat session with pre-populated data.
 */
export function createMockChatSession(
  options: {
    instanceId?: string;
    messages?: ChatMessage[];
    conversationId?: string | null;
    isStreaming?: boolean;
    error?: Error | null;
    pendingToolApproval?: PendingToolApproval | null;
    rejectedToolCall?: RejectedToolCall | null;
  } = {},
) {
  const {
    instanceId = "test",
    messages = [],
    conversationId = null,
    isStreaming = false,
    error = null,
    pendingToolApproval = null,
    rejectedToolCall = null,
  } = options;

  useChatMessagesStore.setState((state) => ({
    sessions: {
      ...state.sessions,
      [instanceId]: {
        messages,
        conversationId,
        isStreaming,
        error,
        pendingToolApproval,
        rejectedToolCall,
      },
    },
  }));

  return useChatMessagesStore.getState().sessions[instanceId];
}

/**
 * Create a mock chat message.
 */
export function createMockMessage(
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: "user",
    content: "Test message",
    isStreaming: false,
    ...overrides,
  };
}

/**
 * Create a mock pending tool approval.
 */
export function createMockToolApproval(
  overrides: Partial<PendingToolApproval> = {},
): PendingToolApproval {
  return {
    tool_name: "test_tool",
    tool_args: { arg1: "value1" },
    tool_call_id: `tool-call-${Date.now()}`,
    tool_description: "A test tool for testing",
    ...overrides,
  };
}

/**
 * Create a mock rejected tool call.
 */
export function createMockRejectedToolCall(
  overrides: Partial<RejectedToolCall> = {},
): RejectedToolCall {
  return {
    tool_name: "test_tool",
    tool_args: { arg1: "value1" },
    tool_call_id: `tool-call-${Date.now()}`,
    tool_description: "A test tool for testing",
    rejectedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Set up chat page store with selection state.
 */
export function setupChatPageSelection(
  options: {
    conversationId?: string;
    title?: string;
  } = {},
) {
  const { conversationId = "conv-123", title = "Test Conversation" } = options;

  useChatPageStore.getState().setSelectedConversation(conversationId, title);
}
