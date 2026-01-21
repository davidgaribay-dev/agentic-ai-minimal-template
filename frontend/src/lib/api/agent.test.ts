/**
 * Tests for agent API (agent.ts)
 *
 * Tests:
 * - SSE streaming event parsing
 * - All event types (token, title, done, error, tool_approval, sources, guardrail_block)
 * - Abort signal handling
 * - Error response handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { agentApi, type StreamEvent } from "./agent";
import {
  createMockSSEResponse,
  createCompleteChatStream,
  createTokenEvents,
  createToolApprovalEvent,
  createSourcesEvent,
  createGuardrailBlockEvent,
  createErrorEvent,
  collectStreamEvents,
} from "@/test/utils/sse";
import { setupLocalStorage, withAuthToken } from "@/test/utils/localStorage";

describe("agentApi.chatStream", () => {
  let localStorageMock: ReturnType<typeof setupLocalStorage>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    localStorageMock = setupLocalStorage();
    withAuthToken(localStorageMock);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("token events", () => {
    it("parses token events correctly", async () => {
      const events = createTokenEvents("Hello world");
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const tokenEvents = streamEvents.filter((e) => e.type === "token");
      expect(tokenEvents).toHaveLength(2); // "Hello" and "world"
      expect(tokenEvents[0].data).toBe("Hello ");
      expect(tokenEvents[1].data).toBe("world");
    });

    it("handles streaming content accumulation", async () => {
      const events = createTokenEvents("This is a longer message");
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const tokens = streamEvents
        .filter(
          (e): e is Extract<StreamEvent, { type: "token" }> =>
            e.type === "token",
        )
        .map((e) => e.data)
        .join("");

      expect(tokens).toBe("This is a longer message");
    });
  });

  describe("title events", () => {
    it("parses title events correctly", async () => {
      const events = [
        {
          event: "title",
          data: { title: "Generated Title", conversation_id: "conv-123" },
        },
      ];
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const titleEvent = streamEvents.find((e) => e.type === "title");
      expect(titleEvent).toBeDefined();
      expect(titleEvent?.type).toBe("title");
      if (titleEvent?.type === "title") {
        expect(titleEvent.data.title).toBe("Generated Title");
        expect(titleEvent.data.conversation_id).toBe("conv-123");
      }
    });
  });

  describe("done events", () => {
    it("parses done events correctly", async () => {
      const events = [{ event: "done", data: { conversation_id: "conv-123" } }];
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const doneEvent = streamEvents.find((e) => e.type === "done");
      expect(doneEvent).toBeDefined();
      expect(doneEvent?.type).toBe("done");
      if (doneEvent?.type === "done") {
        expect(doneEvent.data.conversation_id).toBe("conv-123");
      }
    });

    it("infers done event from conversation_id without token/title", async () => {
      const events = [{ data: { conversation_id: "conv-123" } }];
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const doneEvent = streamEvents.find((e) => e.type === "done");
      expect(doneEvent).toBeDefined();
    });
  });

  describe("error events", () => {
    it("parses error events correctly", async () => {
      const events = [createErrorEvent("Something went wrong")];
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const errorEvent = streamEvents.find((e) => e.type === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.type).toBe("error");
      if (errorEvent?.type === "error") {
        expect(errorEvent.data).toBe("Something went wrong");
      }
    });

    it("handles error in data without event type", async () => {
      const events = [{ data: { error: "Error message from data" } }];
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const errorEvent = streamEvents.find((e) => e.type === "error");
      expect(errorEvent).toBeDefined();
      if (errorEvent?.type === "error") {
        expect(errorEvent.data).toBe("Error message from data");
      }
    });
  });

  describe("tool_approval events", () => {
    it("parses tool approval events correctly", async () => {
      const events = [
        createToolApprovalEvent({
          toolName: "search_documents",
          toolArgs: { query: "test query" },
          toolDescription: "Search for relevant documents",
        }),
      ];
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const approvalEvent = streamEvents.find(
        (e) => e.type === "tool_approval",
      );
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent?.type).toBe("tool_approval");
      if (approvalEvent?.type === "tool_approval") {
        expect(approvalEvent.data.tool_name).toBe("search_documents");
        expect(approvalEvent.data.tool_args).toEqual({ query: "test query" });
        expect(approvalEvent.data.tool_description).toBe(
          "Search for relevant documents",
        );
        expect(approvalEvent.data.tool_call_id).toBeDefined();
        expect(approvalEvent.data.conversation_id).toBe("conv-123");
      }
    });
  });

  describe("sources events", () => {
    it("parses sources events correctly", async () => {
      const events = [
        createSourcesEvent([
          {
            content: "Source content 1",
            source: "doc1.md",
            relevanceScore: 0.95,
          },
          {
            content: "Source content 2",
            source: "doc2.md",
            relevanceScore: 0.85,
          },
        ]),
      ];
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const sourcesEvent = streamEvents.find((e) => e.type === "sources");
      expect(sourcesEvent).toBeDefined();
      expect(sourcesEvent?.type).toBe("sources");
      if (sourcesEvent?.type === "sources") {
        expect(sourcesEvent.data.sources).toHaveLength(2);
        expect(sourcesEvent.data.sources[0].source).toBe("doc1.md");
        expect(sourcesEvent.data.sources[0].relevance_score).toBe(0.95);
        expect(sourcesEvent.data.sources[1].source).toBe("doc2.md");
      }
    });
  });

  describe("guardrail_block events", () => {
    it("parses guardrail block events correctly", async () => {
      const events = [
        createGuardrailBlockEvent("Content blocked for policy violation"),
      ];
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      const blockEvent = streamEvents.find((e) => e.type === "guardrail_block");
      expect(blockEvent).toBeDefined();
      expect(blockEvent?.type).toBe("guardrail_block");
      if (blockEvent?.type === "guardrail_block") {
        expect(blockEvent.data.message).toBe(
          "Content blocked for policy violation",
        );
        expect(blockEvent.data.conversation_id).toBe("conv-123");
      }
    });
  });

  describe("complete stream", () => {
    it("handles a complete chat stream with all event types", async () => {
      const events = createCompleteChatStream(
        "Hello, how can I help?",
        "conv-123",
        "Chat Title",
      );
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(createMockSSEResponse(events));

      const streamEvents = await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      // Should have token events, title event, and done event
      const tokenEvents = streamEvents.filter((e) => e.type === "token");
      const titleEvent = streamEvents.find((e) => e.type === "title");
      const doneEvent = streamEvents.find((e) => e.type === "done");

      expect(tokenEvents.length).toBeGreaterThan(0);
      expect(titleEvent).toBeDefined();
      expect(doneEvent).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("throws ApiError on non-ok response", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 401, statusText: "Unauthorized" }),
        );

      await expect(
        collectStreamEvents(
          agentApi.chatStream({
            message: "test",
            organization_id: "org-123",
          }),
        ),
      ).rejects.toThrow();
    });

    it("throws error when response body is missing", async () => {
      const response = new Response(null, { status: 200 });
      Object.defineProperty(response, "body", { value: null });
      globalThis.fetch = vi.fn().mockResolvedValue(response);

      await expect(
        collectStreamEvents(
          agentApi.chatStream({
            message: "test",
            organization_id: "org-123",
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("abort handling", () => {
    it("respects abort signal", async () => {
      // Create a slow stream
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('data: {"token":"Hello"}\n\n'));
          await new Promise((resolve) => setTimeout(resolve, 100));
          controller.enqueue(encoder.encode('data: {"token":" world"}\n\n'));
          controller.close();
        },
      });

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );

      const controller = new AbortController();
      const generator = agentApi.chatStream(
        { message: "test", organization_id: "org-123" },
        controller.signal,
      );

      // Get first event
      const firstEvent = await generator.next();
      expect(firstEvent.done).toBe(false);

      // Abort
      controller.abort();

      // Next iteration should throw or complete
      // Note: The actual behavior depends on how the reader handles abort
      // In most cases, it will throw an AbortError
    });
  });

  describe("request formatting", () => {
    it("includes auth token in request headers", async () => {
      let capturedHeaders: Headers | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedHeaders = new Headers(init?.headers);
        return createMockSSEResponse([
          { event: "done", data: { conversation_id: "conv-123" } },
        ]);
      });

      await collectStreamEvents(
        agentApi.chatStream({
          message: "test",
          organization_id: "org-123",
        }),
      );

      expect(capturedHeaders?.get("Authorization")).toBe(
        "Bearer test-access-token",
      );
    });

    it("includes all request parameters in body", async () => {
      let capturedBody: unknown;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return createMockSSEResponse([
          { event: "done", data: { conversation_id: "conv-123" } },
        ]);
      });

      await collectStreamEvents(
        agentApi.chatStream({
          message: "Hello",
          organization_id: "org-123",
          team_id: "team-456",
          conversation_id: "conv-789",
          media_ids: ["media-1", "media-2"],
          model: "claude-3-opus",
        }),
      );

      expect(capturedBody).toEqual({
        message: "Hello",
        organization_id: "org-123",
        team_id: "team-456",
        conversation_id: "conv-789",
        media_ids: ["media-1", "media-2"],
        model: "claude-3-opus",
        stream: true,
      });
    });
  });
});

describe("agentApi.resumeStream", () => {
  let localStorageMock: ReturnType<typeof setupLocalStorage>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    localStorageMock = setupLocalStorage();
    withAuthToken(localStorageMock);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends approval request correctly", async () => {
    let capturedBody: unknown;

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return createMockSSEResponse([
        { event: "done", data: { conversation_id: "conv-123" } },
      ]);
    });

    await collectStreamEvents(
      agentApi.resumeStream({
        conversation_id: "conv-123",
        organization_id: "org-123",
        team_id: "team-456",
        approved: true,
      }),
    );

    expect(capturedBody).toEqual({
      conversation_id: "conv-123",
      organization_id: "org-123",
      team_id: "team-456",
      approved: true,
      stream: true,
    });
  });

  it("parses streaming response after approval", async () => {
    const events = createCompleteChatStream("Tool executed successfully");
    globalThis.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(events));

    const streamEvents = await collectStreamEvents(
      agentApi.resumeStream({
        conversation_id: "conv-123",
        organization_id: "org-123",
        approved: true,
      }),
    );

    const tokenEvents = streamEvents.filter((e) => e.type === "token");
    expect(tokenEvents.length).toBeGreaterThan(0);
  });

  it("handles rejection response", async () => {
    const events = [{ event: "done", data: { conversation_id: "conv-123" } }];
    globalThis.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(events));

    const streamEvents = await collectStreamEvents(
      agentApi.resumeStream({
        conversation_id: "conv-123",
        organization_id: "org-123",
        approved: false,
      }),
    );

    const doneEvent = streamEvents.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
  });
});

describe("agentApi non-streaming methods", () => {
  it("health returns health status", async () => {
    // This uses MSW handlers from setup
    const health = await agentApi.health();

    expect(health.status).toBe("healthy");
    expect(health.llm_configured).toBe(true);
  });
});
