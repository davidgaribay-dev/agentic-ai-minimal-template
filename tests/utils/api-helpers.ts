import type { APIRequestContext, APIResponse } from "@playwright/test";
import { expect } from "@playwright/test";
import { logger } from "./logger";
import type { Organization, Team, ListResponse } from "./types";

/**
 * API Helper Utilities
 *
 * Common patterns for API testing following Playwright best practices:
 * - Response validation
 * - Schema validation with type safety
 * - Error handling
 * - Logging
 */

/**
 * Validate API response status and optionally return JSON body
 *
 * Includes Content-Type validation to provide better error messages
 * when the API returns non-JSON responses (e.g., HTML error pages).
 */
export async function expectSuccessResponse<T = unknown>(
  response: APIResponse,
  expectedStatus = 200
): Promise<T> {
  const status = response.status();
  const url = response.url();

  if (status !== expectedStatus) {
    const body = await response.text();
    logger.error("api-response", {
      action: "unexpected-status",
      url,
      expected: expectedStatus,
      actual: status,
      body,
    });
    throw new Error(
      `Expected status ${expectedStatus} but got ${status} for ${url}: ${body}`
    );
  }

  // Validate Content-Type before attempting JSON parse
  const contentType = response.headers()["content-type"] || "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    logger.error("api-response", {
      action: "unexpected-content-type",
      url,
      contentType,
      body: body.substring(0, 500),
    });
    throw new Error(
      `Expected JSON response but got ${contentType} for ${url}: ${body.substring(0, 200)}`
    );
  }

  logger.debug("api-response", {
    action: "success",
    url,
    status,
  });

  const data = await response.json();
  return data as T;
}

/**
 * Validate error response
 */
export async function expectErrorResponse(
  response: APIResponse,
  expectedStatus: number,
  expectedDetail?: string | RegExp
): Promise<{ detail: string }> {
  const status = response.status();
  const url = response.url();

  expect(status).toBe(expectedStatus);

  const body = await response.json();

  logger.debug("api-response", {
    action: "error-response",
    url,
    status,
    body,
  });

  if (expectedDetail) {
    if (typeof expectedDetail === "string") {
      expect(body.detail).toBe(expectedDetail);
    } else {
      expect(body.detail).toMatch(expectedDetail);
    }
  }

  return body;
}

/**
 * Create a resource and return its ID with cleanup
 */
export async function createResource<T extends { id: string }>(
  context: APIRequestContext,
  endpoint: string,
  data: Record<string, unknown>
): Promise<T> {
  logger.info("api-resource", {
    action: "creating",
    endpoint,
    data,
  });

  const response = await context.post(endpoint, { data });
  const resource = await expectSuccessResponse<T>(response, 201);

  logger.info("api-resource", {
    action: "created",
    endpoint,
    id: resource.id,
  });

  return resource;
}

/**
 * Delete a resource (for cleanup)
 */
export async function deleteResource(
  context: APIRequestContext,
  endpoint: string
): Promise<void> {
  logger.info("api-resource", {
    action: "deleting",
    endpoint,
  });

  const response = await context.delete(endpoint);

  // Accept 200, 204, or 404 (already deleted)
  const status = response.status();
  if (status !== 200 && status !== 204 && status !== 404) {
    const body = await response.text();
    throw new Error(`Failed to delete resource ${endpoint}: ${status} ${body}`);
  }

  logger.info("api-resource", {
    action: "deleted",
    endpoint,
    status,
  });
}

/**
 * Paginated list helper
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

/** Maximum number of pages to fetch to prevent infinite loops */
const MAX_PAGES = 100;

export async function fetchAllPages<T>(
  context: APIRequestContext,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const allItems: T[] = [];
  let skip = 0;
  const limit = 100;
  let iterations = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (iterations++ >= MAX_PAGES) {
      logger.warn("fetch-all-pages", {
        action: "max-pages-exceeded",
        endpoint,
        pages: iterations,
        itemsFetched: allItems.length,
      });
      throw new Error(
        `Pagination exceeded ${MAX_PAGES} pages for ${endpoint}. Fetched ${allItems.length} items.`
      );
    }

    const queryParams = new URLSearchParams({
      ...params,
      skip: String(skip),
      limit: String(limit),
    });

    const response = await context.get(`${endpoint}?${queryParams}`);
    const data = await expectSuccessResponse<PaginatedResponse<T>>(response);

    allItems.push(...data.items);

    if (allItems.length >= data.total || data.items.length < limit) {
      break;
    }

    skip += limit;
  }

  return allItems;
}

/**
 * Wait for a condition to be true with polling
 */
export async function waitForCondition(
  check: () => Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { timeout = 10000, interval = 500, message = "Condition not met" } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

/**
 * Common helper functions for test setup
 * These reduce boilerplate in test files
 */

/**
 * Get the first organization for the authenticated user
 * Useful for tests that need an org context
 */
export async function getFirstOrganization(
  context: APIRequestContext
): Promise<Organization> {
  const response = await context.get("/v1/organizations/");
  const data = await expectSuccessResponse<ListResponse<Organization>>(response);

  if (data.data.length === 0) {
    throw new Error("No organizations found for user");
  }

  return data.data[0];
}

/**
 * Get the first team for an organization
 * Useful for tests that need a team context
 */
export async function getFirstTeam(
  context: APIRequestContext,
  organizationId: string
): Promise<Team> {
  const response = await context.get(`/v1/organizations/${organizationId}/teams`);
  const data = await expectSuccessResponse<ListResponse<Team>>(response);

  if (data.data.length === 0) {
    throw new Error(`No teams found for organization ${organizationId}`);
  }

  return data.data[0];
}

/**
 * Get organization and first team in one call
 * Combines the two common operations
 */
export async function getOrgAndTeam(
  context: APIRequestContext
): Promise<{ organization: Organization; team: Team }> {
  const organization = await getFirstOrganization(context);
  const team = await getFirstTeam(context, organization.id);
  return { organization, team };
}
