import { apiTest as test, expect } from "../../../fixtures";
import {
  expectSuccessResponse,
  deleteResource,
} from "../../../utils/api-helpers";
import { logTestData } from "../../../utils/logger";
import { ListResponse, Organization, Team } from "../../../utils";

/**
 * MCP Servers API Tests
 *
 * Tests for MCP (Model Context Protocol) server management
 * - /v1/organizations/{org_id}/mcp-servers - Organization MCP servers
 * - /v1/organizations/{org_id}/teams/{team_id}/mcp-servers - Team MCP servers
 * - /v1/mcp-servers/me - User MCP servers
 * - /v1/mcp-servers/effective - Effective servers for current context
 */

// Actual backend MCPServerPublic schema
interface MCPServer {
  id: string;
  name: string;
  url: string;
  transport: string;
  description: string | null;
  enabled: boolean; // NOT is_enabled
  organization_id: string;
  team_id: string | null;
  user_id: string | null;
  auth_type: string;
  auth_header_name: string | null;
  has_auth_secret: boolean;
  is_builtin: boolean;
  tool_prefix: boolean;
  scope: string; // "org", "team", or "user"
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

test.describe("Organization MCP Servers API", () => {
  let orgId: string;
  const createdServerIds: string[] = [];

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/organizations/");
    const data = await expectSuccessResponse<ListResponse<Organization>>(response);
    expect(data.data.length).toBeGreaterThan(0);
    orgId = data.data[0].id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    const cleanupErrors: string[] = [];
    for (const serverId of createdServerIds) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/organizations/${orgId}/mcp-servers/${serverId}`
        );
      } catch (error) {
        cleanupErrors.push(
          `server ${serverId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    if (cleanupErrors.length > 0) {
      console.warn(`Cleanup issues:\n${cleanupErrors.join("\n")}`);
    }
    createdServerIds.length = 0;
  });

  test("should create organization MCP server", async ({ authenticatedApiContext }, testInfo) => {
    const name = `Org MCP Server ${Date.now()}`;
    const url = "https://example.com/mcp-server";

    logTestData({ testName: testInfo.title, orgId, name, url });

    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/mcp-servers`,
      {
        data: {
          name,
          url,
          transport: "streamable_http",
          description: "Test organization MCP server",
        },
      }
    );

    const server = await expectSuccessResponse<MCPServer>(response, 201);
    createdServerIds.push(server.id);

    expect(server.name).toBe(name);
    expect(server.url).toBe(url);
    expect(server.transport).toBe("streamable_http");
    expect(server.organization_id).toBe(orgId);
    expect(server.enabled).toBe(true);
  });

  test("should list organization MCP servers", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/mcp-servers`
    );

    const data = await expectSuccessResponse<ListResponse<MCPServer>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should get organization MCP server by ID", async (
    { authenticatedApiContext },
    testInfo
  ) => {
    const name = `Get MCP Server ${Date.now()}`;
    logTestData({ testName: testInfo.title, name });

    // Create server
    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/mcp-servers`,
      {
        data: {
          name,
          url: "https://example.com/get-test",
          transport: "streamable_http",
        },
      }
    );
    const created = await expectSuccessResponse<MCPServer>(createResponse, 201);
    createdServerIds.push(created.id);

    // Get server
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/mcp-servers/${created.id}`
    );

    const server = await expectSuccessResponse<MCPServer>(response);
    expect(server.id).toBe(created.id);
    expect(server.name).toBe(name);
  });

  test("should update organization MCP server", async ({ authenticatedApiContext }, testInfo) => {
    const originalName = `Original MCP ${Date.now()}`;
    const newName = `Updated MCP ${Date.now()}`;

    logTestData({ testName: testInfo.title, originalName, newName });

    // Create server
    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/mcp-servers`,
      {
        data: {
          name: originalName,
          url: "https://example.com/update-test",
          transport: "streamable_http",
        },
      }
    );
    const created = await expectSuccessResponse<MCPServer>(createResponse, 201);
    createdServerIds.push(created.id);

    // Update server
    const response = await authenticatedApiContext.patch(
      `/v1/organizations/${orgId}/mcp-servers/${created.id}`,
      { data: { name: newName, enabled: false } }
    );

    const updated = await expectSuccessResponse<MCPServer>(response);
    expect(updated.name).toBe(newName);
    expect(updated.enabled).toBe(false);
  });

  test("should delete organization MCP server", async ({ authenticatedApiContext }, testInfo) => {
    const name = `Delete MCP ${Date.now()}`;
    logTestData({ testName: testInfo.title, name });

    // Create server
    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/mcp-servers`,
      {
        data: {
          name,
          url: "https://example.com/delete-test",
          transport: "streamable_http",
        },
      }
    );
    const created = await expectSuccessResponse<MCPServer>(createResponse, 201);

    // Delete server
    const deleteResponse = await authenticatedApiContext.delete(
      `/v1/organizations/${orgId}/mcp-servers/${created.id}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify deletion
    const getResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/mcp-servers/${created.id}`
    );
    expect(getResponse.status()).toBe(404);
  });

  test("should return 404 for non-existent MCP server", async ({ authenticatedApiContext }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/mcp-servers/${fakeId}`
    );
    expect(response.status()).toBe(404);
  });
});

test.describe("Team MCP Servers API", () => {
  let orgId: string;
  let teamId: string;
  const createdServerIds: string[] = [];

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
    for (const serverId of createdServerIds) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/organizations/${orgId}/teams/${teamId}/mcp-servers/${serverId}`
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should create team MCP server", async ({ authenticatedApiContext }, testInfo) => {
    const name = `Team MCP Server ${Date.now()}`;

    logTestData({ testName: testInfo.title, teamId, name });

    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/teams/${teamId}/mcp-servers`,
      {
        data: {
          name,
          url: "https://example.com/team-mcp",
          transport: "streamable_http",
        },
      }
    );

    // May fail with 403 if custom MCP servers disabled at org level
    expect([200, 201, 403]).toContain(response.status());

    if (response.ok()) {
      const server = await response.json();
      createdServerIds.push(server.id);
      expect(server.name).toBe(name);
      expect(server.team_id).toBe(teamId);
    }
  });

  test("should list team MCP servers", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${teamId}/mcp-servers`
    );

    const data = await expectSuccessResponse<ListResponse<MCPServer>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("User MCP Servers API", () => {
  let orgId: string;
  let teamId: string;
  const createdServerIds: string[] = [];

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
    for (const serverId of createdServerIds) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/mcp-servers/me/${serverId}`
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should create user MCP server", async ({ authenticatedApiContext }, testInfo) => {
    const name = `User MCP Server ${Date.now()}`;

    logTestData({ testName: testInfo.title, name });

    const response = await authenticatedApiContext.post(
      `/v1/mcp-servers/me?organization_id=${orgId}&team_id=${teamId}`,
      {
        data: {
          name,
          url: "https://example.com/user-mcp",
          transport: "streamable_http",
        },
      }
    );

    // May fail with 403 if custom MCP servers disabled at org level
    // May fail with 400 if maximum personal servers limit reached
    expect([200, 201, 400, 403]).toContain(response.status());

    if (response.ok()) {
      const server = await response.json();
      createdServerIds.push(server.id);
      expect(server.name).toBe(name);
      expect(server.user_id).toBeTruthy();
    }
  });

  test("should list user MCP servers", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/mcp-servers/me?organization_id=${orgId}&team_id=${teamId}`
    );

    const data = await expectSuccessResponse<ListResponse<MCPServer>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should update user MCP server", async ({ authenticatedApiContext }, testInfo) => {
    const originalName = `User MCP Original ${Date.now()}`;
    const newName = `User MCP Updated ${Date.now()}`;

    logTestData({ testName: testInfo.title, originalName, newName });

    // Create server
    const createResponse = await authenticatedApiContext.post(
      `/v1/mcp-servers/me?organization_id=${orgId}&team_id=${teamId}`,
      {
        data: {
          name: originalName,
          url: "https://example.com/user-update",
          transport: "streamable_http",
        },
      }
    );

    // Skip if custom servers disabled or max limit reached
    if (createResponse.status() === 403 || createResponse.status() === 400) {
      test.skip();
      return;
    }

    const created = await expectSuccessResponse<MCPServer>(createResponse, 201);
    createdServerIds.push(created.id);

    // Update server
    const response = await authenticatedApiContext.patch(
      `/v1/mcp-servers/me/${created.id}`,
      { data: { name: newName } }
    );

    const updated = await expectSuccessResponse<MCPServer>(response);
    expect(updated.name).toBe(newName);
  });

  test("should delete user MCP server", async ({ authenticatedApiContext }, testInfo) => {
    const name = `User MCP Delete ${Date.now()}`;
    logTestData({ testName: testInfo.title, name });

    // Create server
    const createResponse = await authenticatedApiContext.post(
      `/v1/mcp-servers/me?organization_id=${orgId}&team_id=${teamId}`,
      {
        data: {
          name,
          url: "https://example.com/user-delete",
          transport: "streamable_http",
        },
      }
    );

    // Skip if custom servers disabled or max limit reached
    if (createResponse.status() === 403 || createResponse.status() === 400) {
      test.skip();
      return;
    }

    const created = await expectSuccessResponse<MCPServer>(createResponse, 201);

    // Delete server
    const deleteResponse = await authenticatedApiContext.delete(
      `/v1/mcp-servers/me/${created.id}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify deletion
    const getResponse = await authenticatedApiContext.get(
      `/v1/mcp-servers/me/${created.id}`
    );
    expect(getResponse.status()).toBe(404);
  });
});

test.describe("MCP Effective Endpoints", () => {
  let orgId: string;
  let teamId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<Team>>(teamsResponse);
    teamId = teamsData.data[0].id;
  });

  test("should get effective MCP servers", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/mcp-servers/effective?organization_id=${orgId}&team_id=${teamId}`
    );

    // Should return all servers user can access
    const data = await expectSuccessResponse<ListResponse<MCPServer>>(response);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
