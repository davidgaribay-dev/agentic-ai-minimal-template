import { apiTest as test, expect } from "../../../fixtures";
import {
  expectSuccessResponse,
  deleteResource,
} from "../../../utils/api-helpers";
import { logTestData, logger } from "../../../utils/logger";
import type {
  ListResponse,
  Organization,
  Team,
  Conversation,
} from "../../../utils";

/**
 * Conversations API Tests
 *
 * Tests for /v1/conversations endpoints
 * - CRUD operations for chat conversations
 * - Search functionality
 * - Star/unstar conversations
 */

test.describe("Conversations API - CRUD", () => {
  let orgId: string;
  let teamId: string;
  const createdConversationIds: string[] = [];

  test.beforeAll(async ({ authenticatedApiContext }) => {
    // Get organization ID
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    expect(orgData.data.length).toBeGreaterThan(0);
    orgId = orgData.data[0].id;

    // Get team ID
    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<Team>>(teamsResponse);
    expect(teamsData.data.length).toBeGreaterThan(0);
    teamId = teamsData.data[0].id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    // Clean up created conversations
    for (const conversationId of createdConversationIds) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/conversations/${conversationId}`
        );
      } catch (error) {
        logger.warn("cleanup-failed", {
          resource: "conversation",
          id: conversationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    // Clear the array after cleanup to prevent issues if test file is re-run
    createdConversationIds.length = 0;
  });

  test("should create a new conversation", async ({ authenticatedApiContext }, testInfo) => {
    const title = `Test Conversation ${Date.now()}`;

    logTestData({ testName: testInfo.title, orgId, teamId, title });

    // Create uses query params for org/team IDs and JSON body for title
    const response = await authenticatedApiContext.post(
      `/v1/conversations/?organization_id=${orgId}&team_id=${teamId}`,
      {
        data: {
          title,
        },
      }
    );

    const conversation = await expectSuccessResponse<Conversation>(response);
    createdConversationIds.push(conversation.id);

    expect(conversation.title).toBe(title);
    expect(conversation.organization_id).toBe(orgId);
    expect(conversation.team_id).toBe(teamId);
    expect(conversation.is_starred).toBe(false);
  });

  test("should list conversations for team", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/conversations/?team_id=${teamId}`
    );

    const data = await expectSuccessResponse<ListResponse<Conversation>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should get conversation by ID", async ({ authenticatedApiContext }, testInfo) => {
    // Create a conversation first
    const title = `Get Test ${Date.now()}`;
    logTestData({ testName: testInfo.title, title });

    const createResponse = await authenticatedApiContext.post(
      `/v1/conversations/?organization_id=${orgId}&team_id=${teamId}`,
      {
        data: { title },
      }
    );
    const created = await expectSuccessResponse<Conversation>(createResponse);
    createdConversationIds.push(created.id);

    // Get the conversation
    const response = await authenticatedApiContext.get(
      `/v1/conversations/${created.id}`
    );

    const conversation = await expectSuccessResponse<Conversation>(response);
    expect(conversation.id).toBe(created.id);
    expect(conversation.title).toBe(title);
  });

  test("should update conversation title", async ({ authenticatedApiContext }, testInfo) => {
    // Create a conversation
    const originalTitle = `Original ${Date.now()}`;
    const newTitle = `Updated ${Date.now()}`;

    logTestData({ testName: testInfo.title, originalTitle, newTitle });

    const createResponse = await authenticatedApiContext.post(
      `/v1/conversations/?organization_id=${orgId}&team_id=${teamId}`,
      {
        data: { title: originalTitle },
      }
    );
    const created = await expectSuccessResponse<Conversation>(createResponse);
    createdConversationIds.push(created.id);

    // Update the title
    const response = await authenticatedApiContext.patch(
      `/v1/conversations/${created.id}`,
      { data: { title: newTitle } }
    );

    const updated = await expectSuccessResponse<Conversation>(response);
    expect(updated.title).toBe(newTitle);
  });

  test("should delete conversation", async ({ authenticatedApiContext }, testInfo) => {
    // Create a conversation to delete
    const title = `Delete Test ${Date.now()}`;
    logTestData({ testName: testInfo.title, title });

    const createResponse = await authenticatedApiContext.post(
      `/v1/conversations/?organization_id=${orgId}&team_id=${teamId}`,
      {
        data: { title },
      }
    );
    const created = await expectSuccessResponse<Conversation>(createResponse);

    // Delete the conversation
    const deleteResponse = await authenticatedApiContext.delete(
      `/v1/conversations/${created.id}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify deletion - may return 404 (hard delete) or 200 (soft delete)
    const getResponse = await authenticatedApiContext.get(
      `/v1/conversations/${created.id}`
    );
    expect([200, 404]).toContain(getResponse.status());
  });

  test("should return 404 for non-existent conversation", async ({ authenticatedApiContext }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await authenticatedApiContext.get(`/v1/conversations/${fakeId}`);
    expect(response.status()).toBe(404);
  });
});

test.describe("Conversations API - Star/Unstar", () => {
  let orgId: string;
  let teamId: string;
  let conversationId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    // Get organization and team IDs
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<Team>>(teamsResponse);
    teamId = teamsData.data[0].id;

    // Create a conversation for star/unstar tests
    const createResponse = await authenticatedApiContext.post(
      `/v1/conversations/?organization_id=${orgId}&team_id=${teamId}`,
      {
        data: { title: `Star Test ${Date.now()}` },
      }
    );
    const conversation = await expectSuccessResponse<Conversation>(createResponse);
    conversationId = conversation.id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    if (conversationId) {
      try {
        await deleteResource(authenticatedApiContext, `/v1/conversations/${conversationId}`);
      } catch (error) {
        logger.warn("cleanup-failed", {
          resource: "conversation",
          id: conversationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  test("should star conversation", async ({ authenticatedApiContext }) => {
    // Star uses query param is_starred=true
    const response = await authenticatedApiContext.post(
      `/v1/conversations/${conversationId}/star?is_starred=true`
    );

    expect(response.ok()).toBeTruthy();

    // Verify starred
    const getResponse = await authenticatedApiContext.get(
      `/v1/conversations/${conversationId}`
    );
    const conversation = await expectSuccessResponse<Conversation>(getResponse);
    expect(conversation.is_starred).toBe(true);
  });

  test("should unstar conversation", async ({ authenticatedApiContext }) => {
    // First star it
    await authenticatedApiContext.post(
      `/v1/conversations/${conversationId}/star?is_starred=true`
    );

    // Then unstar using is_starred=false
    const response = await authenticatedApiContext.post(
      `/v1/conversations/${conversationId}/star?is_starred=false`
    );

    expect(response.ok()).toBeTruthy();

    // Verify unstarred
    const getResponse = await authenticatedApiContext.get(
      `/v1/conversations/${conversationId}`
    );
    const conversation = await expectSuccessResponse<Conversation>(getResponse);
    expect(conversation.is_starred).toBe(false);
  });
});

test.describe("Conversations API - Search", () => {
  let orgId: string;
  let teamId: string;
  let conversationId: string;
  const searchTitle = `SearchableConversation_${Date.now()}`;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    // Get organization and team IDs
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<Team>>(teamsResponse);
    teamId = teamsData.data[0].id;

    // Create a conversation with a unique searchable title
    const createResponse = await authenticatedApiContext.post(
      `/v1/conversations/?organization_id=${orgId}&team_id=${teamId}`,
      {
        data: { title: searchTitle },
      }
    );
    const conversation = await expectSuccessResponse<Conversation>(createResponse);
    conversationId = conversation.id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    if (conversationId) {
      try {
        await deleteResource(authenticatedApiContext, `/v1/conversations/${conversationId}`);
      } catch (error) {
        logger.warn("cleanup-failed", {
          resource: "conversation",
          id: conversationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  test("should search conversations by title", async ({ authenticatedApiContext }) => {
    // Search for the unique title
    const response = await authenticatedApiContext.get(
      `/v1/conversations/?team_id=${teamId}&search=${encodeURIComponent(searchTitle)}`
    );

    const data = await expectSuccessResponse<ListResponse<Conversation>>(response);

    expect(data.count).toBeGreaterThanOrEqual(1);
    const found = data.data.some((c) => c.title === searchTitle);
    expect(found).toBe(true);
  });

  test("should return empty results for non-matching search", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/conversations/?team_id=${teamId}&search=nonexistent_xyz_query_12345`
    );

    const data = await expectSuccessResponse<ListResponse<Conversation>>(response);
    expect(data.count).toBe(0);
    expect(data.data.length).toBe(0);
  });
});
