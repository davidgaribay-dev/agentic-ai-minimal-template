/**
 * MSW Request Handlers
 *
 * Defines mock API handlers for testing. These handlers intercept
 * fetch requests and return mock responses.
 *
 * Uses wildcard pattern (*) to match both:
 * - Relative URLs: /api/v1/...
 * - Absolute URLs: http://localhost:8000/v1/...
 */

import { http, HttpResponse, delay } from "msw"

// Default mock data
export const mockUser = {
  id: "user-123",
  email: "test@example.com",
  full_name: "Test User",
  is_active: true,
  is_platform_admin: false,
  profile_image_url: null,
  language: "en",
}

export const mockOrganization = {
  id: "org-123",
  name: "Test Organization",
  slug: "test-org",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
}

export const mockTeam = {
  id: "team-123",
  name: "Test Team",
  organization_id: "org-123",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
}

export const mockConversation = {
  id: "conv-123",
  title: "Test Conversation",
  organization_id: "org-123",
  team_id: "team-123",
  user_id: "user-123",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
}

export const mockToken = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  token_type: "bearer",
  expires_in: 1800,
}

// Default handlers - use wildcard (*) to match any base URL
export const handlers = [
  // Auth endpoints
  http.post("*/v1/auth/login", async () => {
    await delay(10)
    return HttpResponse.json(mockToken)
  }),

  http.post("*/v1/auth/logout", async () => {
    await delay(10)
    return HttpResponse.json({ message: "Logged out successfully" })
  }),

  http.post("*/v1/auth/refresh", async () => {
    await delay(10)
    return HttpResponse.json(mockToken)
  }),

  http.get("*/v1/auth/me", async () => {
    await delay(10)
    return HttpResponse.json(mockUser)
  }),

  http.patch("*/v1/auth/me", async ({ request }) => {
    await delay(10)
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...mockUser, ...body })
  }),

  // Agent/Chat endpoints
  http.get("*/v1/agent/health", async () => {
    await delay(10)
    return HttpResponse.json({
      status: "healthy",
      llm_configured: true,
    })
  }),

  http.get("*/v1/agent/conversations/:conversationId/history", async () => {
    await delay(10)
    return HttpResponse.json([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ])
  }),

  http.get(
    "*/v1/agent/conversations/:conversationId/pending-approval",
    async () => {
      await delay(10)
      return HttpResponse.json(null)
    }
  ),

  http.patch(
    "*/v1/agent/conversations/:conversationId/title",
    async ({ request }) => {
      await delay(10)
      const url = new URL(request.url)
      const title = url.searchParams.get("title") || "Updated Title"
      return HttpResponse.json({ success: true, title })
    }
  ),

  // Organizations endpoints
  http.get("*/v1/organizations", async () => {
    await delay(10)
    return HttpResponse.json({ data: [mockOrganization], count: 1 })
  }),

  http.get("*/v1/organizations/:orgId", async () => {
    await delay(10)
    return HttpResponse.json(mockOrganization)
  }),

  // Teams endpoints
  http.get("*/v1/organizations/:orgId/teams", async () => {
    await delay(10)
    return HttpResponse.json({ data: [mockTeam], count: 1 })
  }),

  http.get("*/v1/organizations/:orgId/teams/:teamId", async () => {
    await delay(10)
    return HttpResponse.json(mockTeam)
  }),

  // Conversations endpoints
  http.get("*/v1/conversations", async () => {
    await delay(10)
    return HttpResponse.json({ data: [mockConversation], count: 1 })
  }),

  // Media endpoints
  http.post("*/v1/media/upload", async () => {
    await delay(50)
    return HttpResponse.json({
      id: `media-${Date.now()}`,
      filename: "test-image.jpg",
      mime_type: "image/jpeg",
      url: "/api/media/test-image.jpg",
      size: 1024,
    })
  }),

  // Documents endpoints
  http.post("*/v1/documents", async () => {
    await delay(50)
    return HttpResponse.json({
      id: `doc-${Date.now()}`,
      filename: "test-document.pdf",
      mime_type: "application/pdf",
      status: "completed",
    })
  }),
]

/**
 * Create a mock SSE response for chat streaming tests.
 * This is used to simulate streaming responses from the chat API.
 */
