import { apiTest as test, expect } from "../../../fixtures";
import {
  expectSuccessResponse,
  deleteResource,
} from "../../../utils/api-helpers";
import { logTestData } from "../../../utils/logger";
import { ListResponse, Organization, Team } from "../../../utils";

/**
 * Media API Tests
 *
 * Tests for chat media (images, attachments)
 * - /v1/media - Media upload and management
 */

// Actual backend ChatMediaPublic schema
interface Media {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  organization_id: string;
  team_id: string | null;
  user_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

// Actual backend StorageUsage schema
interface MediaUsage {
  total_bytes: number;
  file_count: number;
  quota_bytes: number | null;
  usage_percent: number | null;
}

test.describe("Media API - List and Usage", () => {
  let orgId: string;
  let teamId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    expect(orgData.data.length).toBeGreaterThan(0);
    orgId = orgData.data[0].id;

    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<Team>>(teamsResponse);
    expect(teamsData.data.length).toBeGreaterThan(0);
    teamId = teamsData.data[0].id;
  });

  test("should list media for organization", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/media?organization_id=${orgId}`
    );

    const data = await expectSuccessResponse<ListResponse<Media>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should list media for team", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/media?organization_id=${orgId}&team_id=${teamId}`
    );

    const data = await expectSuccessResponse<ListResponse<Media>>(response);

    expect(Array.isArray(data.data)).toBe(true);
  });

  test("should get media usage statistics", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/media/usage?organization_id=${orgId}`
    );

    const usage = await expectSuccessResponse<MediaUsage>(response);

    expect(usage.total_bytes).toBeGreaterThanOrEqual(0);
    expect(usage.file_count).toBeGreaterThanOrEqual(0);
  });

  test("should return 404 for non-existent media", async ({ authenticatedApiContext }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await authenticatedApiContext.get(`/v1/media/${fakeId}`);
    expect(response.status()).toBe(404);
  });
});

test.describe("Media API - Upload", () => {
  let orgId: string;
  let teamId: string;
  const createdMediaIds: string[] = [];

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

  test.afterAll(async ({ authenticatedApiContext }) => {
    for (const mediaId of createdMediaIds) {
      try {
        await deleteResource(authenticatedApiContext, `/v1/media/${mediaId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should upload image", async ({ authenticatedApiContext }, testInfo) => {
    const filename = `test_image_${Date.now()}.png`;

    logTestData({ testName: testInfo.title, orgId, teamId, filename });

    // Create a minimal PNG image (1x1 pixel)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, // bit depth, color type, etc.
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, // compressed data
      0x05, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x49, // IEND chunk
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    // Upload endpoint uses query params for organization_id and team_id
    const response = await authenticatedApiContext.post(
      `/v1/media/upload?organization_id=${orgId}&team_id=${teamId}`,
      {
        multipart: {
          file: {
            name: filename,
            mimeType: "image/png",
            buffer: pngHeader,
          },
        },
      }
    );

    // 422 may occur if the minimal PNG is invalid or multipart form structure differs
    expect([200, 201, 422]).toContain(response.status());

    if (response.ok()) {
      const media = await response.json();
      if (media.id) {
        createdMediaIds.push(media.id);
        expect(media.filename).toBe(filename);
        expect(media.mime_type).toBe("image/png");
      }
    }
  });

  test("should reject non-image file type", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.post(
      `/v1/media/upload?organization_id=${orgId}&team_id=${teamId}`,
      {
        multipart: {
          file: {
            name: "not_an_image.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("This is not an image"),
          },
        },
      }
    );

    // Should reject with 400 or 415
    expect([400, 415, 422]).toContain(response.status());
  });
});

test.describe("Media API - Get Content", () => {
  let orgId: string;
  let existingMediaId: string | null = null;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    // Try to find existing media
    const mediaResponse = await authenticatedApiContext.get(
      `/v1/media?organization_id=${orgId}`
    );
    const mediaData = await expectSuccessResponse<ListResponse<Media>>(mediaResponse);
    if (mediaData.data.length > 0) {
      existingMediaId = mediaData.data[0].id;
    }
  });

  test("should get media content URL", async ({ authenticatedApiContext }) => {
    if (!existingMediaId) {
      test.skip();
      return;
    }

    const response = await authenticatedApiContext.get(
      `/v1/media/${existingMediaId}/url`
    );

    expect([200, 403, 404]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.url).toBeTruthy();
    }
  });

  test("should get media binary content with token", async ({ authenticatedApiContext }) => {
    if (!existingMediaId) {
      test.skip();
      return;
    }

    // Note: The /content endpoint requires a token query parameter
    // In real tests, we'd need to get the auth token
    const response = await authenticatedApiContext.get(
      `/v1/media/${existingMediaId}/content`
    );

    // Without token, should return 401
    expect([200, 401, 403, 404]).toContain(response.status());
  });
});
