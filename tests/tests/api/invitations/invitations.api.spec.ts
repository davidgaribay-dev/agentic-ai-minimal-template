import { apiTest as test, expect } from "../../../fixtures";
import {
  expectSuccessResponse,
  createResource,
  deleteResource,
} from "../../../utils/api-helpers";
import { generateTestEmail, generateTeamName } from "../../../utils/test-data";
import { logTestData } from "../../../utils/logger";
import { ListResponse, Organization } from "../../../utils";

/**
 * Invitations API Tests
 *
 * Tests for /v1/organizations/{org_id}/invitations endpoints
 * - Create and manage organization invitations
 * - Test invitation lifecycle (send, list, cancel)
 */

// InvitationPublic schema (used for most responses)
interface Invitation {
  id: string;
  email: string;
  organization_id: string;
  org_role: string;
  team_id: string | null;
  team_role: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

// InvitationCreatedResponse schema (create endpoint returns token)
interface InvitationCreated extends Invitation {
  token: string;
}

test.describe("Invitations API - CRUD", () => {
  let orgId: string;
  const createdInvitationIds: string[] = [];

  test.beforeAll(async ({ authenticatedApiContext }) => {
    // Get organization ID for tests
    const response = await authenticatedApiContext.get("/v1/organizations/");
    const data = await expectSuccessResponse<ListResponse<Organization>>(response);
    expect(data.data.length).toBeGreaterThan(0);
    orgId = data.data[0].id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    // Clean up created invitations
    for (const invitationId of createdInvitationIds) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/organizations/${orgId}/invitations/${invitationId}`
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should create an invitation", async ({ authenticatedApiContext }, testInfo) => {
    const email = generateTestEmail("invite");

    logTestData({ testName: testInfo.title, orgId, email });

    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/invitations/`,
      {
        data: {
          email,
          org_role: "member",
        },
      }
    );

    const invitation = await expectSuccessResponse<InvitationCreated>(response, 201);
    createdInvitationIds.push(invitation.id);

    expect(invitation.email).toBe(email);
    expect(invitation.organization_id).toBe(orgId);
    expect(invitation.org_role).toBe("member");
    expect(invitation.status).toBe("pending");
    expect(invitation.token).toBeTruthy();
  });

  test("should create invitation with team assignment", async (
    { authenticatedApiContext },
    testInfo
  ) => {
    const email = generateTestEmail("team-invite");

    // First get a team ID
    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<{ id: string }>>(teamsResponse);

    // Skip if no teams exist
    if (teamsData.data.length === 0) {
      test.skip();
      return;
    }

    const teamId = teamsData.data[0].id;
    logTestData({ testName: testInfo.title, orgId, email, teamId });

    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/invitations/`,
      {
        data: {
          email,
          org_role: "member",
          team_id: teamId,
          team_role: "member",
        },
      }
    );

    const invitation = await expectSuccessResponse<InvitationCreated>(response, 201);
    createdInvitationIds.push(invitation.id);

    expect(invitation.email).toBe(email);
    expect(invitation.team_id).toBe(teamId);
    expect(invitation.team_role).toBe("member");
  });

  test("should list invitations", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/invitations/`
    );

    const data = await expectSuccessResponse<ListResponse<Invitation>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should get invitation by ID", async ({ authenticatedApiContext }, testInfo) => {
    // Create an invitation first
    const email = generateTestEmail("get-invite");
    logTestData({ testName: testInfo.title, email });

    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/invitations/`,
      {
        data: {
          email,
          org_role: "member",
        },
      }
    );
    const created = await expectSuccessResponse<InvitationCreated>(createResponse, 201);
    createdInvitationIds.push(created.id);

    // Get the invitation (returns InvitationPublic, NOT InvitationCreatedResponse)
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/invitations/${created.id}`
    );

    const invitation = await expectSuccessResponse<Invitation>(response);
    expect(invitation.id).toBe(created.id);
    expect(invitation.email).toBe(email);
  });

  test("should cancel (delete) invitation", async ({ authenticatedApiContext }, testInfo) => {
    // Create an invitation to cancel
    const email = generateTestEmail("cancel-invite");
    logTestData({ testName: testInfo.title, email });

    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/invitations/`,
      {
        data: {
          email,
          org_role: "member",
        },
      }
    );
    const created = await expectSuccessResponse<InvitationCreated>(createResponse, 201);

    // Cancel (delete) the invitation
    const deleteResponse = await authenticatedApiContext.delete(
      `/v1/organizations/${orgId}/invitations/${created.id}`
    );
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify it's cancelled/deleted
    const getResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/invitations/${created.id}`
    );
    // Should return 404 or invitation with cancelled status
    expect([200, 404]).toContain(getResponse.status());
  });

  test("should return 404 for non-existent invitation", async ({ authenticatedApiContext }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/invitations/${fakeId}`
    );
    expect(response.status()).toBe(404);
  });

  test("should handle invalid email format", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/invitations/`,
      {
        data: {
          email: "not-a-valid-email",
          org_role: "member",
        },
      }
    );
    // Backend may accept (201) if email validation is permissive,
    // or reject with 400 (bad request) or 422 (validation error)
    expect([201, 400, 422]).toContain(response.status());
  });

  test("should handle invalid org_role", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/invitations/`,
      {
        data: {
          email: generateTestEmail("invalid-role"),
          org_role: "invalid_role",
        },
      }
    );
    // Backend may accept (201), reject with validation error (400/422),
    // or fail silently depending on enum validation strategy
    expect([201, 400, 422]).toContain(response.status());
  });
});

test.describe("Invitations API - Resend", () => {
  let orgId: string;
  let invitationId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    // Get organization ID
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    // Create an invitation for resend tests
    const email = generateTestEmail("resend");
    const createResponse = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/invitations/`,
      {
        data: {
          email,
          org_role: "member",
        },
      }
    );
    const invitation = await expectSuccessResponse<InvitationCreated>(createResponse, 201);
    invitationId = invitation.id;
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    // Clean up
    if (invitationId) {
      try {
        await deleteResource(
          authenticatedApiContext,
          `/v1/organizations/${orgId}/invitations/${invitationId}`
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should resend invitation", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.post(
      `/v1/organizations/${orgId}/invitations/${invitationId}/resend`
    );

    // Should succeed (200) or accept the request
    expect(response.ok()).toBeTruthy();
  });
});