export function createMockSSEResponse(events: Array<{ event?: string; data: unknown }>) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const { event, data } of events) {
        if (event) {
          controller.enqueue(encoder.encode(`event: ${event}\n`))
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

/**
 * Create SSE events for a simple chat response.
 */
export function createChatStreamEvents(
  content: string,
  conversationId: string = "conv-123"
) {
  const tokens = content.split(" ")
  const events: Array<{ event?: string; data: unknown }> = []

  // Token events
  for (const token of tokens) {
    events.push({ data: { token: token + " " } })
  }

  // Title event
  events.push({
    event: "title",
    data: { title: "Generated Title", conversation_id: conversationId },
  })

  // Done event
  events.push({
    event: "done",
    data: { conversation_id: conversationId },
  })

  return events
}

/**
 * Create SSE events for a tool approval flow.
 */
export function createToolApprovalEvents(
  tool: {
    name: string
    args: Record<string, unknown>
    description?: string
  },
  conversationId: string = "conv-123"
) {
  return [
    { data: { token: "I'll use a tool... " } },
    {
      event: "tool_approval",
      data: {
        conversation_id: conversationId,
        tool_name: tool.name,
        tool_args: tool.args,
        tool_call_id: `tool-call-${Date.now()}`,
        tool_description: tool.description || `Execute ${tool.name}`,
      },
    },
  ]
}

/**
 * Create SSE events for a guardrail block.
 */
export function createGuardrailBlockEvents(
  message: string,
  conversationId: string = "conv-123"
) {
  return [
    {
      event: "guardrail_block",
      data: {
        message,
        conversation_id: conversationId,
      },
    },
  ]
}

/**
 * Create SSE events with sources (RAG citations).
 */
export function createSourcesEvents(
  sources: Array<{
    content: string
    source: string
    file_type?: string
    relevance_score?: number
  }>,
  conversationId: string = "conv-123"
) {
  return [
    {
      event: "sources",
      data: {
        conversation_id: conversationId,
        sources: sources.map((s, i) => ({
          content: s.content,
          source: s.source,
          file_type: s.file_type || "md",
          metadata: null,
          relevance_score: s.relevance_score || 0.9,
          chunk_index: i,
          document_id: `doc-${i}`,
        })),
      },
    },
  ]
}

// =============================================================================
// ERROR HANDLERS
// =============================================================================

/**
 * Error handler factories for testing error scenarios.
 * Use these with server.use() to override default handlers in specific tests.
 *
 * @example
 * ```ts
 * import { server } from "@/test/mocks/server"
 * import { errorHandlers } from "@/test/mocks/handlers"
 *
 * it("handles login failure", async () => {
 *   server.use(errorHandlers.auth401())
 *   // ... test code
 * })
 * ```
 */
export const errorHandlers = {
  /**
   * 401 Unauthorized - Invalid credentials or expired token
   */
  auth401: () =>
    http.post("*/v1/auth/login", async () => {
      await delay(10)
      return HttpResponse.json(
        { detail: "Invalid email or password" },
        { status: 401 }
      )
    }),

  /**
   * 401 Unauthorized - Token expired
   */
  tokenExpired401: () =>
    http.get("*/v1/auth/me", async () => {
      await delay(10)
      return HttpResponse.json(
        { detail: "Token has expired" },
        { status: 401 }
      )
    }),

  /**
   * 403 Forbidden - Insufficient permissions
   */
  forbidden403: (path = "*/v1/organizations/:orgId") =>
    http.get(path, async () => {
      await delay(10)
      return HttpResponse.json(
        { detail: "You don't have permission to access this resource" },
        { status: 403 }
      )
    }),

  /**
   * 404 Not Found - Resource doesn't exist
   */
  notFound404: (path = "*/v1/conversations/:id") =>
    http.get(path, async () => {
      await delay(10)
      return HttpResponse.json(
        { detail: "Resource not found" },
        { status: 404 }
      )
    }),

  /**
   * 422 Validation Error - Pydantic validation failure (FastAPI format)
   */
  validation422: () =>
    http.post("*/v1/auth/signup", async () => {
      await delay(10)
      return HttpResponse.json(
        {
          detail: [
            {
              type: "value_error",
              loc: ["body", "email"],
              msg: "Invalid email format",
              input: "invalid-email",
            },
            {
              type: "value_error",
              loc: ["body", "password"],
              msg: "Password must be at least 8 characters",
              input: "short",
            },
          ],
        },
        { status: 422 }
      )
    }),

  /**
   * 429 Rate Limited - Too many requests
   */
  rateLimited429: (path = "*/v1/agent/chat") =>
    http.post(path, async () => {
      await delay(10)
      return HttpResponse.json(
        {
          detail: "Rate limit exceeded. Please try again in 60 seconds.",
        },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }),

  /**
   * 500 Internal Server Error - Generic server error
   */
  serverError500: (path = "*/v1/agent/chat") =>
    http.post(path, async () => {
      await delay(10)
      return HttpResponse.json(
        { detail: "Internal server error" },
        { status: 500 }
      )
    }),

  /**
   * 503 Service Unavailable - Service temporarily down
   */
  serviceUnavailable503: (path = "*/v1/agent/health") =>
    http.get(path, async () => {
      await delay(10)
      return HttpResponse.json(
        { detail: "Service temporarily unavailable" },
        { status: 503 }
      )
    }),

  /**
   * Network error - Simulates connection failure
   */
  networkError: (path = "*/v1/agent/chat") =>
    http.post(path, () => {
      return HttpResponse.error()
    }),

  /**
   * Slow response - Simulates slow network
   */
  slowResponse: (path = "*/v1/auth/login", delayMs = 5000) =>
    http.post(path, async () => {
      await delay(delayMs)
      return HttpResponse.json(mockToken)
    }),

  /**
   * Chat error event - Returns error via SSE
   */
  chatError: (errorMessage = "LLM provider error") =>
    http.post("*/v1/agent/chat", async () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`event: error\n`))
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
          )
          controller.close()
        },
      })
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }),
}

/**
 * Helper to create a custom error handler with specific status and message.
 */
export function createErrorHandler(
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  status: number,
  detail: string | object
) {
  const httpMethod = http[method]
  return httpMethod(path, async () => {
    await delay(10)
    return HttpResponse.json(
      typeof detail === "string" ? { detail } : detail,
      { status }
    )
  })
}
