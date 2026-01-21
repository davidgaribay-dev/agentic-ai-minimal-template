/**
 * SSE Testing Utilities
 *
 * Provides utilities for testing Server-Sent Events (SSE) streaming,
 * particularly for chat streaming functionality.
 */

import type { StreamEvent } from "@/lib/api/agent"

/**
 * Create a mock ReadableStream that emits SSE-formatted events.
 * Use this to mock fetch responses for streaming endpoints.
 */
export function createMockSSEStream(
  events: Array<{ event?: string; data: unknown }>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
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
}

/**
 * Create a mock Response object with SSE content.
 */
export function createMockSSEResponse(
  events: Array<{ event?: string; data: unknown }>,
  options: { status?: number; statusText?: string } = {}
): Response {
  const { status = 200, statusText = "OK" } = options

  return new Response(createMockSSEStream(events), {
    status,
    statusText,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

/**
 * Create a delayed SSE stream for testing streaming behavior.
 * Each event is emitted after the specified delay.
 */
export function createDelayedSSEStream(
  events: Array<{ event?: string; data: unknown; delay?: number }>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      for (const { event, data, delay: eventDelay = 0 } of events) {
        if (eventDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, eventDelay))
        }
        if (event) {
          controller.enqueue(encoder.encode(`event: ${event}\n`))
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      controller.close()
    },
  })
}

/**
 * Create SSE events for a simple token stream.
 */
export function createTokenEvents(
  content: string,
  options: { wordByWord?: boolean } = {}
): Array<{ data: unknown }> {
  const { wordByWord = true } = options

  if (wordByWord) {
    return content.split(" ").map((word, i, arr) => ({
      data: { token: word + (i < arr.length - 1 ? " " : "") },
    }))
  }

  // Character by character
  return content.split("").map((char) => ({
    data: { token: char },
  }))
}

/**
 * Create a complete chat stream with tokens, title, and done events.
 */
export function createCompleteChatStream(
  content: string,
  conversationId: string = "conv-123",
  title: string = "Generated Title"
): Array<{ event?: string; data: unknown }> {
  const events: Array<{ event?: string; data: unknown }> = []

  // Token events
  events.push(...createTokenEvents(content))

  // Title event
  events.push({
    event: "title",
    data: { title, conversation_id: conversationId },
  })

  // Done event
  events.push({
    event: "done",
    data: { conversation_id: conversationId },
  })

  return events
}

/**
 * Create a tool approval event.
 */
export function createToolApprovalEvent(options: {
  conversationId?: string
  toolName: string
  toolArgs?: Record<string, unknown>
  toolCallId?: string
  toolDescription?: string
}): { event: string; data: unknown } {
  const {
    conversationId = "conv-123",
    toolName,
    toolArgs = {},
    toolCallId = `tool-${Date.now()}`,
    toolDescription = `Execute ${toolName}`,
  } = options

  return {
    event: "tool_approval",
    data: {
      conversation_id: conversationId,
      tool_name: toolName,
      tool_args: toolArgs,
      tool_call_id: toolCallId,
      tool_description: toolDescription,
    },
  }
}

/**
 * Create a sources event (RAG citations).
 */
export function createSourcesEvent(
  sources: Array<{
    content: string
    source: string
    fileType?: string
    relevanceScore?: number
    documentId?: string
  }>,
  conversationId: string = "conv-123"
): { event: string; data: unknown } {
  return {
    event: "sources",
    data: {
      conversation_id: conversationId,
      sources: sources.map((s, i) => ({
        content: s.content,
        source: s.source,
        file_type: s.fileType || "md",
        metadata: null,
        relevance_score: s.relevanceScore || 0.9,
        chunk_index: i,
        document_id: s.documentId || `doc-${i}`,
      })),
    },
  }
}

/**
 * Create a guardrail block event.
 */
export function createGuardrailBlockEvent(
  message: string,
  conversationId: string = "conv-123"
): { event: string; data: unknown } {
  return {
    event: "guardrail_block",
    data: {
      message,
      conversation_id: conversationId,
    },
  }
}

/**
 * Create an error event.
 */
export function createErrorEvent(
  error: string
): { event: string; data: unknown } {
  return {
    event: "error",
    data: { error },
  }
}

/**
 * Collect all events from an async generator.
 * Useful for testing the chatStream generator function.
 */
export async function collectStreamEvents(
  generator: AsyncGenerator<StreamEvent>
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = []
  for await (const event of generator) {
    events.push(event)
  }
  return events
}

/**
 * Create a mock fetch function that returns an SSE response.
 */
export function createMockFetch(
  events: Array<{ event?: string; data: unknown }>,
  options: { status?: number; delay?: number } = {}
): typeof fetch {
  const { status = 200, delay: responseDelay = 0 } = options

  return async () => {
    if (responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, responseDelay))
    }
    return createMockSSEResponse(events, { status })
  }
}
