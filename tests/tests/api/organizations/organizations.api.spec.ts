import { apiTest as test, expect } from "../../../fixtures";
import { expectSuccessResponse } from "../../../utils/api-helpers";
import { logTestData } from "../../../utils/logger";
import { ListResponse, Organization } from "../../../utils";

/**
 * Organizations API Tests
 *
 * Tests for /v1/organizations endpoints following Playwright API testing best practices:
 * - Test isolation
 * - Validate response schemas
 * - Test authorization rules
 *
 * Note: API uses trailing slashes and returns { data: [...], count: X } format
 */

interface OrganizationMemberWithUser {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  created_at: string;
  updated_at: string;
  user_email: string;
  user_full_name: string | null;
  user_profile_image_url: string | null;
}

test.describe("Organizations API - List", () => {
  test("should list user organizations", async ({ authenticatedApiContext }) => {
    // Note: API requires trailing slash
    const response = await authenticatedApiContext.get("/v1/organizations/");

    const data = await expectSuccessResponse<ListResponse<Organization>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(1);

    // Verify organization structure
    if (data.data.length > 0) {
      const org = data.data[0];
      expect(org.id).toBeTruthy();
      expect(org.name).toBeTruthy();
      expect(org.created_at).toBeTruthy();
    }
  });

  test("should return 401 when not authenticated", async ({ apiContext }) => {
    const response = await apiContext.get("/v1/organizations/");
    expect(response.status()).toBe(401);
  });
});

test.describe("Organizations API - Get", () => {
  test("should get organization by ID", async ({ authenticatedApiContext }) => {
    // First, get list to find an org ID
    const listResponse = await authenticatedApiContext.get("/v1/organizations/");
    const listData = await expectSuccessResponse<ListResponse<Organization>>(listResponse);
    expect(listData.data.length).toBeGreaterThan(0);

    const orgId = listData.data[0].id;

    // Get specific organization
    const response = await authenticatedApiContext.get(`/v1/organizations/${orgId}`);
    const org = await expectSuccessResponse<Organization>(response);

    expect(org.id).toBe(orgId);
    expect(org.name).toBeTruthy();
  });

  test("should return 404 for non-existent organization", async ({
    authenticatedApiContext,
  }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await authenticatedApiContext.get(`/v1/organizations/${fakeId}`);
    expect(response.status()).toBe(404);
  });

  test("should return 422 for invalid UUID format", async ({
    authenticatedApiContext,
  }) => {
    const response = await authenticatedApiContext.get("/v1/organizations/invalid-uuid");
    expect(response.status()).toBe(422);
  });
});

test.describe("Organizations API - Update", () => {
  test("should update organization name", async (
    { authenticatedApiContext },
    testInfo
  ) => {
    // Get current org
    const listResponse = await authenticatedApiContext.get("/v1/organizations/");
    const listData = await expectSuccessResponse<ListResponse<Organization>>(listResponse);
    const org = listData.data[0];
    const originalName = org.name;
    const newName = `Updated Org ${Date.now()}`;

    logTestData({ testName: testInfo.title, orgId: org.id, originalName, newName });

    // Update name
    const updateResponse = await authenticatedApiContext.patch(
      `/v1/organizations/${org.id}`,
      {
        data: { name: newName },
      }
    );

    const updated = await expectSuccessResponse<Organization>(updateResponse);
    expect(updated.name).toBe(newName);

    // Restore original name
    await authenticatedApiContext.patch(`/v1/organizations/${org.id}`, {
      data: { name: originalName },
    });
  });

  test("should update organization description", async (
    { authenticatedApiContext },
    testInfo
  ) => {
    const listResponse = await authenticatedApiContext.get("/v1/organizations/");
    const listData = await expectSuccessResponse<ListResponse<Organization>>(listResponse);
    const org = listData.data[0];
    const newDescription = `Test description ${Date.now()}`;

    logTestData({ testName: testInfo.title, orgId: org.id, newDescription });

    const updateResponse = await authenticatedApiContext.patch(
      `/v1/organizations/${org.id}`,
      {
        data: { description: newDescription },
      }
    );

    const updated = await expectSuccessResponse<Organization>(updateResponse);
    expect(updated.description).toBe(newDescription);
  });

  test("should return 422 for empty name", async ({ authenticatedApiContext }) => {
    const listResponse = await authenticatedApiContext.get("/v1/organizations/");
    const listData = await expectSuccessResponse<ListResponse<Organization>>(listResponse);
    const org = listData.data[0];

    const response = await authenticatedApiContext.patch(
      `/v1/organizations/${org.id}`,
      {
        data: { name: "" },
      }
    );

    expect(response.status()).toBe(422);
  });
});

test.describe("Organizations API - Members", () => {
  test("should list organization members", async ({ authenticatedApiContext }) => {
    // Get org ID
    const listResponse = await authenticatedApiContext.get("/v1/organizations/");
    const listData = await expectSuccessResponse<ListResponse<Organization>>(listResponse);
    const orgId = listData.data[0].id;

    // Get members (no trailing slash needed for this endpoint)
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/members`
    );

    const data = await expectSuccessResponse<ListResponse<OrganizationMemberWithUser>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(1);

    // Verify member structure (user info is flattened, not nested)
    const member = data.data[0];
    expect(member.id).toBeTruthy();
    expect(member.user_id).toBeTruthy();
    expect(member.organization_id).toBe(orgId);
    expect(member.role).toBeTruthy();
    expect(member.user_email).toBeTruthy();
  });

  test("should get member by ID", async ({ authenticatedApiContext }) => {
    // Get org ID
    const listResponse = await authenticatedApiContext.get("/v1/organizations/");
    const listData = await expectSuccessResponse<ListResponse<Organization>>(listResponse);
    const orgId = listData.data[0].id;

    // Get members list first
    const membersResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/members`
    );
    const membersData = await expectSuccessResponse<ListResponse<OrganizationMemberWithUser>>(membersResponse);
    const memberId = membersData.data[0].id;

    // Get specific member
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/members/${memberId}`
    );

    const member = await expectSuccessResponse<OrganizationMemberWithUser>(response);
    expect(member.id).toBe(memberId);
    expect(member.organization_id).toBe(orgId);
    expect(member.role).toBeTruthy();
  });
});
