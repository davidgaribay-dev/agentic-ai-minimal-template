/**
 * Test Data Factories
 *
 * Provides factory functions for creating consistent test data
 * across the test suite. Each factory creates valid mock data
 * with sensible defaults that can be overridden.
 */

import type { User, Token } from "@/lib/api/auth"
import type { ChatMessage, MessageSource, ChatMediaAttachment } from "@/lib/chat-store"

let idCounter = 0

/**
 * Generate a unique ID for test data.
 */
function generateId(prefix: string = "test"): string {
  idCounter++
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Reset the ID counter (useful in beforeEach).
 */
export function resetIdCounter(): void {
  idCounter = 0
}

/**
 * Create a mock user.
 */
export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: generateId("user"),
    email: "test@example.com",
    full_name: "Test User",
    is_active: true,
    is_platform_admin: false,
    profile_image_url: null,
    language: "en",
    ...overrides,
  }
}

/**
 * Create a mock organization.
 */
export function createOrganization(
  overrides: Partial<{
    id: string
    name: string
    slug: string
    created_at: string
    updated_at: string
  }> = {}
) {
  const id = overrides.id || generateId("org")
  return {
    id,
    name: "Test Organization",
    slug: "test-org",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

/**
 * Create a mock team.
 */
export function createTeam(
  overrides: Partial<{
    id: string
    name: string
    organization_id: string
    created_at: string
    updated_at: string
  }> = {}
) {
  return {
    id: generateId("team"),
    name: "Test Team",
    organization_id: "org-123",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

/**
 * Create a mock conversation.
 */
export function createConversation(
  overrides: Partial<{
    id: string
    title: string
    organization_id: string
    team_id: string
    user_id: string
    created_at: string
    updated_at: string
  }> = {}
) {
  return {
    id: generateId("conv"),
    title: "Test Conversation",
    organization_id: "org-123",
    team_id: "team-123",
    user_id: "user-123",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

/**
 * Create a mock chat message.
 */
export function createChatMessage(
  overrides: Partial<ChatMessage> = {}
): ChatMessage {
  return {
    id: generateId("msg"),
    role: "user",
    content: "Test message content",
    isStreaming: false,
    ...overrides,
  }
}

/**
 * Create a mock assistant message.
 */
export function createAssistantMessage(
  content: string = "Hello! How can I help you?",
  overrides: Partial<ChatMessage> = {}
): ChatMessage {
  return createChatMessage({
    role: "assistant",
    content,
    ...overrides,
  })
}

/**
 * Create a mock user message.
 */
export function createUserMessage(
  content: string = "Hello!",
  overrides: Partial<ChatMessage> = {}
): ChatMessage {
  return createChatMessage({
    role: "user",
    content,
    ...overrides,
  })
}

/**
 * Create a mock streaming message.
 */
export function createStreamingMessage(
  content: string = "",
  overrides: Partial<ChatMessage> = {}
): ChatMessage {
  return createChatMessage({
    role: "assistant",
    content,
    isStreaming: true,
    ...overrides,
  })
}

/**
 * Create mock message sources (RAG citations).
 */
export function createMessageSource(
  overrides: Partial<MessageSource> = {}
): MessageSource {
  return {
    content: "Relevant content from document",
    source: "document.md",
    file_type: "md",
    metadata: null,
    relevance_score: 0.95,
    chunk_index: 0,
    document_id: generateId("doc"),
    ...overrides,
  }
}

/**
 * Create mock media attachment.
 */
export function createMediaAttachment(
  overrides: Partial<ChatMediaAttachment> = {}
): ChatMediaAttachment {
  return {
    id: generateId("media"),
    url: "/api/media/test-image.jpg",
    filename: "test-image.jpg",
    mime_type: "image/jpeg",
    width: 800,
    height: 600,
    ...overrides,
  }
}

/**
 * Create a mock token response.
 */
export function createToken(overrides: Partial<Token> = {}): Token {
  return {
    access_token: `access-${generateId("token")}`,
    refresh_token: `refresh-${generateId("token")}`,
    token_type: "bearer",
    expires_in: 1800,
    ...overrides,
  }
}

/**
 * Create a mock pending tool approval.
 */
export function createPendingToolApproval(
  overrides: Partial<{
    tool_name: string
    tool_args: Record<string, unknown>
    tool_call_id: string | null
    tool_description: string
  }> = {}
) {
  return {
    tool_name: "search_documents",
    tool_args: { query: "test query" },
    tool_call_id: generateId("tool-call"),
    tool_description: "Search for relevant documents",
    ...overrides,
  }
}

/**
 * Create a mock rejected tool call.
 */
export function createRejectedToolCall(
  overrides: Partial<{
    tool_name: string
    tool_args: Record<string, unknown>
    tool_call_id: string | null
    tool_description: string
    rejectedAt: number
  }> = {}
) {
  return {
    tool_name: "search_documents",
    tool_args: { query: "test query" },
    tool_call_id: generateId("tool-call"),
    tool_description: "Search for relevant documents",
    rejectedAt: Date.now(),
    ...overrides,
  }
}

/**
 * Create a mock document.
 */
export function createDocument(
  overrides: Partial<{
    id: string
    filename: string
    mime_type: string
    status: string
    organization_id: string
    team_id: string
    user_id: string
    created_at: string
  }> = {}
) {
  return {
    id: generateId("doc"),
    filename: "test-document.pdf",
    mime_type: "application/pdf",
    status: "completed",
    organization_id: "org-123",
    team_id: "team-123",
    user_id: "user-123",
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

/**
 * Create a mock media upload.
 */
export function createMediaUpload(
  overrides: Partial<{
    id: string
    filename: string
    mime_type: string
    url: string
    size: number
  }> = {}
) {
  return {
    id: generateId("media"),
    filename: "test-image.jpg",
    mime_type: "image/jpeg",
    url: "/api/media/test-image.jpg",
    size: 1024 * 50, // 50KB
    ...overrides,
  }
}

/**
 * Create a conversation with messages.
 */
export function createConversationWithMessages(
  messageCount: number = 2,
  overrides: {
    conversation?: Parameters<typeof createConversation>[0]
    messages?: Partial<ChatMessage>[]
  } = {}
) {
  const conversation = createConversation(overrides.conversation)

  const messages: ChatMessage[] = []
  for (let i = 0; i < messageCount; i++) {
    const isUser = i % 2 === 0
    const messageOverride = overrides.messages?.[i] || {}
    messages.push(
      createChatMessage({
        role: isUser ? "user" : "assistant",
        content: isUser ? `User message ${i + 1}` : `Assistant response ${i + 1}`,
        ...messageOverride,
      })
    )
  }

  return { conversation, messages }
}
