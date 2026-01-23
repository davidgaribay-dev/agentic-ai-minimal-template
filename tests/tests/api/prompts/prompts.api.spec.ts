import { apiTest as test, expect } from "../../../fixtures";
import {
  expectSuccessResponse,
  deleteResource,
} from "../../../utils/api-helpers";
import { logTestData } from "../../../utils/logger";
import type {
  ListResponse,
  Organization,
  Team,
  Prompt,
} from "../../../utils";

/**
 * Prompts API Tests
 *
 * Tests for system prompts at organization, team, and user levels
 * - /v1/organizations/{org_id}/prompts - Organization prompts
 * - /v1/organizations/{org_id}/teams/{team_id}/prompts - Team prompts
 * - /v1/users/me/prompts/ - User prompts
 */

test.describe("Organization Prompts API", () => {
  let orgId: string;
  const createdPromptIds: string[] = [];

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/organizations/");
    const data = await expectSuccessResponse<ListResponse<Organization>>(response);
    expect(data.data.length).toBeGreaterThan(0);
    orgId = data.data[0].id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    const cleanupErrors: string[] = [];
    for (const promptId of createdPromptIds) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/organizations/${orgId}/prompts/${promptId}`
        );
      } catch (error) {
        cleanupErrors.push(
          `prompt ${promptId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    if (cleanupErrors.length > 0) {
      console.warn(`Cleanup issues:\n${cleanupErrors.join("\n")}`);
    }
    createdPromptIds.length = 0;
  });

  test("should create organization prompt", async ({ authenticatedApiContext }, testInfo) => {
    const name = `Org Prompt ${Date.now()}`;
    const content = "You are a helpful assistant for our organization.";

    logTestData({ testName: testInfo.title, orgId, name });

    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/prompts/`,
      {
        data: {
          name,
          content,
          description: "Test organization prompt",
          prompt_type: "system",
        },
      }
    );

    const prompt = await expectSuccessResponse<Prompt>(response, 201);
    createdPromptIds.push(prompt.id);

    expect(prompt.name).toBe(name);
    expect(prompt.content).toBe(content);
    expect(prompt.organization_id).toBe(orgId);
    expect(prompt.prompt_type).toBe("system");
  });

  test("should list organization prompts", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/prompts/`
    );

    const data = await expectSuccessResponse<ListResponse<Prompt>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should get organization prompt by ID", async ({ authenticatedApiContext }, testInfo) => {
    // Create a prompt first
    const name = `Get Prompt ${Date.now()}`;
    logTestData({ testName: testInfo.title, name });

    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/prompts/`,
      {
        data: {
          name,
          content: "Test content",
          prompt_type: "system",
        },
      }
    );
    const created = await expectSuccessResponse<Prompt>(createResponse, 201);
    createdPromptIds.push(created.id);

    // Get the prompt
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/prompts/${created.id}`
    );

    const prompt = await expectSuccessResponse<Prompt>(response);
    expect(prompt.id).toBe(created.id);
    expect(prompt.name).toBe(name);
  });

  test("should update organization prompt", async ({ authenticatedApiContext }, testInfo) => {
    const originalName = `Original ${Date.now()}`;
    const newName = `Updated ${Date.now()}`;

    logTestData({ testName: testInfo.title, originalName, newName });

    // Create prompt
    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/prompts/`,
      {
        data: {
          name: originalName,
          content: "Original content",
          prompt_type: "system",
        },
      }
    );
    const created = await expectSuccessResponse<Prompt>(createResponse, 201);
    createdPromptIds.push(created.id);

    // Update prompt
    const response = await authenticatedApiContext.patch(
      `/v1/organizations/${orgId}/prompts/${created.id}`,
      { data: { name: newName, content: "Updated content" } }
    );

    const updated = await expectSuccessResponse<Prompt>(response);
    expect(updated.name).toBe(newName);
    expect(updated.content).toBe("Updated content");
  });

  test("should delete organization prompt", async ({ authenticatedApiContext }, testInfo) => {
    const name = `Delete Prompt ${Date.now()}`;
    logTestData({ testName: testInfo.title, name });

    // Create prompt
    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/prompts/`,
      {
        data: {
          name,
          content: "To be deleted",
          prompt_type: "system",
        },
      }
    );
    const created = await expectSuccessResponse<Prompt>(createResponse, 201);

    // Delete prompt
    const deleteResponse = await authenticatedApiContext.delete(
      `/v1/organizations/${orgId}/prompts/${created.id}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify deletion
    const getResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/prompts/${created.id}`
    );
    expect(getResponse.status()).toBe(404);
  });

  test("should activate organization prompt", async ({ authenticatedApiContext }, testInfo) => {
    const name = `Activate Prompt ${Date.now()}`;
    logTestData({ testName: testInfo.title, name });

    // Create prompt
    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/prompts/`,
      {
        data: {
          name,
          content: "Active system prompt",
          prompt_type: "system",
        },
      }
    );
    const created = await expectSuccessResponse<Prompt>(createResponse, 201);
    createdPromptIds.push(created.id);

    // Activate prompt
    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/prompts/${created.id}/activate`
    );

    expect(response.ok()).toBeTruthy();

    // Verify activation
    const getResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/prompts/${created.id}`
    );
    const prompt = await expectSuccessResponse<Prompt>(getResponse);
    expect(prompt.is_active).toBe(true);
  });
});

test.describe("Team Prompts API", () => {
  let orgId: string;
  let teamId: string;
  const createdPromptIds: string[] = [];

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<Team>>(teamsResponse);
    expect(teamsData.data.length).toBeGreaterThan(0);
    teamId = teamsData.data[0].id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    for (const promptId of createdPromptIds) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/organizations/${orgId}/teams/${teamId}/prompts/${promptId}`
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should create team prompt", async ({ authenticatedApiContext }, testInfo) => {
    const name = `Team Prompt ${Date.now()}`;

    logTestData({ testName: testInfo.title, teamId, name });

    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/teams/${teamId}/prompts/`,
      {
        data: {
          name,
          content: "Team-specific instructions",
          prompt_type: "system",
        },
      }
    );

    const prompt = await expectSuccessResponse<Prompt>(response, 201);
    createdPromptIds.push(prompt.id);

    expect(prompt.name).toBe(name);
    expect(prompt.team_id).toBe(teamId);
  });

  test("should list team prompts", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${teamId}/prompts/`
    );

    const data = await expectSuccessResponse<ListResponse<Prompt>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should get available prompts (org + team + user)", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${teamId}/prompts/available`
    );

    // Should return prompts grouped by scope level
    interface PromptsAvailable {
      org_prompts: Prompt[];
      team_prompts: Prompt[];
      user_prompts: Prompt[];
    }
    const data = await expectSuccessResponse<PromptsAvailable>(response);
    expect(Array.isArray(data.org_prompts)).toBe(true);
    expect(Array.isArray(data.team_prompts)).toBe(true);
    expect(Array.isArray(data.user_prompts)).toBe(true);
  });

  test("should get effective active system prompt", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${teamId}/prompts/active-system`
    );

    // Should return the effective concatenated system prompt
    // May return 200 with content or 404 if no active prompts
    expect([200, 404]).toContain(response.status());
  });
});

test.describe("User Prompts API", () => {
  const createdPromptIds: string[] = [];

  test.afterAll(async ({ authenticatedApiContext }) => {
    for (const promptId of createdPromptIds) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/users/me/prompts/${promptId}`
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should create user prompt", async ({ authenticatedApiContext }, testInfo) => {
    const name = `User Prompt ${Date.now()}`;

    logTestData({ testName: testInfo.title, name });

    const response = await authenticatedApiContext.post("/v1/users/me/prompts/", {
      data: {
        name,
        content: "Personal prompt instructions",
        prompt_type: "system",
      },
    });

    const prompt = await expectSuccessResponse<Prompt>(response, 201);
    createdPromptIds.push(prompt.id);

    expect(prompt.name).toBe(name);
    expect(prompt.user_id).toBeTruthy();
  });

  test("should list user prompts", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/users/me/prompts/");

    const data = await expectSuccessResponse<ListResponse<Prompt>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should update user prompt", async ({ authenticatedApiContext }, testInfo) => {
    const originalName = `User Original ${Date.now()}`;
    const newName = `User Updated ${Date.now()}`;

    logTestData({ testName: testInfo.title, originalName, newName });

    // Create prompt
    const createResponse = await authenticatedApiContext.post("/v1/users/me/prompts/", {
      data: {
        name: originalName,
        content: "Original user content",
        prompt_type: "system",
      },
    });
    const created = await expectSuccessResponse<Prompt>(createResponse, 201);
    createdPromptIds.push(created.id);

    // Update prompt
    const response = await authenticatedApiContext.patch(
      `/v1/users/me/prompts/${created.id}`,
      { data: { name: newName } }
    );

    const updated = await expectSuccessResponse<Prompt>(response);
    expect(updated.name).toBe(newName);
  });

  test("should delete user prompt", async ({ authenticatedApiContext }, testInfo) => {
    const name = `User Delete ${Date.now()}`;
    logTestData({ testName: testInfo.title, name });

    // Create prompt
    const createResponse = await authenticatedApiContext.post("/v1/users/me/prompts/", {
      data: {
        name,
        content: "To be deleted",
        prompt_type: "system",
      },
    });
    const created = await expectSuccessResponse<Prompt>(createResponse, 201);

    // Delete prompt
    const deleteResponse = await authenticatedApiContext.delete(
      `/v1/users/me/prompts/${created.id}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify deletion
    const getResponse = await authenticatedApiContext.get(
      `/v1/users/me/prompts/${created.id}`
    );
    expect(getResponse.status()).toBe(404);
  });
});
