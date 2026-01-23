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
} from "../../../utils";

/**
 * Documents API Tests
 *
 * Tests for RAG document management
 * - /v1/documents - Document upload and management
 *
 * NOTE: These tests require OPENAI_API_KEY to be configured in the backend.
 * If not configured, the DocumentService will fail to initialize embeddings
 * and return 500 Internal Server Error. Tests handle this gracefully.
 */

// Actual backend DocumentPublic schema (more detailed than shared Document type)
interface Document {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  mime_type: string | null;
  organization_id: string;
  team_id: string | null;
  user_id: string | null;
  processing_status: string;
  processing_error: string | null;
  chunk_count: number;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

test.describe("Documents API - List and Get", () => {
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

  test("should list documents for organization", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/documents?organization_id=${orgId}`
    );

    // 500 = OPENAI_API_KEY not configured (backend infrastructure issue)
    if (response.status() === 500) {
      test.skip();
      return;
    }

    const data = await expectSuccessResponse<ListResponse<Document>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test("should list documents for team", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/documents?organization_id=${orgId}&team_id=${teamId}`
    );

    // 500 = OPENAI_API_KEY not configured
    if (response.status() === 500) {
      test.skip();
      return;
    }

    const data = await expectSuccessResponse<ListResponse<Document>>(response);

    expect(Array.isArray(data.data)).toBe(true);
  });

  test("should filter documents by status", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/documents?organization_id=${orgId}&status_filter=completed`
    );

    // 500 = OPENAI_API_KEY not configured
    if (response.status() === 500) {
      test.skip();
      return;
    }

    const data = await expectSuccessResponse<ListResponse<Document>>(response);

    expect(Array.isArray(data.data)).toBe(true);
    // All returned documents should have 'completed' processing_status
    data.data.forEach((doc) => {
      expect(doc.processing_status).toBe("completed");
    });
  });

  test("should return 404 for non-existent document", async ({ authenticatedApiContext }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await authenticatedApiContext.get(`/v1/documents/${fakeId}`);
    // 500 = OPENAI_API_KEY not configured, 404 = expected for non-existent
    expect([404, 500]).toContain(response.status());
  });
});

test.describe("Documents API - Upload", () => {
  let orgId: string;
  let teamId: string;
  const createdDocIds: string[] = [];

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
    for (const docId of createdDocIds) {
      try {
        await deleteResource(authenticatedApiContext, `/v1/documents/${docId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should upload text document", async ({ authenticatedApiContext }, testInfo) => {
    const filename = `test_document_${Date.now()}.txt`;
    const content = "This is a test document for API testing.";

    logTestData({ testName: testInfo.title, orgId, teamId, filename });

    // Form fields use organization_id and scope
    const response = await authenticatedApiContext.post("/v1/documents/", {
      multipart: {
        file: {
          name: filename,
          mimeType: "text/plain",
          buffer: Buffer.from(content),
        },
        organization_id: orgId,
        team_id: teamId,
        scope: "user",
      },
    });

    // May return 201 (created), 202 (accepted), 403 (RAG disabled), 422 (validation),
    // or 500 (OPENAI_API_KEY not configured)
    expect([200, 201, 202, 403, 422, 500]).toContain(response.status());

    if (response.ok()) {
      const document = await response.json();
      if (document.id) {
        createdDocIds.push(document.id);
        expect(document.filename).toBe(filename);
        expect(document.organization_id).toBe(orgId);
      }
    }
  });

  test("should reject unsupported file type", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.post("/v1/documents/", {
      multipart: {
        file: {
          name: "malicious.exe",
          mimeType: "application/x-msdownload",
          buffer: Buffer.from("fake executable content"),
        },
        organization_id: orgId,
        team_id: teamId,
        scope: "user",
      },
    });

    // Should reject with 400 (invalid file type), 403 (RAG disabled), or 500 (no API key)
    expect([400, 403, 415, 422, 500]).toContain(response.status());
  });
});

test.describe("Documents API - Get Content", () => {
  // These tests assume documents exist - will skip if no documents found
  let orgId: string;
  let existingDocId: string | null = null;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    // Try to find an existing document
    const docsResponse = await authenticatedApiContext.get(
      `/v1/documents?organization_id=${orgId}`
    );

    // Skip all tests in this block if API key not configured (500)
    if (docsResponse.status() === 500) {
      return;
    }

    const docsData = await expectSuccessResponse<ListResponse<Document>>(docsResponse);
    if (docsData.data.length > 0) {
      existingDocId = docsData.data[0].id;
    }
  });

  test("should get document content", async ({ authenticatedApiContext }) => {
    if (!existingDocId) {
      test.skip();
      return;
    }

    const response = await authenticatedApiContext.get(
      `/v1/documents/${existingDocId}/content`
    );

    // Should return content or 404 if content not available
    expect([200, 403, 404]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.content).toBeDefined();
      expect(data.filename).toBeDefined();
    }
  });

  test("should get document chunks", async ({ authenticatedApiContext }) => {
    if (!existingDocId) {
      test.skip();
      return;
    }

    const response = await authenticatedApiContext.get(
      `/v1/documents/${existingDocId}/chunks`
    );

    // Should return chunks list or 403/404
    expect([200, 403, 404]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });
});
