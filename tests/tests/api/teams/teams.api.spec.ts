import { apiTest as test, expect } from "../../../fixtures";
import {
  expectSuccessResponse,
  createResource,
  deleteResource,
} from "../../../utils/api-helpers";
import { generateTeamName } from "../../../utils/test-data";
import { logTestData } from "../../../utils/logger";
import type {
  ListResponse,
  Organization,
  Team,
} from "../../../utils";

/**
 * Teams API Tests
 *
 * Tests for /v1/organizations/{org_id}/teams endpoints following Playwright best practices:
 * - Test isolation with setup/teardown
 * - Create test resources and clean them up
 * - Validate response schemas
 */

interface TeamMember {
  id: string;
  org_member_id: string;
  team_id: string;
  role: string;
}

test.describe("Teams API - CRUD", () => {
  let orgId: string;
  const createdTeamIds: string[] = [];

  test.beforeAll(async ({ authenticatedApiContext }) => {
    // Get organization ID for tests
    const response = await authenticatedApiContext.get("/v1/organizations/");
    const data = await expectSuccessResponse<ListResponse<Organization>>(response);
    expect(data.data.length).toBeGreaterThan(0);
    orgId = data.data[0].id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    // Clean up created teams
    for (const teamId of createdTeamIds) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/organizations/${orgId}/teams/${teamId}`
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should create a new team", async ({ authenticatedApiContext }, testInfo) => {
    const teamName = generateTeamName("API");
    const description = `API test team ${Date.now()}`;

    logTestData({ testName: testInfo.title, orgId, teamName, description });

    const team = await createResource<Team>(
      authenticatedApiContext,
      `/v1/organizations/${orgId}/teams`,
      { name: teamName, description }
    );

    createdTeamIds.push(team.id);

    expect(team.name).toBe(teamName);
    expect(team.description).toBe(description);
    expect(team.organization_id).toBe(orgId);
  });

  test("should list teams in organization", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );

    const data = await expectSuccessResponse<ListResponse<Team>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should get team by ID", async ({ authenticatedApiContext }, testInfo) => {
    // Create a team first
    const teamName = generateTeamName("Get");
    logTestData({ testName: testInfo.title, teamName });

    const created = await createResource<Team>(
      authenticatedApiContext,
      `/v1/organizations/${orgId}/teams`,
      { name: teamName }
    );
    createdTeamIds.push(created.id);

    // Get the team
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${created.id}`
    );

    const team = await expectSuccessResponse<Team>(response);
    expect(team.id).toBe(created.id);
    expect(team.name).toBe(teamName);
  });

  test("should update team name", async ({ authenticatedApiContext }, testInfo) => {
    // Create a team
    const originalName = generateTeamName("Update");
    const newName = generateTeamName("Updated");

    logTestData({ testName: testInfo.title, originalName, newName });

    const created = await createResource<Team>(
      authenticatedApiContext,
      `/v1/organizations/${orgId}/teams`,
      { name: originalName }
    );
    createdTeamIds.push(created.id);

    // Update the team
    const response = await authenticatedApiContext.patch(
      `/v1/organizations/${orgId}/teams/${created.id}`,
      { data: { name: newName } }
    );

    const updated = await expectSuccessResponse<Team>(response);
    expect(updated.name).toBe(newName);
  });

  test("should update team description", async ({ authenticatedApiContext }, testInfo) => {
    const teamName = generateTeamName("Desc");
    const newDescription = `Updated description ${Date.now()}`;

    logTestData({ testName: testInfo.title, teamName, newDescription });

    const created = await createResource<Team>(
      authenticatedApiContext,
      `/v1/organizations/${orgId}/teams`,
      { name: teamName }
    );
    createdTeamIds.push(created.id);

    const response = await authenticatedApiContext.patch(
      `/v1/organizations/${orgId}/teams/${created.id}`,
      { data: { description: newDescription } }
    );

    const updated = await expectSuccessResponse<Team>(response);
    expect(updated.description).toBe(newDescription);
  });

  test("should delete a team", async ({ authenticatedApiContext }, testInfo) => {
    // Create a team to delete
    const teamName = generateTeamName("Delete");
    logTestData({ testName: testInfo.title, teamName });

    const created = await createResource<Team>(
      authenticatedApiContext,
      `/v1/organizations/${orgId}/teams`,
      { name: teamName }
    );

    // Delete the team
    const deleteResponse = await authenticatedApiContext.delete(
      `/v1/organizations/${orgId}/teams/${created.id}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify deletion
    const getResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${created.id}`
    );
    expect(getResponse.status()).toBe(404);
  });

  test("should return 404 for non-existent team", async ({ authenticatedApiContext }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${fakeId}`
    );
    expect(response.status()).toBe(404);
  });

  test("should return 422 for empty team name", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/teams`,
      { data: { name: "" } }
    );
    expect(response.status()).toBe(422);
  });
});

test.describe("Teams API - Members", () => {
  let orgId: string;
  let teamId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    // Get organization ID
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    // Create a team for member tests
    const team = await createResource<Team>(
      authenticatedApiContext,
      `/v1/organizations/${orgId}/teams/`,
      { name: generateTeamName("Members") }
    );
    teamId = team.id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    // Clean up team
    if (teamId) {
      await deleteResource(
        authenticatedApiContext,
        `/v1/organizations/${orgId}/teams/${teamId}/`
      );
    }
  });

  test("should list team members", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${teamId}/members`
    );

    const data = await expectSuccessResponse<ListResponse<TeamMember>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    // Creator is automatically added as member
    expect(data.count).toBeGreaterThanOrEqual(1);
  });

  test("should get team member by ID", async ({ authenticatedApiContext }) => {
    // Get members list first
    const membersResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${teamId}/members`
    );
    const membersData = await expectSuccessResponse<ListResponse<TeamMember>>(membersResponse);
    const memberId = membersData.data[0].id;

    // Get specific member
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${teamId}/members/${memberId}`
    );

    const member = await expectSuccessResponse<TeamMember>(response);
    expect(member.id).toBe(memberId);
    expect(member.team_id).toBe(teamId);
    expect(member.role).toBeTruthy();
  });
});

test.describe("Teams API - My Teams", () => {
  test("should list my teams with role", async ({ authenticatedApiContext }) => {
    // Get org ID first
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    const orgId = orgData.data[0].id;

    // Get my teams (endpoint is /my-teams, not /me)
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/my-teams`
    );

    const data = await expectSuccessResponse<ListResponse<Team>>(response);

    expect(Array.isArray(data.data)).toBe(true);
  });
});
